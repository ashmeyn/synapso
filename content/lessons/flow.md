---
mission: ОПЕРАЦИЯ 05 · ЛЕНТА УВЕДОМЛЕНИЙ
scenario: Уведомления приходят списком. Нужно пропустить записи без ID, пометить срочные, остановиться после первых трёх показанных и дать каждому понятную подпись.
goals:
- использовать `guard` для раннего выхода из обработки записи
- выбрать `switch` для нескольких взаимоисключающих маршрутов
- различать `for-in`, `continue`, `break`, `while` и `repeat-while`
---

## Смотрим на вход

Каждая запись может не иметь ID: это испорченные данные, в ленту их отправлять нельзя. Приоритет принимает одно из трёх значений. Сначала описываем вход явно.

```swift
enum Priority { case normal, urgent, muted }
struct Notice {
    let id: Int?
    let priority: Priority
}
```

## Пишем в лоб

Стажёр вкладывает `if` в `if`, а внутри ещё один `if`. Рабочий путь оказывается справа от ошибок, и легко забыть один `else`. Нам нужен маршрут, в котором плохая запись выходит сразу.

```swift
func message(_ notice: Notice) -> String? {
    if let id = notice.id {
        if notice.priority != .muted {
            return "Уведомление \(id)"
        }
    }
    return nil
}
```

## Отсекаем запись через guard

`guard let` извлекает ID, а `else` обязан покинуть текущую функцию. После проверки `id` уже обычный `Int`.

```swift
func message(_ notice: Notice) -> String? {
    guard let id = notice.id else { return nil }
    return "Уведомление \(id)"
}
```

Это не замена любому `if`: `guard` хорош, когда условие должно быть истинным для дальнейшей работы.

## Выбираем подпись через switch

Теперь решаем, что делать с приоритетом. `switch` покрывает все случаи `Priority`; для отключённого возвращаем `nil`.

```swift
func message(_ notice: Notice) -> String? {
    guard let id = notice.id else { return nil }
    switch notice.priority {
    case .normal: return "Уведомление \(id)"
    case .urgent: return "СРОЧНО · \(id)"
    case .muted: return nil
    }
}
```

В Swift ветки не проваливаются одна в другую; `break` после каждого `case` не требуется. Добавим новый приоритет — компилятор попросит решить, как его обработать.

## Проходим список

`for-in` последовательно берёт записи из массива. Если `message` вернул `nil`, `continue` переходит к следующей записи. Это не то же самое, что `break`: он закончил бы весь цикл.

```swift
func firstMessages(_ notices: [Notice]) -> [String] {
    var result: [String] = []
    for notice in notices {
        guard let text = message(notice) else { continue }
        result.append(text)
        if result.count == 3 { break }
    }
    return result
}
```

Считаем именно показанные уведомления, а не первые три элемента входного массива.

## Подвох: первые три записи испорчены

Если поставить ограничение на индекс входа, три записи без ID съедят весь лимит. В нашем решении лимит проверяется после `append`, поэтому считаются только показанные.

> Если тебя спросят на собесе, уточни: «Первые три входящие или первые три успешно показанные?» Это разные требования.

## Что отправляем на экран

```swift
enum Priority { case normal, urgent, muted }
struct Notice { let id: Int?; let priority: Priority }
func message(_ notice: Notice) -> String? {
    guard let id = notice.id else { return nil }
    switch notice.priority {
    case .normal: return "Уведомление \(id)"
    case .urgent: return "СРОЧНО · \(id)"
    case .muted: return nil
    }
}
func firstMessages(_ notices: [Notice]) -> [String] {
    var result: [String] = []
    for notice in notices {
        guard let text = message(notice) else { continue }
        result.append(text)
        if result.count == 3 { break }
    }
    return result
}
```

- `guard` проверяет условие для продолжения и выводит проблемный путь наверх.
- `switch` выражает выбор из вариантов; для enum лучше явно покрыть все случаи.
- `continue` пропускает элемент, `break` завершает цикл.

## Проверь себя

- Где доступен `id` после `guard let`?
- Что произойдёт, если заменить `continue` на `break` при записи без ID?
- Почему лимит проверяется по `result.count`, а не по индексу входа?

# ГЛУБЖЕ

## Когда нужен while

`while` подходит, если условие остановки важнее самого контейнера, например лента пополняется и мы снимаем не более трёх готовых записей. За индексом и условием придётся следить самому; для готового массива `for-in` проще.

```swift
var index = 0
while index < notices.count && index < 3 {
    index += 1
}
```

## Когда нужен repeat-while

`repeat-while` выполняет тело хотя бы один раз и лишь потом проверяет условие. Для нашей очереди это плохой выбор: пустой список не должен запускать обработку. Используй его только когда первый шаг действительно обязателен.

## Фильтр в заголовке цикла

`for-in where` может отобрать часть входа. Но здесь фильтр не заменяет `message`: там одновременно проверяются ID и несколько состояний, а список ограничен тремя принятыми уведомлениями.

```swift
for notice in notices where notice.priority == .urgent {
    print(notice.id as Any)
}
```

Тот же `switch` умеет проверять не только enum: кортеж `(priority, id)`, диапазон ID и условие `where` можно объединить в одном шаблоне. Для нашего основного маршрута это было бы сложнее простого `guard` плюс `switch`. В Swift нет автоматического проваливания между case; явный `fallthrough` существует, но здесь не нужен.

```swift
func isEarlyUrgent(_ notice: Notice) -> Bool {
    switch (notice.priority, notice.id ?? -1) {
    case (.urgent, 1...9): return true
    default: return false
    }
}
```
