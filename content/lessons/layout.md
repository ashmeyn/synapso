---
mission: ОПЕРАЦИЯ 55 · КАРТОЧКА СЕТИ БЕЗ УГАДЫВАНИЯ РАЗМЕРОВ
scenario: Карточка Wi-Fi должна сохранять отступы при изменении ширины экрана. Две подписи в строке делят доступное место: название поля остаётся читаемым, а длинное имя сети может сокращаться.
goals:
- Задать непротиворечивые ограничения через якоря и activate.
- Найти недостающие размеры, неоднозначность или конфликт ограничений.
- Настроить intrinsicContentSize, hugging и compression resistance для подписей.
prereqs:
- frame
---

## Сначала договоримся о геометрии

Перед кодом нарисуй прямоугольник: корень шириной 320, слева и справа по 16, сверху 20, высота карточки 44. Значит, ожидаем x=16, y=20, ширину 288 и высоту 44. Корню размер задаём явно; дочернюю карточку расположит Auto Layout.

```swift
import UIKit
let root = UIView(frame: CGRect(x: 0, y: 0, width: 320, height: 120))
let card = UIView()
root.addSubview(card)
```

## Попытка в лоб: два источника правил

Если просто добавить якоря к новой `UIView`, её autoresizing mask по умолчанию тоже переводится в ограничения. Получается второй набор правил, который может конфликтовать с твоим. Не пытайся угадать, какое правило движок нарушит: отключи перевод маски у дочерней view, которой управляешь якорями.

```swift
let card = UIView()
root.addSubview(card)
// Здесь забыли translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    card.widthAnchor.constraint(equalToConstant: 288)
])
```

Это отдельная ошибочная попытка: `root` — ранее созданная корневая view. У корня с заданным frame маску не отключаем без необходимости. Само false не добавляет недостающих ограничений.

## Якоря связывают края

Представь ограничения как распорки: они задают отношения между элементами, а не готовый frame. Для ранее созданных `root` и `card` сначала отключи маску, затем включи весь набор через `NSLayoutConstraint.activate`. Правый отступ отрицательный, потому что край карточки расположен левее правого края корня.

```swift
card.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    card.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
    card.topAnchor.constraint(equalTo: root.topAnchor, constant: 20),
    card.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
    card.heightAnchor.constraint(equalToConstant: 44)
])
```

После `root.layoutIfNeeded()` карточка получает ожидаемый прямоугольник. `layoutIfNeeded` выполняет требуемый layout; если ты меняешь входы, проверяй после него, не сразу после создания ограничений.

## Хватает ли правил

Назови отдельно положение и размер по каждой оси. У обычной `UIView` нет собственной подходящей intrinsic-величины: нужны достаточные независимые связи для x, y, ширины и высоты. Здесь ширина выводится из двух краёв, поэтому отдельный width не нужен. Не считай четыре строки универсальным рецептом: связи могут быть зависимыми, неравенствами или включать размер содержимого.

Неоднозначность — больше одного допустимого решения; конфликт — нет решения, удовлетворяющего всем обязательным ограничениям. `hasAmbiguousLayout` помогает заметить первое после layout. При конфликте UIKit обычно выводит диагностику и нарушает одно правило; получившийся frame не является надёжным ожидаемым ответом.

## Подпись знает размер текста

Теперь замени прямоугольник подписью «Подключено». `intrinsicContentSize` — естественный размер содержимого, здесь он зависит от текста и шрифта. Для однострочного `UILabel` достаточно задать место: размер помогут определить собственные приоритетные ограничения подписи. Проверь, что после layout геометрия однозначна.

```swift
import UIKit
let root = UIView(frame: CGRect(x: 0, y: 0, width: 320, height: 120))
let label = UILabel()
label.text = "Подключено"
label.translatesAutoresizingMaskIntoConstraints = false
root.addSubview(label)
NSLayoutConstraint.activate([
    label.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
    label.topAnchor.constraint(equalTo: root.topAnchor, constant: 20)
])
root.layoutIfNeeded()
assert(!label.hasAmbiguousLayout)
```

Это не frame, заранее вычисленный по constraints. Если текст или шрифт изменится, естественный размер тоже может измениться. Для многострочного текста высота дополнительно зависит от доступной ширины.

## Две подписи: кому отдать лишнее место

В следующих фрагментах `name` и `value` — `UILabel` в одной строке, с текстами «Wi-Fi» и «Домашняя сеть», уже добавленные в `root` с отключённой маской. Hugging сопротивляется растягиванию выше естественного размера. Более высокий горизонтальный hugging у `name` оставляет лишнюю ширину для `value`: попробуй объяснить это, не употребляя слово «сжатие».

```swift
name.setContentHuggingPriority(.init(251), for: .horizontal)
value.setContentHuggingPriority(.init(250), for: .horizontal)
```

Приоритет — сила предпочтения от 1 до 1000; 1000 означает обязательное правило. Небольшой относительной разницы здесь достаточно; большее число выигрывает у меньшего при несовместимых предпочтениях.

## А если места не хватает

Теперь речь о другом направлении: compression resistance сопротивляется уменьшению ниже естественного размера. Сделай её выше у `name`, чтобы длинное имя сети в `value` сокращалось первым. У наших подписей одна строка; их стандартный режим обрезает текст, а не уменьшает размер шрифта.

```swift
name.setContentCompressionResistancePriority(.init(751), for: .horizontal)
value.setContentCompressionResistancePriority(.init(750), for: .horizontal)
```

