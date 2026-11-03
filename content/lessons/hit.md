---
mission: ОПЕРАЦИЯ 58 · КАСАНИЕ ДОШЛО ДО ПУЛЬТА
scenario: На пульте шторы маленькая ручка должна легко нажиматься, а декоративный слой не должен закрывать элементы под ним. Нужно отдельно определить получателя касания и маршрут действий по responder chain.
goals:
- Найти получателя через hitTest с учётом порядка детей и фильтров UIKit.
- Расширить point(inside:) и сделать фон overlay проницаемым.
- Настроить target nil и объяснить связь next и первого responder.
prereqs:
- frame
---

## Слои пульта

Два элемента перекрываются в одной области: `back` добавлен первым, `front` последним. В ручном тесте передадим точку (40,40) в локальных координатах root и event=nil. Сначала предскажи верхний элемент; настоящего касания и окна для этого упражнения нет.

```swift
import UIKit
let root = UIView(frame: CGRect(x: 0, y: 0, width: 200, height: 140))
let back = UIView(frame: CGRect(x: 30, y: 30, width: 60, height: 40))
let front = UIView(frame: back.frame)
root.addSubview(back)
root.addSubview(front)
```

## Пишем в лоб: виден не значит доступен

Полупрозрачный декоративный слой всё ещё может перехватить точку, если его alpha не ниже порога и взаимодействие включено. Не пытайся решить маршрутизацию только цветом. Для наших перекрывающихся view первый hit — front; только при alpha=0.005 он будет пропущен.

```swift
let point = CGPoint(x: 40, y: 40)
assert(root.hitTest(point, with: nil) === front)
front.alpha = 0.005
assert(root.hitTest(point, with: nil) === back)
```

Продолжаем дерево миссии. Порог из документации — alpha < 0.01; не используем пограничное значение для численного теста.

## Как дерево выбирает получателя

Представь поиск как стопку прозрачных листов: начинаем с верхнего, но проверяем, способен ли он принять точку. Стандартный hitTest пропускает скрытую view, отключённое взаимодействие и alpha < 0.01. Затем спрашивает point(inside:with:), переводит точку детям и обходит subviews с последнего. Если ребёнок не подошёл, результатом может стать сама view.

Точка передаётся в системе координат проверяемой view. Пропуск родителя пропускает всю его ветку. `clipsToBounds=false` позволяет рисовать снаружи, но не отменяет проверку попадания у родителя.

## Увеличиваем доступную область

Маленькая ручка остаётся 24×24, но принимаем касание ещё на 12 point вокруг. Переопредели point(inside:), а не frame: видимый размер не должен менять раскладку. `insetBy` с отрицательными значениями расширяет bounds. Проверь локальную точку (−5,5), которую прежний прямоугольник отвергал.

```swift
final class HandleView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.insetBy(dx: -12, dy: -12).contains(point)
    }
}
```

Когда root спрашивает дерево, точка должна сначала пройти предков. Не обещай, что такое расширение пробьёт любые границы контейнера.

## Пропускаем фон, сохраняем кнопку

Если override всегда возвращает nil, вся ветка станет недоступной, включая кнопки внутри. Для overlay сначала вызови super: пусть дети получат шанс. Только если результат — сам overlay, верни nil; фон станет проницаемым, дети останутся доступны.

```swift
final class OverlayView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}
```

Для чистой декорации без интерактивных детей постоянный nil допустим. Здесь контракт другой: кнопка закрытия должна работать.

## hitTest и responder chain — разные вопросы

`hitTest` отвечает, какая view найдена под точкой. Responder chain связывает responders через next и позволяет искать обработчик события или action. У обычной дочерней view next — superview, у корневой view контроллера — управляющий контроллер. Дальше цепочка зависит от контейнеров и представления: может идти к родителю, window, application. Не рисуй один неизменный маршрут для всех экранов.

## Action без заданного получателя

`target: nil` разрешает UIKit искать подходящего обработчика действия по правилам responder chain. Не путай это с нашей ручной проверкой next: поиск action требует контекста интерфейса. Ниже контроллер объявляет совместимый @objc-метод; кнопка зарегистрировала селектор, но мы не запускаем реальное действие.

```swift
final class RemoteController: UIViewController {
    @objc func editName(_ sender: UIButton) { }
}
let controller = RemoteController()
controller.loadViewIfNeeded()
let button = UIButton()
controller.view.addSubview(button)
button.addTarget(
    nil, action: #selector(RemoteController.editName(_:)), for: .touchUpInside
)
assert(button.next === controller.view)
assert(controller.view.next === controller)
```

