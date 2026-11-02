---
mission: ОПЕРАЦИЯ 41 · ЗАГРУЗИТЬ ЭКСПОНАТ БЕЗ ЛЕСТНИЦЫ CALLBACK
scenario: Экран музейного экспоната 21 получает название и длительность аудио из двух независимых источников. Собери результат без реальной сети и корректно обработай ошибку и отмену.
goals:
- Переписать completion-последовательность через async/await и try await.
- Запустить два независимых запроса через async let и собрать их результаты.
- Создать Task из синхронного метода, обновить модель UI через @MainActor и обработать отмену.
prereqs:
- urls
- esc
---

## Сначала реши, когда данные готовы

Назови результат: «Луна: 3 мин». Источник здесь — локальные функции с async-контрактом; они заменяют сетевые ответы, но не изображают задержку. В приложении можно заменить реализацию, сохранив способ вызова.

## Пишем в лоб: читаем раньше ответа

Пройди модель callback вручную: completion пока только сохранён. Первая печать происходит раньше его вызова. Это последовательная модель ошибки, не настоящий сетевой запрос.

```swift
var text = "Загрузка"
let completion = { text = "Луна" }
print(text)
completion()
print(text)
```

Вывод «Загрузка», затем «Луна». return из функции, которая лишь запустила запрос, не означает, что completion уже обновил экран.

## async возвращает значение в точку вызова

Начни с объявления источников. async означает, что функция может приостанавливаться; throws — что вместо результата возможна ошибка. await отмечает возможную приостановку задачи, а не блокирующее ожидание потока.

```swift
enum ExhibitError: Error { case missing }
func fetchTitle(id: Int) async throws -> String {
    try Task.checkCancellation()
    guard id == 21 else { throw ExhibitError.missing }
    return "Луна"
}
func fetchMinutes(id: Int) async throws -> Int {
    try Task.checkCancellation()
    guard id == 21 else { throw ExhibitError.missing }
    return 3
}
```

Внешний async-код пишет let title = try await fetchTitle(id: 21). try относится к ошибке, await — к асинхронному вызову. Само наличие async не обещает нового потока или фактической приостановки в каждом вызове.

## Переходим от вложенного completion к последовательности

Сохрани порядок чтения: сначала название, затем длительность. Вместо callback внутри callback результат попадает в локальную константу. Обе fetch-функции уже объявлены выше.

```swift
func loadExhibit(id: Int) async throws -> String {
    let title = try await fetchTitle(id: id)
    let minutes = try await fetchMinutes(id: id)
    return "\(title): \(minutes) мин"
}
```

Для id 21 получаем «Луна: 3 мин»; неизвестный id выбрасывает ExhibitError.missing. Аналогия: await — закладка в текущем поручении, пока исполнитель может заняться другим, а не удержанный телефонный звонок.

## Независимые запросы можно начать вместе

Проверь зависимость: длительности не нужно ждать названия. async let создаёт дочерние задачи; собери их через try await. Не применяй это, если второй запрос требует результат первого.

```swift
async let title = fetchTitle(id: 21)
async let minutes = fetchMinutes(id: 21)
let value = try await (title, minutes)
print("\(value.0): \(value.1) мин")
```

Фрагмент находится внутри async throws-функции с объявленными источниками. Вывод тот же. Порядок фактического исполнения запросов не задан; async let не гарантирует два одновременно занятых ядра.

## Отмена не превращается в отсутствие экспоната

Отдели CancellationError от ошибки данных. Task.cancel лишь выставляет запрос отмены; Task.isCancelled читает флаг, Task.checkCancellation выбрасывает CancellationError. Источник и обработка результата должны сотрудничать.

```swift
do {
    let title = try await fetchTitle(id: 21)
    try Task.checkCancellation()
    print(title)
} catch is CancellationError {
    print("Отменено")
} catch {
    print("Нет экспоната")
}
```