Эти приоритеты не отменяют обязательные связи. Если задать одновременно две несовместимые ширины с 1000, поднятие hugging не исправит конфликт. Не назначай всем предпочтениям одинаковую максимальную силу.

## Итог: строка с понятным поведением

Собери строку: начало первой подписи, промежуток 8, правый край второй и общая базовая линия текста. Верх задаём первой подписи; естественные высоты и базовая линия определяют вторую. При широком корне лишнее место получает `value`, при тесном оно же уступает ширину. Назови роль каждого якоря до чтения.

```swift
import UIKit
let root = UIView(frame: CGRect(x: 0, y: 0, width: 320, height: 120))
let name = UILabel()
let value = UILabel()
name.text = "Wi-Fi"
value.text = "Домашняя сеть"
for label in [name, value] {
    label.translatesAutoresizingMaskIntoConstraints = false
    root.addSubview(label)
}
name.setContentHuggingPriority(.init(251), for: .horizontal)
value.setContentHuggingPriority(.init(250), for: .horizontal)
name.setContentCompressionResistancePriority(.init(751), for: .horizontal)
value.setContentCompressionResistancePriority(.init(750), for: .horizontal)
NSLayoutConstraint.activate([
    name.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
    name.topAnchor.constraint(equalTo: root.topAnchor, constant: 20),
    value.leadingAnchor.constraint(equalTo: name.trailingAnchor, constant: 8),
    value.trailingAnchor.constraint(
        equalTo: root.trailingAnchor, constant: -16
    ),
    value.firstBaselineAnchor.constraint(equalTo: name.firstBaselineAnchor)
])
root.layoutIfNeeded()
```

Для подписей не обещаем конкретную ширину букв: она зависит от шрифта. Проверяй отступы, базовую линию, отсутствие неоднозначности и относительное поведение приоритетов.

## Проверь себя

Закрой код и сначала восстанови правило словами.

- Почему у карточки нужны размер и положение по двум осям, но не обязательно ровно четыре constraints?
- Что у UILabel заменяет часть явных ограничений ширины и высоты?
- Какое предпочтение управляет лишним местом, а какое — нехваткой?

## Ответы к «Проверь себя»

- По каждой оси движку нужны положение и размер, иначе у раскладки несколько решений — это неоднозначность. Но число строк не важно: у карточки ширина выводится из пары краёв `leadingAnchor` +16 и `trailingAnchor` −16, поэтому отдельный width лишний, а высоту даёт `heightAnchor.constraint(equalToConstant: 44)`. Связи бывают зависимыми, неравенствами или опираются на размер содержимого, так что считаешь не строки, а независимые ответы на x, y, ширину и высоту и проверяешь `hasAmbiguousLayout` после `layoutIfNeeded()`.
- `intrinsicContentSize` — естественный размер содержимого, у подписи он зависит от текста и шрифта. Подпись сама добавляет приоритетные ограничения по этому размеру, поэтому однострочному `UILabel` хватает якорей места: `leadingAnchor` +16 и `topAnchor` +20, без width и height. Последствие: при смене текста или шрифта размер меняется сам, а для многострочного текста высота ещё зависит от доступной ширины.
- Лишним местом управляет hugging: он сопротивляется растягиванию выше естественного размера, и `name` с 251 против 250 у `value` остаётся узким, а ширину забирает `value`. Нехваткой управляет compression resistance: она сопротивляется сжатию ниже естественного размера, поэтому 751 у `name` против 750 у `value` значит, что обрезается сначала длинное имя сети. Оба — предпочтения ниже 1000, поэтому конфликт двух обязательных ширин они не исправят.

# ГЛУБЖЕ

## Ручная проверка на двух размерах

Не запускай экран ради одного прямоугольника: создай корень с frame, добавь дочернюю view, включи правила и вызови layoutIfNeeded. Для карточки из основы на ширине 320 ожидается 288, на 200 — 168. Это UIKit-проверка конкретного дерева view; простой подсчёт 320−32 ещё не проверяет Auto Layout.

## Почему конфликт нельзя предсказывать по frame

Если тебя спросят про две обязательные ширины 80 и 140, ответ — система несовместима. Не обещай конкретный выбор нарушенного правила и не делай его частью теста. Для двух режимов сохрани ссылки на constraints: выключи прежний и включи новый. Приоритет 999 полезен только тогда, когда ты действительно разрешаешь нарушить это предпочтение.

## Высота может следовать за шириной

Чтобы сделать квадрат, задай отношение двух размеров одного элемента: heightAnchor равен widthAnchor. Попробуй просчитать ширину по внешним краям, затем высоту по отношению. Это ещё один пример достаточности без отдельного числового ограничения каждой величины.

```swift
let square = UIView()
square.translatesAutoresizingMaskIntoConstraints = false
root.addSubview(square)
NSLayoutConstraint.activate([
    square.leadingAnchor.constraint(equalTo: root.leadingAnchor),
    square.trailingAnchor.constraint(equalTo: root.trailingAnchor),
    square.topAnchor.constraint(equalTo: root.topAnchor),
    square.heightAnchor.constraint(equalTo: square.widthAnchor)
])
```

## Текст, доступность и изменение контента

Проверь карточку с длинным именем и увеличенным шрифтом. CHCR определяет компромисс, но не гарантирует, что любой текст поместится. Для нескольких строк нужна определённая ширина и подходящее numberOfLines; Auto Layout может вычислить высоту. Не фиксируй численную высоту текста без причины и не путай intrinsicContentSize с текущим frame.
