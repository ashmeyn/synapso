---
mission: ОПЕРАЦИЯ 63 · РАСЧЁТ ПОЕЗДКИ БЕЗ СКРЫТОЙ ПОКУПКИ
scenario: Экран аренды самоката показывает расчёт до подтверждения, а сохраняет его только после подтверждения. Нужно менять тариф и текст независимо, проверять поведение подстановки и не заставлять хранилище делиться чеками.
goals:
- Разделить расчёт, текст и сохранение, не сохраняя предпросмотр.
- Внедрить протоколы тарифа и хранилища и расширить тариф без switch клиента.
- Проверить контракт подстановки и разделить независимые возможности протокола.
prereqs:
- proto
- di
---

## Пишем в лоб: предпросмотр уже сохранился

На поездке 11 длительностью 10 минут учебный тариф даёт 20 условных единиц. Пользователь ещё не подтвердил покупку, но preview уже записал её. Предскажи две строки и назови, какую ответственность надо вынуть из этого метода. Входы урока — минуты 0...100, переполнения на них нет.

```swift
struct Ride { let id: Int; let minutes: Int }
final class RideScreen {
    var saved: [Int: Int] = [:]
    func preview(_ ride: Ride) -> String {
        let amount = ride.minutes * 2
        saved[ride.id] = amount
        return "Итого: \(amount)"
    }
}
let screen = RideScreen()
print(screen.preview(Ride(id: 11, minutes: 10)))
print(screen.saved.count)
```

## SRP: разные причины изменения

Правило тарифа меняется независимо от текста и способа сохранения. SRP, Single Responsibility Principle, предлагает собрать работу, которая меняется по одной причине, и разделить разные причины. Это не требование одного метода на класс. В варианте после разделения ниже уже существует Ride; предпросмотр использует цену и текст, а сохранение вызывается отдельно.

```swift
struct MeteredPrice {
    func amount(_ ride: Ride) -> Int { ride.minutes * 2 }
}
struct ReceiptText {
    func text(_ amount: Int) -> String { "Итого: \(amount)" }
}
final class MemoryQuotes {
    var values: [Int: Int] = [:]
    func save(id: Int, amount: Int) { values[id] = amount }
}
```

Сравни с первым классом: цена теперь вычисляется без записи. Оркестратор подтверждения может вызывать несколько этих компонентов, не забирая их внутренние правила.

## OCP: новый тариф без правки клиента

До изменения новый абонемент приходится вписывать в switch. OCP, Open/Closed Principle, здесь означает расширять семейство тарифов новой реализацией, не менять алгоритм клиента. Сначала посмотри старый вариант, затем выбери протокол как точку расширения.

```swift
struct MeteredPlan { }
struct PassPlan { }
func price(_ ride: Ride, plan: Any) -> Int {
    switch plan {
    case is PassPlan: return 30
    case is MeteredPlan: return ride.minutes * 2
    default: return 0
    }
}
```

После изменения клиент получает RidePricing; выбор конкретного типа остаётся в сборке приложения, и она может меняться.

## OCP: делегируем правило

Теперь клиент не узнаёт конкретный тип плана при вычислении. Ride уже объявлен; две реализации ниже обещают одну операцию. Проверь результат MeteredPrice и PassPrice для десяти минут: 20 и 30. Это расширение по ожидаемой оси изменений, не обещание никогда не редактировать код.

```swift
protocol RidePricing { func amount(_ ride: Ride) -> Int }
struct MeteredPrice: RidePricing {
    func amount(_ ride: Ride) -> Int { ride.minutes * 2 }
}
struct PassPrice: RidePricing {
    func amount(_ ride: Ride) -> Int { 30 }
}
```

## LSP: наследник обязан держать обещание

LSP, Liskov Substitution Principle, проверяет поведение: клиент базы не должен получить нарушенный контракт при замене на наследника. До исправления PromoPrice возвращает −5, хотя база обещает неотрицательную цену на входах 0...100. Компилятор такой контракт сам не доказывает.