Поле ввода просит фокус через `becomeFirstResponder()`. Проверь возвращённый Bool: без подходящего UI-контекста успех не гарантирован. Первый responder, target action и hit-test view — связанные, но разные роли.

## Итог: фон пропускает, кнопка принимает

Восстанови порядок дерева и два результата. Снизу расположен behind, поверх него overlay, а внутри overlay — close. Точка на фоне проходит к behind; точка кнопки остаётся у close. Этот самостоятельный ручной тест не создаёт UIWindow и не посылает настоящих касаний.

```swift
import UIKit
final class OverlayView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}
let root = UIView(frame: CGRect(x: 0, y: 0, width: 200, height: 140))
let behind = UIView(frame: CGRect(x: 80, y: 80, width: 40, height: 30))
let overlay = OverlayView(frame: root.bounds)
let close = UIButton(frame: CGRect(x: 10, y: 10, width: 40, height: 30))
root.addSubview(behind)
root.addSubview(overlay)
overlay.addSubview(close)
assert(root.hitTest(CGPoint(x: 90, y: 90), with: nil) === behind)
assert(root.hitTest(CGPoint(x: 20, y: 20), with: nil) === close)
```

Маршрут nil-target action рассматривай отдельно от этих проверок: они устанавливают только результат явного hitTest.

## Проверь себя

Объясни правило до кода, а не после угадывания view.

- Почему последний subview проверяется первым и почему hidden у предка важен?
- Чем расширение point(inside:) отличается от изменения frame?
- Почему nil из overlay и nil-target action имеют разный смысл?

## Ответы к «Проверь себя»

- `hitTest` обходит subviews с последнего добавленного, потому что он нарисован сверху — как верхний лист в стопке прозрачных листов из урока. Поэтому при перекрытии точку (40,40) получает `front`, а `back` — только когда `front` пропущен, например при `alpha = 0.005`. Скрытая view, `isUserInteractionEnabled == false` или `alpha < 0.01` пропускаются вместе со всей веткой: если `isHidden` у предка, до его детей поиск вообще не дойдёт.
- `point(inside:with:)` отвечает только на вопрос «принимаю ли я эту точку», поэтому `bounds.insetBy(dx: -12, dy: -12).contains(point)` расширяет зону касания, а ручка остаётся 24×24. Изменение `frame` поменяло бы видимый размер и раскладку соседей. Ограничение: точка сначала проходит `point(inside:)` предков, так что за границей родителя расширенная зона касание не получит.
- `nil` из `hitTest` overlay — ответ поиска по дереву: в этой ветке под точкой нет получателя, и поиск идёт к view ниже. Поэтому сначала вызываешь `super.hitTest`, а `nil` возвращаешь только при `hit === self`, иначе пропадёт и кнопка внутри. `target: nil` в `addTarget` — о другом: получатель action заранее не задан, и, когда действие срабатывает, UIKit ищет обработчик по правилам responder chain (связь через `next`), а не по точке касания.

# ГЛУБЖЕ

## За пределами родителя

Проверь дерево: маленькая panel отвергает точку до того, как hitTest спросит выступающую handle. Отключение clipsToBounds меняет рисование, не стандартный поиск. Исправление зависит от контракта: увеличить принимающую область родителя или переразместить элементы; не обходи фильтры hidden/interaction без причины.

## Особые значения по умолчанию

Не предполагай, что у всех подклассов взаимодействие включено. У UIImageView оно по умолчанию выключено; кнопка внутри не получит hitTest, пока родитель пропускает свою ветку. Проверь свойство у реального класса, прежде чем писать сложный override.

## Фокус текстового поля

Чтобы попросить ввод, добавь UITextField в иерархию и вызови becomeFirstResponder в подходящий момент показа. Булев результат показывает принятие запроса. Ручной тест без окна не доказывает открытие клавиатуры; `resignFirstResponder` просит завершить фокус. Не делай сохранение данных зависимым только от появления клавиатуры.

## Не используем охватывающий frame для касания

После поворота frame не является надёжным локальным прямоугольником. hitTest переводит точку в систему проверяемой view; point(inside:) работает с bounds. Если тебя спросят о пустых углах вокруг повёрнутого элемента, вернись к convert из темы frame, а не сравнивай point с охватывающим rect.
