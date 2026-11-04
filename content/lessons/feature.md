---
mission: ОПЕРАЦИЯ 80 · СПИСОК ЗАПАСОВ ОТ ФАЙЛА ДО ЭКРАНА
scenario: Фича показывает сохранённые запасы дома, обновляет их через async-источник и переживает ошибку без потери данных. Нужно собрать модель, файл, репозиторий, состояние UI и тесты по контракту, не копируя готовый экран.
goals:
- Собрать слои фичи с Codable-хранилищем и async-источником через контракты.
- Провести проверенные данные от кэша и remote до UI, сохранив ошибки и актуальность.
- Доказать сквозное поведение тестами, включая перезапуск, отказ записи и старый ответ.
prereqs:
- arch
- store
- async
- tests
---

## Условия сдачи, а не пошаговый рецепт

Сначала прочитай контракт и сам разбей работу. Supply имеет id>0, непустой title после trim и count>=0, id уникальны, порядок данных сохраняется. Файл отсутствует — пустой первый запуск; повреждённый файл — ошибка, не пустой успех. Кэш показываем первым и отмечаем сохранённой копией; успех remote объявляем только после проверки и записи. Слои — как эстафета: каждый передаёт проверенный результат дальше и отвечает за свой участок.

## Попытка в лоб: ошибка стала пустотой

Если catch при чтении JSON возвращает [], повреждение выглядит как отсутствие запасов. Кандидат «исправляет» экран обновлением и незаметно скрывает проблему. Назови, какие случаи нужно различить, прежде чем писать адаптер: нет файла, валидный пустой список, ошибка чтения, ошибка декодирования и неверный смысл данных.

```swift
// Неверное правило чтения, не рабочий адаптер.
// do { decode(data) } catch { return [] }
// Пустой первый запуск не равен повреждённому файлу.
```

## Общий каркас показываем один раз

FeatureSupport.swift содержит только модель, состояние, контракты и локальные входы для проверки. Он показан целиком ниже; используй его с новой частью каждой ступени, не переписывай весь каркас. В production учебные заглушки и newTestFile не входят в domain. Модель и границы ниже; это контракт, не реализация фичи.

```swift
import Foundation
struct Supply: Codable, Equatable, Sendable {
    let id: Int
    let title: String
    let count: Int
}
enum SupplyError: Error, Equatable {
    case invalidData, stale, unavailable, writeFailed
}
struct SupplyState: Equatable {
    var items: [Supply] = []
    var isLoading = false
    var isStale = true
    var error: String?
}
protocol SupplyCache {
    func load() throws -> [Supply]
    func save(_ values: [Supply]) throws
}
protocol SupplyRemote {
    func fetch() async throws -> [Supply]
}
final class MemorySupplyCache: SupplyCache {
    var items: [Supply]
    private(set) var saves = 0
    init(items: [Supply] = []) { self.items = items }
    func load() throws -> [Supply] { items }
    func save(_ values: [Supply]) throws { items = values; saves += 1 }
}
struct FixedSupplyRemote: SupplyRemote {
    let items: [Supply]
    func fetch() async throws -> [Supply] { items }
}
struct FailingSupplyRemote: SupplyRemote {
    func fetch() async throws -> [Supply] { throw SupplyError.unavailable }
}
func newTestFile() throws -> URL {
    let folder = FileManager.default.temporaryDirectory
        .appendingPathComponent("synapso-feature-" + UUID().uuidString)
    try FileManager.default.createDirectory(
        at: folder, withIntermediateDirectories: true
    )
    return folder.appendingPathComponent("supplies.json")
}
```

SupplyState хранит items, isLoading, isStale, error. MemorySupplyCache, FixedSupplyRemote и FailingSupplyRemote — локальные проверки, не сеть; newTestFile создаёт свой временный каталог. На ошибку remote интерфейс сохраняет ранее показанные items; при ошибке cached не делает вид, что пусто, и прекращает этот запуск.

## Слои и направление вызовов

До реализации нарисуй словами свой маршрут: View → Model на MainActor → Repository → Cache/Remote. Тип Supply не импортирует UI. Cache отвечает за Codable/файл, Repository — за проверку, порядок обновления и подтверждение записи, Model — за пользовательское состояние, тест — за наблюдаемый контракт. Не создавай зависимости внутри body View. В ключах дан один вариант, архитектура с тем же поведением тоже подходит.

## Ошибки и правило коммита

Вход remote сначала проверяется: пустой title, отрицательное count и повтор id отвергаются до записи. Новый JSON записывается с .atomic; только потом выдаём успех. При ошибке записи прежнее сохранённое состояние остаётся единственной подтверждённой копией. .atomic — замена одного файла, не транзакция нескольких писателей. Один Repository владеет этим cache; файловый актор здесь не превращается в защиту любого внешнего процесса.

## Два обновления — два уровня защиты

Новый refresh получает generation. Repository после await сравнивает её до save, Model — до каждого применения результата к UI. Старый ответ не меняет ни файл, ни экран; отмена сама это не гарантирует. Отменённая задача завершается без сообщения об ошибке; текущий spinner должен завершиться. В учебных тестах источники локальные, порядок ответов задаётся явно, не sleep. Для этого есть управляемый источник: каждый запрос ждёт, пока тест его завершит.