```swift
class BasePrice {
    // Контракт: для minutes 0...100 результат неотрицательный.
    func amount(minutes: Int) -> Int { minutes * 2 }
}
final class PromoPrice: BasePrice {
    override func amount(minutes: Int) -> Int { -5 }
}
let price: BasePrice = PromoPrice()
print(price.amount(minutes: 10))
```

После исправления тот же контракт выполняется; не усиливаем требования к входу и не заставляем клиента проверять конкретный тип.

```swift
final class SafePromoPrice: BasePrice {
    override func amount(minutes: Int) -> Int {
        max(0, super.amount(minutes: minutes) - 5)
    }
}
```

## LSP и ISP: исправляем контракт, сужаем роль

Скидку уже исправили через max(0, super.amount−5). Теперь посмотри ISP, Interface Segregation Principle: хранилищу не нужна операция отправки чека. Толстый протокол ниже заставлял бы его придумывать пустую share; после разделения клиент просит только нужную возможность.

```swift
protocol RideServices {
    func save(id: Int, amount: Int)
    func share(id: Int, text: String)
}
```

После разделения:

```swift
protocol QuoteSaving: AnyObject { func save(id: Int, amount: Int) }
protocol ReceiptSharing { func share(id: Int, text: String) }
final class MemoryQuotes: QuoteSaving {
    private(set) var values: [Int: Int] = [:]
    func save(id: Int, amount: Int) { values[id] = amount }
}
```

## DIP, KISS и DRY: нужная граница

DIP, Dependency Inversion Principle: сценарий подтверждения зависит от своего контракта сохранения, а MemoryQuotes реализует его. DI передаёт зависимость; DIP определяет направление зависимости. Представь расчёт как розетку: сценарий знает нужный контакт, не устройство за ним. Ниже «до» создаёт конкретное хранилище внутри, «после» получает контракт.

```swift
final class HardCheckout {
    let store = MemoryQuotes()
}
struct InjectedCheckout {
    let store: any QuoteSaving
}
```

KISS — сохрани решение простым для требований. DRY — не дублируй одно знание; похожий текст не всегда одно правило. Не создавай общий движок с флагами для двух независимых подписей лишь ради одинаковой интерполяции: оставь receiptText и bannerText отдельными, пока причина изменения различается.

До: роль стала строковым переключателем:

```swift
func anyText(_ amount: Int, role: String) -> String {
    role == "receipt" ? "Итого: \(amount)" : "Цена: \(amount)"
}
```

После: две явно названные обязанности:

```swift
func receiptText(_ amount: Int) -> String { "Итого: \(amount)" }
func bannerText(_ amount: Int) -> String { "Цена: \(amount)" }
```

## Итог: предпросмотр и подтверждение разошлись

Восстанови цепочку: цена — из pricing, запись — только в confirm. Полный пример ниже включает контракт, локальный адаптер и клиент. При новом тарифе меняется сборка pricing, при новом способе хранения — адаптер store. Код не выполняет оплату и не пишет настоящий файл.

```swift
struct Ride { let id: Int; let minutes: Int }
protocol RidePricing { func amount(_ ride: Ride) -> Int }
struct MeteredPrice: RidePricing {
    func amount(_ ride: Ride) -> Int { ride.minutes * 2 }
}
struct PassPrice: RidePricing {
    func amount(_ ride: Ride) -> Int { 30 }
}
protocol QuoteSaving: AnyObject { func save(id: Int, amount: Int) }
final class MemoryQuotes: QuoteSaving {
    private(set) var values: [Int: Int] = [:]
    func save(id: Int, amount: Int) { values[id] = amount }
}
struct RideCheckout {
    let pricing: any RidePricing
    let store: any QuoteSaving
    func preview(_ ride: Ride) -> Int { pricing.amount(ride) }
    func confirm(_ ride: Ride) {
        store.save(id: ride.id, amount: pricing.amount(ride))
    }
}
```