Этот блок выполняется в async-контексте с fetchTitle. Проверка после await не позволяет уже отмеченной отменой задаче применить результат без проверки. Она не откатывает прошлые действия и не гарантирует невозможность отмены сразу после проверки.

## Кнопка вызывает синхронный метод

Поставь @MainActor на модель экрана: её text и start изолированы главным актором. start остаётся синхронным, но создаёт Task с async-телом и возвращает handle для отмены. Task наследует изоляцию этого контекста; это не способ отправить тяжёлый расчёт в фон.

## Итог: UI получает собранный результат

Собери модель. Источники и модель включены в самостоятельный блок. Из главного актора вызови let handle = screen.start(id: 21); позже handle.cancel() при необходимости.

```swift
enum ExhibitError: Error { case missing }
func fetchTitle(id: Int) async throws -> String {
    try Task.checkCancellation()
    guard id == 21 else { throw ExhibitError.missing }; return "Луна"
}
func fetchMinutes(id: Int) async throws -> Int {
    try Task.checkCancellation()
    guard id == 21 else { throw ExhibitError.missing }; return 3
}
@MainActor final class ExhibitScreen {
    private(set) var text = "Загрузка"
    func start(id: Int) -> Task<Void, Never> {
        Task {
            do {
                async let title = fetchTitle(id: id)
                async let minutes = fetchMinutes(id: id)
                let value = try await (title, minutes)
                try Task.checkCancellation()
                text = "\(value.0): \(value.1) мин"
            } catch is CancellationError { text = "Отменено" }
            catch { text = "Нет экспоната" }
        }
    }
}
```

После завершения успешной задачи text равен «Луна: 3 мин». @MainActor защищает доступ к модели, но для автоматической перерисовки SwiftUI понадобится ObservableObject/@Published или @Observable из уже знакомой темы obs. Здесь проверяем модель, а не View.

## Проверь себя

Восстанови момент готовности, не только слова API.

- Что означает try, а что await?
- Когда async let подходит двум запросам?
- Почему cancel без проверки не обязан остановить код?

# ГЛУБЖЕ

## Callback-адаптер имеет контракт

Перед обёрткой уточни: completion вызывается ровно один раз на всех конечных путях. withCheckedThrowingContinuation позволяет возобновить ожидание результатом или ошибкой; повторный resume — ошибка, отсутствие resume оставляет ожидание незавершённым.

## Структурированные дети и отдельный Task

Не считай Task из start структурированным ребёнком вызывающей задачи: это отдельная unstructured-задача, её handle надо учитывать явно. Дочерние async let связаны со своим scope, их окончание ожидается при выходе; отмена кооперативна и для них.

## После await выбор мог измениться

Перед загрузкой запомни requestedID. После получения результата проверь, совпадает ли он с текущим selectedID, иначе старая карточка может перекрыть новый выбор. Проверка отмены и проверка актуальности решают разные задачи.

## Исполнение зависит от режима языка

Не выводи расположение работы из одного слова async. Изоляция, версия Swift и настройки проекта влияют на исполнение; @MainActor явно фиксирует контракт модели. Код ориентирован на Swift 5; строгую диагностику Swift 6 проверяют отдельно, особенно для значений между изоляциями.

## Динамическое число запросов: TaskGroup

async let подходит, когда запросов фиксированное число и оно известно при написании кода. Если id приходят массивом, используй группу задач: каждая addTask — дочерняя задача, результаты читаются в порядке завершения, а не постановки.

```swift
func loadTitles(ids: [Int]) async throws -> [Int: String] {
    try await withThrowingTaskGroup(of: (Int, String).self) { group in
        for id in ids {
            group.addTask { (id, try await fetchTitle(id: id)) }
        }
        var titles: [Int: String] = [:]
        for try await (id, title) in group { titles[id] = title }
        return titles
    }
}
```

Поэтому результат собираем по id, а не по позиции. Если одна задача бросит ошибку, for try await её пробросит, а выход из группы отменит и дождётся оставшихся детей. Без бросающих задач есть withTaskGroup.
