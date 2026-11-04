---
mission: ОПЕРАЦИЯ 07 · ИМПОРТ СОБЫТИЯ
scenario: Пользователь вставляет строку события. Нужно добавить его в календарь и показать точную причину отказа, если строка пуста или длительность не является числом.
goals:
- описать ожидаемые неудачи типом `Error` и функцией `throws`
- обработать ошибку через `do/catch` или передать выше
- объяснить, когда уместны `try?` и `Result`, а когда они скрывают нужную причину
---

## Смотрим на ввод

Формат одной строки: `Встреча:45`. Пользователь может вставить `Встреча:abc` или строку без названия. Здесь «не получилось» — нормальный исход ввода, и экрану нужна причина.

```swift
let line = "Встреча:45"
let parts = line.split(separator: ":", omittingEmptySubsequences: false)
```

## Пишем в лоб

Стажёр возвращает `nil` при любой проблеме. Экран умеет сказать только «ошибка», хотя пользователю нужно исправить конкретную строку.

```swift
func parseDuration(_ text: String) -> Int? {
    Int(text)
}
```

`Optional` сообщает, что значения нет. Для разных причин отказа выберем ошибку с именованными случаями.

## Описываем причины

`Error` — протокол для типов ошибок. Enum даёт нам конечный набор ожидаемых проблем этой операции.

```swift
enum EventImportError: Error {
    case wrongFormat
    case emptyName
    case invalidDuration
}
```

Это не текст для пользователя, а модель причины. Экран позднее переведёт её в понятную подсказку.

## Функция либо вернёт событие, либо бросит ошибку

Помечаем функцию `throws`. Если частей не две или длительность не превратилась в число, используем `throw`. Успешный путь возвращает пару.

```swift
func parse(_ line: String) throws -> (String, Int) {
    let parts = line.split(separator: ":", omittingEmptySubsequences: false)
    guard parts.count == 2 else { throw EventImportError.wrongFormat }
    let name = String(parts[0])
    guard !name.isEmpty else { throw EventImportError.emptyName }
    guard let minutes = Int(parts[1]) else {
        throw EventImportError.invalidDuration
    }
    return (name, minutes)
}
```

`throws` не означает, что функция всегда падает. Он означает, что вызывающий код обязан учесть оба исхода.

## Экран обрабатывает исход

У вызова бросающей функции пишем `try`. В `do/catch` отделяем известные ошибки календаря от прочих ошибок.

```swift
do {
    let item = try parse("Встреча:abc")
    print(item)
} catch EventImportError.invalidDuration {
    print("Проверь длительность")
} catch {
    print("Проверь формат строки")
}
```

Если экран не должен решать вопрос здесь, функция выше тоже может быть `throws` и передать ошибку дальше через `try`.

## Подвох: потеряли причину через try?

`try? parse(line)` превращает любой бросок в `nil`. Для проверки «можно ли вообще разобрать?» это нормально. Для нашего экрана импорта — плохо: он больше не знает, что именно исправить.

```swift
let maybeItem = try? parse("Встреча:abc") // nil
```

`try!` при ошибке завершит программу. Пользовательский ввод нельзя считать гарантированно правильным.

## Result: исход как значение

`Result<Success, Failure>` — enum с двумя случаями: `.success(значение)` и `.failure(ошибка)`. В отличие от `throws`, это не выход из функции, а обычное значение: его можно сохранить в свойство или передать в completion-обработчик, который вызовут позже, — и причина ошибки не потеряется.

```swift
let outcome = Result { try parse("Встреча:abc") }
switch outcome {
case .success(let item): print("Добавлено: \(item.0)")
case .failure(let error): print("Не добавлено: \(error)")
}
```

- `throws` — когда вызывающий код решает судьбу ошибки прямо сейчас.
- `try?` — когда причина не нужна и хватит `nil`.
- `Result` — когда исход нужно сохранить или передать дальше вместе с причиной.

## Что оставляем в импорте

```swift
enum EventImportError: Error { case wrongFormat, emptyName, invalidDuration }
func parse(_ line: String) throws -> (String, Int) {
    let parts = line.split(separator: ":", omittingEmptySubsequences: false)
    guard parts.count == 2 else { throw EventImportError.wrongFormat }
    let name = String(parts[0])
    guard !name.isEmpty else { throw EventImportError.emptyName }
    guard let minutes = Int(parts[1]) else {
        throw EventImportError.invalidDuration
    }
    return (name, minutes)
}
func importLine(_ text: String) -> String {
    do {
        let (name, minutes) = try parse(text)
        return "Добавлено: \(name), \(minutes)"
    } catch EventImportError.invalidDuration {
        return "Проверь длительность"
    } catch EventImportError.emptyName {
        return "Добавь название"
    } catch {
        return "Формат: название:длительность"
    }
}
```

- `throw` создаёт конкретный неуспех; `try` отмечает место вызова.
- `catch` переводит причину в действие для пользователя; `throws` передаёт её выше.
- `try?` бери, только когда точная причина действительно не нужна; `Result` — когда исход надо сохранить или передать.

## Проверь себя

- Что увидит экран при `Встреча:abc` и почему?
- Почему `try?` здесь хуже `do/catch` и когда вместо них подойдёт `Result`?
- Может ли вызов `parse("Встреча:45")` бросить ошибку по одной только пометке `throws`?

## Ответы к «Проверь себя»

- `parse` разделит строку на две части, название `Встреча` не пустое, но `Int("abc")` вернёт `nil`, и сработает `throw EventImportError.invalidDuration`. Его ловит отдельный `catch EventImportError.invalidDuration`, поэтому экран покажет подсказку про длительность — «Проверь длительность» и в примере `do/catch`, и в `importLine`. Пользователь узнаёт, что именно исправить.
- `try?` превращает любой брошенный `Error` в `nil`, и причина отказа теряется. Экран импорта уже не отличит пустое название от нечисловой длительности и сможет сказать только «ошибка». `do/catch` разбирает каждый случай `EventImportError` и даёт пользователю точную подсказку; `try?` годится, лишь когда причина действительно не нужна. `Result` нужен, когда исход надо сохранить или передать дальше, например в completion, — причина ошибки едет вместе с ним.
- Нет: `throws` означает только, что функция может бросить, а не что бросает всегда. Для `Встреча:45` все три `guard` пройдут, и `parse` вернёт `("Встреча", 45)`. Но `try` у вызова всё равно обязателен: компилятор заставляет вызывающий код учесть оба исхода.

# ГЛУБЖЕ

## Из Result обратно в throws

Сохранённый исход можно снова превратить в бросающий вызов: `try outcome.get()` вернёт значение или бросит сохранённую ошибку. Так `Result` из completion стыкуется с кодом на `do/catch`. Для синхронной `parse` хранить `Result` не нужно — ей достаточно `throws`.

```swift
let outcome: Result<(String, Int), Error> = Result {
    try parse("Встреча:45")
}
let item = try outcome.get()
```

## Ошибка и частичный импорт

Если импортируем десять строк, надо решить продуктовый вопрос: отклонять всё при одной плохой строке или принять девять и показать отчёт. Механизм `throws` не выбирает политику за нас; он лишь несёт причину отказа.

## Не превращай все ошибки в один текст

`catch { return "Что-то пошло не так" }` завершит обработку, но пользователь не поймёт, что исправить. Для ожидаемых ошибок ввода держи отдельные случаи; общий `catch` оставь запасным путём.
