---
mission: ОПЕРАЦИЯ 50 · ОГРАНИЧИТЬ ГРОМКОСТЬ ОДНИМ ПРАВИЛОМ
scenario: Экран звука принимает громкость вне диапазона 0...100 и должен показать, что значение было ограничено. Вынеси правило в собственную property wrapper и проверь, где живёт её состояние.
goals:
- Написать @propertyWrapper с wrappedValue и init(wrappedValue:), ограничивающую начальное значение и запись.
- Открыть projectedValue через $ как признак последнего ограничения.
- Объяснить backing storage и исправить изменение копии обёртки вместо исходного состояния.
prereqs:
- state
- access
---

## Назови одно правило громкости

Проверь конкретный ввод: 150 должен стать 100, -5 — 0, 70 остаётся 70. Если проверять только slider, импорт настроек или другой caller может записать неверное значение; правило должно находиться на пути записи самого свойства.

## Пишем в лоб: обычное свойство всё принимает

Начни с прямого присваивания: никакого ограничения нет, число 150 сохраняется как есть.

```swift
struct SoundSettings { var volume = 50 }
var settings = SoundSettings()
settings.volume = 150
print(settings.volume)
```

Вывод 150. Нужно поведение и при первой инициализации, и при последующих присваиваниях, а не один guard на кнопке.

## Wrapper задаёт доступ к значению

Создай Clamped. @propertyWrapper отмечает тип обёртки; wrappedValue — интерфейс чтения и записи. Инициализатор пишется init(wrappedValue:): его использует синтаксис начального значения.

```swift
@propertyWrapper
struct Clamped {
    private var value: Int
    init(wrappedValue: Int) { value = min(100, max(0, wrappedValue)) }
    var wrappedValue: Int {
        get { value }
        set { value = min(100, max(0, newValue)) }
    }
}
```

@Clamped var volume = 150 вызывает инициализацию с 150 и сохраняет 100. Setter обрабатывает последующие записи. Не оставляй init без ограничения, иначе первый вход обойдёт правило.

## Под именем свойства скрыт backing storage

Разверни @Clamped мысленно: компилятор создаёт private _volume типа Clamped, а volume читает и пишет его wrappedValue. В нашем struct-wrapper value хранится именно внутри _volume. Аналогия: volume — окно выдачи, _volume — ящик с механизмом ограничения, $volume — индикатор его работы.

## Проекция не обязана быть Binding

Добавь projectedValue: Bool и private limited. После каждого запроса limited показывает, изменило ли правило этот последний запрос; чтение само флаг не меняет. Наружный синтаксис — settings.$volume.

```swift
var projectedValue: Bool { limited }
```

Это часть Clamped из итогового блока: limited задаётся в init и setter сравнением сохранённого и запрошенного числа. 150 → 100, true; затем 70 → 70, false. У разных обёрток projectedValue имеет разный тип; знак $ не обещает Binding или publisher.

## Подвох: поменяли копию _volume

Прочитай метод внутри SoundSettings с @Clamped var volume = 50: Clamped — struct, поэтому локальная copy является отдельным значением. Её setter не записывает результат назад в _volume.

```swift
mutating func change(_ requested: Int) {
    var copy = _volume
    copy.wrappedValue = requested
}
```

После change(150) volume остаётся 50. Исправь на volume = requested или явно присвой изменённую копию назад; обычный путь свойства проще. На классовую обёртку правило независимости копий автоматически не переносится.

## Связь с State и Published

Сравни знакомые обёртки: @State предоставляет доступ к состоянию SwiftUI и Binding-проекцию, @Published — publisher. Наша Clamped сама по себе не вызывает перерисовку и не отправляет события. У @State жизненный цикл хранилища управляется SwiftUI; не приписывай ему устройство нашего простого value-wrapper.

## Итог: значение и признак последней записи

Собери самостоятельный пример. Начальный путь и setter ограничивают число одинаково, projectedValue показывает результат последнего запроса.

```swift
@propertyWrapper
struct Clamped {
    private var value: Int
    private var limited: Bool
    init(wrappedValue: Int) {
        value = min(100, max(0, wrappedValue))
        limited = value != wrappedValue
    }
    var wrappedValue: Int {
        get { value }
        set {
            value = min(100, max(0, newValue))
            limited = value != newValue
        }
    }
    var projectedValue: Bool { limited }
}
struct SoundSettings { @Clamped var volume = 50 }
var settings = SoundSettings()
settings.volume = 150
print(settings.volume, settings.$volume)
settings.volume = 70
print(settings.volume, settings.$volume)
```

Вывод 100 true, затем 70 false. Если положить второй @Clamped параметр в тот же struct, у него будет своя обёртка и свой limited; состояние не общее для всех свойств.

## Проверь себя

Раздели имя свойства, хранение и проекцию.

- Где реально лежит value нашего Clamped?
- Почему изменение copy не изменило volume?
- Почему $volume здесь Bool, а $state может быть Binding?

## Ответы к «Проверь себя»

- `value` лежит внутри скрытого `private` свойства `_volume` типа `Clamped`, которое компилятор создаёт за `@Clamped var volume`. Само `volume` своего хранения не имеет: оно читает и пишет `_volume.wrappedValue` — окно выдачи перед ящиком с механизмом. Поэтому у каждого свойства с `@Clamped` своя обёртка со своими `value` и `limited`.
- `Clamped` — struct, поэтому `var copy = _volume` создаёт отдельное значение, а не ссылку на хранилище. Setter `copy.wrappedValue = requested` ограничивает и сохраняет число в копии, а `_volume` остаётся прежним, и `volume` после `change(150)` равен 50. Чинится обычным путём `volume = requested` или явным присваиванием изменённой копии назад в `_volume`.
- `$volume` — это `projectedValue` обёртки, и его тип задаёт автор: у `Clamped` это `var projectedValue: Bool { limited }`, признак последнего ограничения. `@State` объявляет свою проекцию типа Binding, `@Published` — publisher. Знак `$` лишь открывает `projectedValue`, Binding он не обещает.

# ГЛУБЖЕ

## Инициализация через backing storage

В custom init владельца можно написать _volume = Clamped(wrappedValue: startingVolume). Это создаёт всю обёртку, а не только число. Изнутри типа backing storage доступен, снаружи он private. При таком пути сохраняй те же инварианты init обёртки.

## Доступ к projectedValue

Не делай private projectedValue, если projection нужна пользователю свойства: доступность projection связана с доступностью wrappedValue. При private(set) на свойстве наружная запись закрывается; явный метод владельца может менять wrappedValue и показывать вычисленную проекцию.

## Копия wrapper и общий объект

Для struct Clamped копия настроек имеет независимые value и limited. Если wrapper хранит ссылку на общий объект, копии могут разделять это состояние; @propertyWrapper само по себе не гарантирует value semantics, поточную безопасность или долговечное хранение.

## Свойства и ограничения синтаксиса

Не обещай, что wrapper можно повесить на любое let или произвольное computed-свойство. Наш пример — хранимое var с синтезированным доступом. Для сложной вложенности обёрток сначала раскрой типы wrappedValue/projectedValue и проверяй путь инициализации, вместо угадывания смысла нескольких @.
