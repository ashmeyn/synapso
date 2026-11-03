---
mission: ОПЕРАЦИЯ 72 · СПИСОК ЖЕЛАНИЙ С ОДНИМ ПУТЁМ ИЗМЕНЕНИЙ
scenario: Пользователь пишет название желания и сохраняет его, а экран показывает результат или ошибку. Нужно провести все изменения через действия, отделить сохранение от расчёта состояния и воспроизвести переходы без сети.
goals:
- Описать State и Action и написать чистый reducer с проверкой переходов.
- Сделать Store единственным владельцем состояния и выполнять эффект вне reducer.
- Перенести изменение нового поля на action, не мутируя состояние снаружи.
prereqs:
- arch
- combine
---

## Что экран знает сейчас

Желание ещё не сохранено: title пуст, isSaving=false, savedID=nil. State — данные для поведения и отображения, Action — событие пользователя или ответ источника. Представь журнал команд: изменение можно объяснить записью «что произошло», а не угадывать, кто поправил поле. Store владеет состоянием конкретного feature; это не обязательный глобальный singleton.

```swift
struct WishState: Equatable {
    var title = ""
    var isSaving = false
    var savedID: Int?
    var error: String?
}
enum WishAction {
    case titleChanged(String), saveTapped, saved(Int), saveFailed
}
```

## Попытка в лоб: просмотр записал дважды

Ниже «посмотреть следующий state» вызывает внешний эффект: writes увеличивается. Если тест или предпросмотр дважды вычислит один переход, случатся две записи, хотя пользователь ничего не отправлял. Предскажи writes=2 и назови строку, которую надо вынести. Это локальная модель эффекта, не настоящий сервер.

```swift
var writes = 0
func badReduce(_ state: WishState) -> WishState {
    writes += 1
    var next = state
    next.isSaving = true
    return next
}
```

Новая версия reducer читает только state/action и возвращает новый state. Лог, сеть, случайность и чтение часов тоже эффекты; они не становятся чистыми от того, что стоят внутри switch.

## Reducer: объясняем одно правило

Сохранение пустого title не начинается; повторный tap во время сохранения игнорируется. После принятого tap isSaving становится true, старое сообщение ошибки очищается. Функция ниже — фрагмент перехода для WishState; вход не меняется, меняется копия next.

```swift
func savingState(_ state: WishState) -> WishState {
    guard !state.title.isEmpty, !state.isSaving else { return state }
    var next = state
    next.isSaving = true
    next.error = nil
    return next
}
```

Чистая функция при одинаковом входе даёт одинаковый результат без внешних последствий. Поэтому можно проверить переход отдельно от сохранения; копирование value-state не означает глубокую независимость любых ссылок внутри него.

## Действие ответа завершает переход

В полном reduce case titleChanged меняет title и очищает прежние savedID/error, только когда нет сохранения; saveTapped применяет правило savingState; saved(id) сбрасывает флаг и записывает id; saveFailed сбрасывает флаг и даёт ошибку. Пройди «Лампа»→tap→saved(7): false→true→false, savedID=7. Ниже отдельный after-фрагмент ответа; все действия будут в итоговом reducer.

```swift
func receivedState(_ state: WishState, id: Int) -> WishState {
    var next = state
    next.isSaving = false
    next.savedID = id
    return next
}
```

Это контракт одного запроса. Эффект обязан прислать одно итоговое действие; защиту от запоздавшего ответа с другим requestID добавляют, когда допускают смену запроса.

## Store: читаем снаружи, меняем через send

Закрой setter через private(set), а send пусть вызывает reduce. Вызов store.state.title=… тогда не компилируется; store.send(.titleChanged(…)) проходит тем же маршрутом, что тест. Фрагмент ниже показывает только управление state, без эффектов; reduce будет объявлен в итоговом комплекте.

```swift
final class StateStore {
    private(set) var state = WishState()
    func send(_ action: WishAction) { state = reduce(state, action) }
}
```

Чтение копии state и изменение этой копии не меняют Store. В учебном Store все send и callbacks идут последовательно в одном контексте исполнения; этот класс не обещает потокобезопасность. Для UI выбери MainActor и возвращай туда ответы.

## Эффект отправляет новое действие

WishSaving — наш протокол источника, не API TCA. После принятого saveTapped Store запускает save, а completion отправляет saved либо saveFailed через send. Стаб WishSpy отвечает сразу: это помогает проверить маршрут без сети. В настоящем клиенте ответ может прийти позже, но он всё равно становится action.

```swift
enum WishError: Error { case unavailable }
protocol WishSaving {
    func save(
        title: String, completion: @escaping (Result<Int, WishError>) -> Void
    )
}
```

WishSpy — локальная реализация указанного контракта.

```swift
final class WishSpy: WishSaving {
    private(set) var titles: [String] = []
    func save(
        title: String, completion: @escaping (Result<Int, WishError>) -> Void
    ) {
        titles.append(title)
        completion(.success(7))
    }
}
```

Store запускает эффект, только если до перехода isSaving=false, а после true. Поэтому повторный tap не запускает второе сохранение. Не пиши в state напрямую из completion, иначе часть переходов снова станет невидимой.

## Как это связано с TCA и MVVM

Redux-подход — однонаправленный маршрут: действие → reducer → состояние → отображение; эффекты возвращают действия. The Composable Architecture — библиотека, которая даёт Store, reducers, управление effects, композицию features и инструменты тестирования. В библиотечном reducer обычно обновляют state через inout и возвращают описание Effect; выполнение эффекта остаётся отдельным. Конкретные макросы и сигнатуры зависят от версии, поэтому здесь их не имитируем.

