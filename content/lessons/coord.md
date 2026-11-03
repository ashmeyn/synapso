---
mission: ОПЕРАЦИЯ 58 · МАСТЕР ПЕРЕЕЗДА БЕЗ ЦИКЛА
scenario: Экран списка коробок запускает дочерний мастер редактирования и получает событие завершения. Родитель должен удерживать мастер во время работы и освобождать его после завершения, не создавая цикл с контроллером.
goals:
- Вынести push из контроллера за протокол навигатора и реализовать start.
- Удержать дочерний координатор и удалить только завершённый экземпляр.
- Передать событие через слабый callback или делегат и разорвать цикл владения.
prereqs:
- nav
- weak
---

## Контроллер знает слишком много

Представь кнопку «Готово» в мастере коробки. Контроллеру достаточно сообщить о событии; выбор следующего экрана и длительность дочернего flow организует координатор. В уроке `BoxController` — простой контекст событий без UIKit, а `FakeNavigator` записывает push. Сначала назови, что можно проверить без настоящего перехода.

## Попытка в лоб: экран удержал координатор

Если координатор хранит controller, а controller хранит callback с сильным self, получаем цикл. Удаление child из родительского массива не разрывает это ребро. Следующий метод — ошибочный start внутри BoxCoordinator с объявленными controller, navigator и onFinish.

```swift
func start() {
    controller.onDone = { self.onFinish?() }
    navigator.push(controller)
}
```

Проверь граф ссылок, прежде чем добавлять deinit: координатор → контроллер → callback → координатор.

## Контракт переходов

Координатор похож на ведущего экскурсии: участник сообщает «закончил», ведущий решает, куда идти дальше. `Coordinator.start()` запускает flow; `Navigating.push` отделяет решение о переходе от его механики. Fake сохраняет экраны, поэтому тест сможет проверить запись без UIWindow.

```swift
protocol Coordinator: AnyObject { func start() }
final class BoxController { var onDone: (() -> Void)? }
protocol Navigating: AnyObject { func push(_ screen: BoxController) }
final class FakeNavigator: Navigating {
    private(set) var screens: [BoxController] = []
    func push(_ screen: BoxController) { screens.append(screen) }
}
```

Контекст `BoxController` не притворяется UIViewController: его обязанность здесь — хранить событие. Реальный UIKit-адаптер будет получать UIViewController и вызывать pushViewController.

## Событие с обратной слабой связью

Сохрани контроллер у координатора, а обратное событие сделай слабым. При завершении callback найдёт живой координатор и передаст onFinish. Если координатор уже освобождён, событие ничего не делает. Объясни отдельно, что удерживает controller и что удерживает сам child.

```swift
final class BoxCoordinator: Coordinator {
    let navigator: any Navigating
    let controller = BoxController()
    var onFinish: (() -> Void)?
    init(navigator: any Navigating) { self.navigator = navigator }
    func start() {
        controller.onDone = { [weak self] in self?.onFinish?() }
        navigator.push(controller)
    }
}
```

Вместо callback можно объявить протокол событий с AnyObject и хранить weak delegate; координатор реализует протокол. Это та же слабая обратная связь из темы weak, её применишь в ступени 6. Слабый захват не завершает flow и не удаляет child из массива. Он решает одну задачу: не даёт callback стать сильным ребром назад.

## Родитель держит активную работу

В `MoveCoordinator` уже объявлены navigator и `childCoordinators: [BoxCoordinator]`. Создай child, добавь в массив до start, затем запусти. Ниже фрагмент внутри метода openBox; обработчик завершения подключим следующим шагом.

```swift
let child = BoxCoordinator(navigator: navigator)
childCoordinators.append(child)
child.start()
```

Без владельца child может исчезнуть после выхода из метода: callback контроллера слабый. Массив здесь хранит активные flows, а не историю всех открытых экранов.

## Завершение удаляет конкретный экземпляр

Внутри openBox после append и до start подключи onFinish. Родитель захватывается слабо; child тоже слабо, чтобы он не удерживал себя собственным callback. По `===` удаляем именно завершённый объект, а не всех соседей.

```swift
child.onFinish = { [weak self, weak child] in
    guard let child else { return }
    self?.childCoordinators.removeAll { $0 === child }
}
```

Если родитель годами хранит завершённые children, их ресурсы тоже остаются живы. Это лишнее удержание по жизненному циклу, даже если ARC исправен и retain cycle нет. Исчезновение экрана и освобождение координатора не одно событие.

## Router и Coordinator не одно имя