Предпросмотр возвращает число, подтверждение сохраняет по id. Текст отдельно форматирует ReceiptText из основы; массив протоколов сам по себе не делает проект SOLID.

## Проверь себя

Закрой код и привяжи каждое правило к конкретному изменению.

- Что отделяешь по SRP и как доказываешь отсутствие записи при preview?
- Где находится точка расширения тарифа и почему это не запрет на любые switch?
- Как проверить LSP и почему MemoryQuotes не должен реализовывать share?

## Ответы к «Проверь себя»

- По SRP отделяешь три причины изменения: правило тарифа (`MeteredPrice`), текст (`ReceiptText`) и сохранение (`MemoryQuotes`); это одна причина изменения на тип, а не «один метод на класс». Отсутствие записи доказываешь наблюдением: после `checkout.preview(ride)` цена получена, а `store.values` всё ещё пуст, и только после `checkout.confirm(ride)` появляется запись `store.values[11]`. Так предпросмотр больше не превращается в скрытую покупку.
- Точка расширения — протокол `RidePricing`: новый тариф добавляется новой реализацией вроде `PassPrice`, а `RideCheckout` вызывает `pricing.amount(ride)`, не узнавая конкретный тип. Выбор конкретного тарифа живёт в сборке приложения, и там правка допустима. OCP — расширение по ожидаемой оси изменений, а не обещание никогда не редактировать код, поэтому плох только switch по типу плана внутри клиента, а не любой switch.
- LSP проверяешь поведением: подставляешь наследника туда, где ждут `BasePrice`, и смотришь, держит ли он обещание базы — неотрицательную цену на минутах 0...100. `PromoPrice` с `-5` контракт ломает, `max(0, super.amount(minutes: minutes) - 5)` держит, и компилятор это сам не докажет. `MemoryQuotes` не реализует `share` по ISP: хранилищу отправка чека не нужна, толстый протокол заставил бы писать пустой метод, поэтому роли разделены на `QuoteSaving` и `ReceiptSharing`.

# ГЛУБЖЕ

## Классика собеса: квадрат и прямоугольник

На собесе LSP часто спрашивают так: можно ли сделать Square наследником изменяемого Rectangle? Клиент прямоугольника ставит ширину 4, высоту 5 и ждёт площадь 20. Квадрат держит стороны равными и тихо меняет вторую.

```swift
class Rectangle {
    var width = 0
    var height = 0
    var area: Int { width * height }
}
final class Square: Rectangle {
    override var width: Int {
        didSet { if height != width { height = width } }
    }
    override var height: Int {
        didSet { if width != height { width = height } }
    }
}
let shape: Rectangle = Square()
shape.width = 4
shape.height = 5
print(shape.area)
```

Вывод 25, а не 20: квадрат — прямоугольник в геометрии, но не подставляемый наследник для изменяемого Rectangle. Исправляют не проверкой типа у клиента, а моделью: общий протокол Shape с area и два независимых значения-структуры без наследования.

## ISP без фанатизма

После разделения MemoryQuotes реализует только QuoteSaving. Не дели каждый метод на собственный протокол автоматически: критерий — независимые потребности клиентов. Если save и delete всегда нужны одному и тому же клиенту, это одна роль, и несколько методов в протоколе уместны. Признак слишком толстого протокола — реализация, которая вынуждена писать пустой метод или fatalError ради требования, которое ей не нужно.

## Похожие строки и преждевременный DRY

Сначала выясни, почему две формулы одинаковы. PIN домофона и код доставки могут пока оба состоять из цифр, но иметь разную длину и разные правила. Общая функция с ролью-строкой и набором флагов скрывает эти причины изменения. При действительно общей политике валидации вынести правило полезно; сходства текста недостаточно.

## Границы учебного тарифа

У нас синхронный расчёт малых целых чисел без реальной покупки. Округление, ошибки хранилища и атомарность подтверждения требуют отдельного контракта. Не добавляй их в любой протокол на всякий случай; сначала задай ожидаемое поведение приложения.