В MVVM ViewModel тоже может владеть состоянием и зависимостями; его переходы часто выражены методами. В нашем варианте события представлены enum и централизованным reducer, поэтому легче воспроизводить последовательность. Выбирай по требованиям к композиции, тестам и сложности команды; это не шкала «лучше/хуже».

## Итог: полный маршрут без сети

Полный комплект ниже разбит на четыре блока для чтения: модели, источник, reducer, Store. Они составляют один Swift-файл. Store получает источник через init, а результат вновь входит как action.

```swift
struct WishState: Equatable {
    var title = ""
    var isSaving = false
    var savedID: Int?
    var error: String?
}
enum WishAction {
    case titleChanged(String), saveTapped, saved(Int), saveFailed
}
```

```swift
enum WishError: Error { case unavailable }
protocol WishSaving {
    func save(
        title: String, completion: @escaping (Result<Int, WishError>) -> Void
    )
}
final class WishSpy: WishSaving {
    private(set) var titles: [String] = []
    func save(
        title: String, completion: @escaping (Result<Int, WishError>) -> Void
    ) {
        titles.append(title)
        completion(.success(7))
    }
}
```

```swift
func reduce(_ state: WishState, _ action: WishAction) -> WishState {
    var next = state
    switch action {
    case let .titleChanged(value):
        if !state.isSaving {
            next.title = value
            next.savedID = nil
            next.error = nil
        }
    case .saveTapped:
        guard !state.title.isEmpty, !state.isSaving else { return state }
        next.isSaving = true
        next.error = nil
    case let .saved(id):
        next.isSaving = false
        next.savedID = id
    case .saveFailed:
        next.isSaving = false
        next.error = "Не сохранено"
    }
    return next
}
```

```swift
final class WishStore {
    private(set) var state = WishState()
    let source: any WishSaving
    init(source: any WishSaving) { self.source = source }
    func send(_ action: WishAction) {
        let before = state
        state = reduce(state, action)
        guard case .saveTapped = action,
              !before.isSaving, state.isSaving else { return }
        source.save(title: state.title) { [weak self] result in
            switch result {
            case let .success(id): self?.send(.saved(id))
            case .failure: self?.send(.saveFailed)
            }
        }
    }
}
```

Пустой tap ничего не делает, непустой title запускает ровно один принятый запрос, ответ снимает isSaving. Для самостоятельного запуска воспользуйся полным ключом практики: зависимостей библиотеки и настоящей сети там нет.

## Проверь себя

Восстанови путь и владельца.

- Почему два вычисления reducer не должны создавать две записи?
- Кто запускает save и как ответ меняет состояние?
- Почему setter закрыт, хотя state — структура, и чем action отличается от метода ViewModel?

## Ответы к «Проверь себя»

- Reducer — чистая функция: читает только state и action и возвращает новый state, поэтому одинаковый вход всегда даёт одинаковый результат без внешних последствий. Если внутри стоит запись (`writes += 1`), то тест или предпросмотр, дважды вычисливший один переход, сделает две записи, хотя пользователь ничего не отправлял. Поэтому сеть, лог, случайность и часы выносишь из reducer: переход можно проверять отдельно от сохранения.
- Save запускает Store, а не reducer: в `send` сначала `state = reduce(state, action)`, и только для принятого `saveTapped` (до перехода `isSaving == false`, после — `true`) вызывается `source.save`. Completion не пишет в поля, а отправляет новое действие: `self?.send(.saved(id))` или `self?.send(.saveFailed)`, и тот же reducer снимает `isSaving` и записывает `savedID` или ошибку. Так повторный tap не запускает второе сохранение, а каждый переход виден как action.
- Store — класс и владеет своей копией state, поэтому открытый setter позволил бы `store.state.title = …` поменять поле в обход reducer, и такое изменение не объяснить записью в журнале. С `private(set)` такая строка не компилируется, и всё идёт через `store.send(.titleChanged(…))` — тем же маршрутом, что в тесте; копия, прочитанная снаружи, Store не меняет. Action — значение enum, которое проходит через один централизованный reducer, поэтому последовательность событий легко воспроизвести; в MVVM переходы обычно разбросаны по методам ViewModel, что не хуже, а просто другой выбор.

# ГЛУБЖЕ

## Отмена и актуальность — разные условия

Если редактирование во время сохранения станет разрешено, прежний ответ может относиться к старому title. Введи requestID в state и action ответа, игнорируй неактуальный ответ. Отмена работы экономит ресурс, но сама по себе не доказывает актуальность: источник может уже успеть завершиться.

## Композиция без двух владельцев

Пусть экран списка содержит подэкран фильтра: родительский state хранит дочерний state, родительский action — дочернее событие. Родитель делегирует переход дочернему reducer и записывает получившуюся часть. Не создавай независимую копию общего фильтра в каждом экране: получишь два источника истины.

## Тест перехода и тест эффекта

Отдельно проверяй возвращённый state на action, отдельно — вызов зависимости и действие ответа. При replay записанных событий внешний эффект не должен случайно исполниться заново: replay переходов не равен повторной отправке команд серверу. Если логируешь actions, исключи личный пользовательский текст.

## Цена принятого маршрута

Для пары простых полей enum, reducer и effect plumbing могут добавить больше кода, чем методы ViewModel. При нескольких связанных features централизованные события помогают отследить причину. Сначала оцени изменения и навыки команды; учебный mini-Store не заменяет библиотечные инструменты отмены, изоляции и композиции.