```swift
actor ControlledSupplyRemote: SupplyRemote {
    private var requests: [CheckedContinuation<[Supply], Error>] = []
    private var waiters: [(Int, CheckedContinuation<Void, Never>)] = []
    func fetch() async throws -> [Supply] {
        try await withCheckedThrowingContinuation { continuation in
            requests.append(continuation)
            let ready = waiters.filter { $0.0 <= requests.count }
            waiters.removeAll { $0.0 <= requests.count }
            for waiter in ready { waiter.1.resume() }
        }
    }
    func waitForRequests(_ count: Int) async {
        if requests.count >= count { return }
        await withCheckedContinuation { waiters.append((count, $0)) }
    }
    func finish(_ index: Int, items: [Supply]) {
        requests[index].resume(returning: items)
    }
}
```

## Проверки важнее демонстрационного happy path

Минимум: валидное сохранение и чтение новым экземпляром, неправильный JSON не превращается в [], невалидный remote не портит кэш, ошибка записи не выдаёт успех, два ответа в обратном порядке не откатывают результат. Для async XCTest дождись результата или управляй continuation источника. Не утверждай, что fake доказал сеть; реальный файл проверяем во временном каталоге, а UI-декларацию отдельно компиляцией.

## Итоговый маршрут сборки

Теперь собери фичу без подсказок в телах методов. Валидатор, JSONSupplyCache, SupplyRepository, SupplyModel и фабрику ты пишешь в ступенях 2–4, 6 и 7. Ниже самостоятельная функция состояния с каркасом из урока, она объясняет пользователю происходящее, не показывает тип Swift-ошибки.

```swift
func statusText(_ state: SupplyState) -> String {
    if state.isLoading { return "Обновляем" }
    if let error = state.error { return error }
    return state.isStale ? "Сохранённая копия" : "Актуально"
}
```

Родитель приложения владеет одной SupplyModel для экрана, SupplyView читает state и отправляет refresh. Файловый URL выбирают при сборке приложения, не в View. Ответ готов, когда прошли критерии, а не когда закончились классы.

## Проверь себя

Перед сдачей назови доказательства по слоям.

- Где отличил отсутствие файла от ошибки и где проверил смысл данных?
- Почему remote-ответ ещё не успех и где отсекается старый результат?
- Какие тесты действительно читали файл, какие использовали подмену и что не проверено UI-компиляцией?

## Ответы к «Проверь себя»

- Отсутствие файла и ошибку различает Cache — слой, отвечающий за файл и Codable: нет файла — пустой первый запуск и `[]`, а ошибка чтения или decode пробрасывается, иначе повреждение выглядит как «запасов нет», как в попытке с `catch { return [] }`. Смысл данных проверяет Repository: id > 0, непустой title после trim, `count >= 0`, уникальные id — и делает это до записи. Так экран честно показывает ошибку вместо пустоты, а невалидный remote не портит кэш.
- Ответ remote — только кандидат: Repository сначала проверяет его, потом пишет JSON с `.atomic`, и лишь после успешной записи возвращает результат. Если запись упала, прежний сохранённый файл остаётся единственной подтверждённой копией, и успех не объявляется. Старый ответ отсекает generation на двух уровнях: Repository сравнивает её после await до save, Model — до каждого применения результата к UI; отмена сама этого не гарантирует.
- Реальный файл читают только тесты во временном каталоге от `newTestFile()`: сохранение и чтение новым экземпляром и битый JSON, который не превращается в `[]`. `MemorySupplyCache`, `FixedSupplyRemote`, `FailingSupplyRemote` и управляемый `ControlledSupplyRemote` — подмены: они задают порядок ответов без `sleep`, но не доказывают работу сети. UI-декларацию проверяешь отдельно компиляцией, а она подтверждает только то, что код собирается, но не поведение экрана.

# ГЛУБЖЕ

## Изменение формата сохранения

Если позже добавишь поле или envelope с версией, опиши чтение старых данных и миграцию. decode-failure не лечат молчаливым удалением файла. Для учебного первого формата версия не добавлена ради декоративного поля; совместимость станет отдельным требованием при изменении.

## Пустой список, офлайн и удаление

Свежий remote=[] — корректный новый пустой список и может заменить кэш. Отказ remote — не [], кэш остаётся. Если сервер отдаёт страницы, этот контракт замены нельзя перенести на отдельную страницу: понадобится слияние и явные удаления из system design.

## Отмена и очередь хранения

При большом файле оцени стоимость encode/write и не выполняй эту работу на MainActor. Repository здесь actor с синхронным cache-адаптером и небольшими данными: между проверкой generation и save нет await. Если вынесешь save в отдельный async-актор, пересмотри порядок коммита: изоляция двух акторов сама не даёт общую транзакцию.

## Что понадобится перед выпуском

После учебной приёмки проверь реальный transport, sandbox URL, поведение при заполненном диске, локализацию, accessibility и запуск UI. Добавь метрики отказов чтения/записи и обновления без личного содержимого. Эта фича не содержит синхронизацию пользовательских правок и нескольких устройств: для неё нужен новый конфликтный контракт, а не ещё один catch.