Router выполняет переходы: push, pop, показ модального экрана. Coordinator организует последовательность событий и владение дочерними flows. В маленьком примере роль router играет протокол Navigating с одним push. Не нужно плодить отдельный объект на каждую строку; граница полезна, когда меняется механика навигации или нужен тест.

## Итог: навигатор может держать экран

Восстанови сильные ссылки до чтения: child держит controller, navigator тоже хранит controller, обратный callback слабый. Поэтому после удаления последнего владельца child освобождается, хотя fake всё ещё хранит экран. Parent с массивом и обработчиком завершения восстановишь в ступени 3.

```swift
protocol Coordinator: AnyObject { func start() }
final class BoxController { var onDone: (() -> Void)? }
protocol Navigating: AnyObject { func push(_ screen: BoxController) }
final class FakeNavigator: Navigating {
    private(set) var screens: [BoxController] = []
    func push(_ screen: BoxController) { screens.append(screen) }
}
final class BoxCoordinator: Coordinator {
    let navigator: any Navigating
    let controller = BoxController()
    var onFinish: (() -> Void)?
    init(navigator: any Navigating) { self.navigator = navigator }
    func start() {
        controller.onDone = { [weak self] in self?.onFinish?() }
        navigator.push(controller)
    }
}
let navigator = FakeNavigator()
var child: BoxCoordinator? = BoxCoordinator(navigator: navigator)
weak var probe = child
child?.start()
child = nil
assert(probe == nil)
assert(navigator.screens.count == 1)
```

Тест проверяет владение и запись push, не настоящий переход. Для завершения child родителем используй removeAll по идентичности из предыдущего раздела; временный локальный child здесь убран явно, чтобы изолировать проверку цикла.

## Проверь себя

Закрой код и нарисуй три стрелки владения, затем назови две слабые обратные связи.

- Почему слабый callback не заменяет childCoordinators?
- Почему завершённый child нужно удалить именно из родительского массива?
- Почему navigator может ещё хранить controller, хотя координатор уже освобождён?

## Ответы к «Проверь себя»

- Слабый `controller.onDone = { [weak self] in self?.onFinish?() }` решает одну задачу: callback не становится сильным ребром назад к координатору. Он никого не держит, поэтому без владельца child освободится сразу после выхода из `openBox`, и событие «Готово» уйдёт в пустоту. Сильно держит активный flow родитель: `childCoordinators.append(child)` до `child.start()`.
- Массив `childCoordinators` — единственный сильный владелец child, поэтому, пока запись в нём есть, child и его controller живы, даже если цикла нет. Удаление по идентичности `childCoordinators.removeAll { $0 === child }` убирает именно завершённый экземпляр и не трогает соседей. В `onFinish` захватываешь `[weak self, weak child]`, чтобы callback не держал ни родителя, ни сам child; иначе завершённые flows копятся годами вместе с ресурсами.
- Владение и навигация — разные рёбра: child держит controller, но navigator при `push` тоже сохраняет его у себя. Когда последний владелец child пропал, координатор освобождается (`probe == nil`), а `navigator.screens.count` остаётся 1. Удалить child не значит сделать pop: экран убирает router своей операцией, а координатор отвечает только за flow и детей.

# ГЛУБЖЕ

## Слабый делегат вместо callback

Если событию нужен контракт с несколькими методами, объяви протокол с AnyObject и weak delegate. Контроллер сообщает событие делегату, координатор реализует метод. Выбери один понятный канал для этого события; слабый делегат тоже требует сильного владельца координатора на время flow.

## Завершение не равно pop

Удалить child из массива — операция владения. Убрать экран со стека — навигационная операция. В реальном приложении они должны согласоваться с контрактом: готово, отмена и возврат пользователя могут завершать flow. В fake этого урока экраны остаются журналом push; не обещай, что очистка child сама выполнит pop.

## Повторные start и finish

Если start допустим только один раз, введи явную защиту от второго push. Если событие завершения может прийти дважды, сделай finish идемпотентным — повтор не вызывает результат второй раз. Сначала реши контракт, потом добавляй флаг; эти ограничения не обязательны для всякого Coordinator.

## Поток и реальный UIKit

Наш fake синхронный и не использует UI. Реальный навигатор и контроллеры должны соблюдать изоляцию главного потока, например @MainActor. Протокол не делает вызов автоматически безопасным. Для проверки настоящего pop или жеста назад потребуется отдельный UIKit-контекст; здесь достаточно ручного события и weak-наблюдателя.
