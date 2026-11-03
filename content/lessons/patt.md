---
mission: ОПЕРАЦИЯ 64 · СОБЫТИЯ И ЭКСПОРТ ГОЛОСОВОЙ БИБЛИОТЕКИ
scenario: Локальный recorder сообщает о готовой записи, библиотека уведомляет независимый счётчик, а экспорт выбирает формат через создание продукта. Все записи уже заданы данными: микрофон, сеть и файл не используются.
goals:
- Передать событие через weak delegate с контрактом AnyObject.
- Управлять block-наблюдением NotificationCenter: хранить токен, снимать и заменять.
- Вынести создание продукта в фабричный метод и подменить его реализацию.
prereqs:
- proto
- di
---

## Один результат, разные получатели

Запись 21 «Прогулка» готова. Recorder сообщает одному делегату, библиотека добавляет запись и может опубликовать recordingSaved для независимых слушателей. Экспорт — другая задача: создать нужный формат. Сначала выбери число получателей и ответственность; одинаковое замыкание не означает одинаковый паттерн.

```swift
struct Recording { let id: Int; let title: String }
```

## Пишем в лоб: delegate стал владельцем

LibraryController хранит recorder. Если recorder сильно хранит delegate=controller, граф замыкается. Ниже до-фрагмент; RecordingDelegate уже известен из следующего определения. Сам факт протокола цикл не устраняет.

```swift
final class Recorder {
    var delegate: (any RecordingDelegate)?
    func finish(_ value: Recording) { delegate?.recordingFinished(value) }
}
```

После изменения weak var delegate не удерживает библиотеку; контракт ограничен AnyObject, потому что weak относится к ссылочным объектам.

## delegate: один адресат, слабая обратная связь

Представь delegate как указанный номер получателя: recorder знает, кому сообщить завершение, но не становится его владельцем. Протокол задаёт событие, weak — правило времени жизни. Внешний владелец должен удерживать делегат, пока он нужен.

```swift
protocol RecordingDelegate: AnyObject {
    func recordingFinished(_ value: Recording)
}
final class Recorder {
    weak var delegate: (any RecordingDelegate)?
    func finish(_ value: Recording) { delegate?.recordingFinished(value) }
}
```

Если последний владелец делегата исчез, ссылка станет nil и optional-вызов ничего не сделает. Это не механизм рассылки нескольким независимым подписчикам.

## observer: слушатели подключаются отдельно

NotificationCenter рассылает уведомление всем подходящим регистрациям. Для block API сохрани возвращённый NSObjectProtocol-токен и явно removeObserver. Потеря локального токена не снимает регистрацию: центр продолжает держать block. В следующих фрагментах LibraryBadge хранит center, token и ids; имя recordingSaved объявлено в практике.

```swift
token = center.addObserver(
    forName: .recordingSaved, object: nil, queue: nil
) { [weak self] note in
    guard let id = note.userInfo?["id"] as? Int else { return }
    self?.ids.append(id)
}
```

С queue=nil callback исполняется синхронно на потоке публикации. Наш контекст однопоточный; настоящему UI нужна доставка на main по отдельному контракту. Неверный id в userInfo игнорируется явно.

## Снятие и повторная подписка

start должен сначала снять прежнюю регистрацию, иначе одно событие посчитаете дважды. weak self предотвращает удержание слушателя, removeObserver завершает саму регистрацию: это разные задачи. Ниже методы внутри LibraryBadge; свойство token — optional.

```swift
func stop() {
    if let token { center.removeObserver(token) }
    token = nil
}
deinit { stop() }
```

Перед новым addObserver вызывай stop. Очистка в deinit работает при отсутствии сильного цикла; она не спасёт слушателя, которого block держит через self.

## factory: клиент не выбирает тип в init

До изменения клиент знает названия форматов и сам создаёт продукт. Посмотри switch внутри и объясни, почему третий формат потребует правки клиента. Такой выбор может быть уместен в сборке приложения; проблема здесь — смешение сценария экспорта и выбора конкретного типа.

```swift
final class HardExport {
    let formatter: any RecordingText
    init(kind: String) {
        switch kind {
        case "markdown": formatter = MarkdownText()
        default: formatter = PlainText()
        }
    }
}
```

В следующем разделе вынесем создание в переопределяемый метод. Простая функция со switch — simple factory; не всякая функция make автоматически является GoF Factory Method.

## Фабричный метод: переопределяем создание

В этом варианте ExportJob.export содержит сценарий и вызывает makeText. MarkdownJob меняет только создание продукта, возвращаемого по RecordingText. Метод workflow остаётся прежним. Recording уже объявлен; строка с # — содержимое экспорта, не запись файла.

```swift
protocol RecordingText { func text(_ value: Recording) -> String }
struct PlainText: RecordingText {
    func text(_ value: Recording) -> String { value.title }
}
struct MarkdownText: RecordingText {
    func text(_ value: Recording) -> String { "# \(value.title)" }
}
```

Теперь creator использует эти продукты:

```swift
class ExportJob {
    func makeText() -> any RecordingText { PlainText() }
    func export(_ value: Recording) -> String { makeText().text(value) }
}
final class MarkdownJob: ExportJob {
    override func makeText() -> any RecordingText { MarkdownText() }
}
```

Это классический вариант фабричного метода через наследование creator. В Swift также часто внедряют фабрику протоколом или замыканием: это удобная альтернативная сборка, но не та же демонстрация override.

## Итог: владелец держит recorder, не наоборот

Собери канал завершения отдельно от рассылки и создания форматтера. В полном контексте ниже библиотека удерживает recorder, он слабо сообщает запись обратно. observer из предыдущих разделов и factory подключаются к своим обязанностям, не заменяют delegate.

```swift
struct Recording { let id: Int; let title: String }
protocol RecordingDelegate: AnyObject {
    func recordingFinished(_ value: Recording)
}
final class Recorder {
    weak var delegate: (any RecordingDelegate)?
    func finish(_ value: Recording) { delegate?.recordingFinished(value) }
}
final class LibraryController: RecordingDelegate {
    let recorder = Recorder()
    private(set) var recordings: [Recording] = []
    init() { recorder.delegate = self }
    func recordingFinished(_ value: Recording) { recordings.append(value) }
}
let controller = LibraryController()
controller.recorder.finish(Recording(id: 21, title: "Прогулка"))
assert(controller.recordings.map { $0.id } == [21])
```

Сначала проверь появление записи 21, затем проверяй подписку и экспорт отдельно. Без микрофона получаем воспроизводимое событие, а не тест настоящей записи аудио.

## Проверь себя

Закрой код и назови отдельное правило для каждой связи.

- Почему AnyObject не заменяет weak и кто держит делегат?
- Почему token=nil не заменяет removeObserver у block API?
- Где у фабричного метода находится выбор продукта и что останется у клиента?

## Ответы к «Проверь себя»

- `AnyObject` лишь ограничивает `RecordingDelegate` классами: без этого `weak` к протоколу не применить, потому что weak бывает только у ссылочных объектов. Удержание снимает само `weak var delegate`: recorder знает, кому сообщить, но не владеет получателем, как указанный номер получателя. Делегат держит внешний владелец — в итоге это переменная `controller`, а `LibraryController` сам сильно держит recorder; исчезнет владелец — ссылка станет nil, и `delegate?.recordingFinished` ничего не сделает.
- Block API возвращает токен, а саму регистрацию вместе с block хранит центр. Поэтому `token = nil` теряет только твою ручку, а центр продолжает вызывать block на каждое `recordingSaved`. Регистрацию завершает `center.removeObserver(token)`, поэтому `stop()` сначала снимает, потом обнуляет, а `start()` начинается с `stop()`, иначе одно событие посчитается дважды.
- Выбор продукта живёт в переопределяемом `makeText()` у creator: `ExportJob` по умолчанию создаёт `PlainText()`, а `MarkdownJob` переопределяет только его и возвращает `MarkdownText()`. Сценарий `export(_:)` остаётся прежним и работает с продуктом через `RecordingText`. У клиента остаётся выбрать, какой job собрать, и вызвать `export`, без switch по названию формата в собственном init.

# ГЛУБЖЕ

## NotificationCenter и Combine

Publisher NotificationCenter оборачивает поток уведомлений; sink возвращает cancellable, которое удерживают и отменяют по времени жизни подписки. Combine не исправляет сильный захват self автоматически. Как и при token, отдели владельца подписки от доставки и правила актуальности события.

## Фильтр по отправителю

Если событие относится только к текущей сессии, передай object:session в addObserver и публикуй с тем же объектом. В тесте удобно использовать NSObject-подкласс, чтобы явно проверить идентичность. Не фильтруй по display name, если разные сессии могут называться одинаково.

## Singleton и тесты

Singleton скрывает глобальную зависимость и разделяет изменяемое состояние между тестами и экранами. Иногда единый сервис по времени жизни процесса нужен, но клиент может получать его через протокол. Тогда production-сборка передаст shared, а тест — независимый FixedTitle, без очистки всего мира после каждого запуска.

## Продукт на один запрос

Фабрика задаёт также контракт времени жизни продукта. Для независимых mutable jobs возвращай новые объекты; cached job может переносить состояние первого экспорта во второй. Если нужен общий кеш, явно отдели его от состояния отдельного задания. Название make не обещает свежий экземпляр без контракта.
