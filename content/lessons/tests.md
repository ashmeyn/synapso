---
mission: ОПЕРАЦИЯ 65 · КНИЖНАЯ ПОЛКА БЕЗ СЛУЧАЙНЫХ ТЕСТОВ
scenario: Книжная полка показывает название книги и сохраняет выбранный id в избранное. Нужно проверить результат, ошибку и факт сохранения локально, независимо от сети и порядка тестов.
goals:
- Написать XCTest на результат и ошибку по схеме arrange, act, assert.
- Подменить источник протоколом и проверить вызовы сохранения шпионом.
- Изолировать состояние через setUp/tearDown и проверить async-функцию.
prereqs:
- di
- proto
---

## Какое обещание проверяем

Книга id=71 называется «Орбита», id=72 отсутствует. Сначала запиши два обещания: text возвращает название найденной книги, а отсутствие даёт missing. Избранное сохраняет найденный id ровно один раз; при ошибке ничего не сохраняет. Тест — как контрольный пример для калькулятора: задаёшь известный вход и проверяешь обещанный результат.

```swift
struct Book: Equatable { let id: Int; let title: String }
enum ShelfError: Error, Equatable { case missing }
protocol BooksLoading { func load(id: Int) throws -> Book }
struct BooksStub: BooksLoading {
    let values: [Int: Book]
    func load(id: Int) throws -> Book {
        guard let value = values[id] else { throw ShelfError.missing }
        return value
    }
}
```

## Попытка в лоб: тесты делят полку

Если testPin выполнится первым, testEmpty получит [71] вместо []. Не лечи это переименованием тестов: порядок не должен быть условием корректности. Ниже баг не в XCTAssertEqual, а в общем static-состоянии. XCTestCase группирует тесты; методы test… запускаются тестовым runner.

```swift
import XCTest
final class SharedPins { var ids: [Int] = [] }
final class OrderTests: XCTestCase {
    static let pins = SharedPins()
    func testEmpty() { XCTAssertEqual(Self.pins.ids, []) }
    func testPin() {
        Self.pins.ids.append(71)
        XCTAssertEqual(Self.pins.ids, [71])
    }
}
```

## Три шага одного теста

arrange готовит вход и зависимости, act вызывает проверяемое действие, assert сравнивает результат с контрактом. BookTitle ниже получает источник, как в DI. После него тест из следующего блока сначала готовит книгу, затем получает text, затем проверяет «Орбита». sut — сокращение system under test, объект проверки.

```swift
struct BookTitle {
    let source: any BooksLoading
    func text(id: Int) throws -> String {
        try source.load(id: id).title
    }
}
```

Тест помещают в test target проекта; в отдельном модуле обычно нужен @testable import имени приложения. Здесь проверяемый код и тесты представлены вместе, поэтому импорт приложения не требуется.

```swift
import XCTest
final class TitleTests: XCTestCase {
    func testTitle() throws {
        let source = BooksStub(values: [71: Book(id: 71, title: "Орбита")])
        let sut = BookTitle(source: source)
        let result = try sut.text(id: 71)
        XCTAssertEqual(result, "Орбита")
    }
}
```

## Ошибка тоже результат

Не ограничивайся проверкой «что-то бросилось». XCTAssertThrowsError принимает синхронное throwing-выражение, а замыкание позволяет сверить конкретную ошибку. Для пустого BooksStub отсутствие не превращается в пустую строку; BookTitle и BooksStub уже объявлены.

```swift
import XCTest
final class MissingTests: XCTestCase {
    func testMissing() {
        let sut = BookTitle(source: BooksStub(values: [:]))
        XCTAssertThrowsError(try sut.text(id: 72)) { error in
            XCTAssertEqual(error as? ShelfError, .missing)
        }
    }
}
```

## Стаб отвечает, шпион записывает

BooksStub — стаб: даёт подготовленный ответ вместо настоящего источника. PinsSpy — шпион: записывает обращения, чтобы ты проверил эффект. Словом mock часто называют любые подмены; точнее mock задаёт ожидаемое взаимодействие. Выбирай подмену по вопросу теста, а не ради названия.

```swift
protocol PinsSaving { func save(id: Int) }
final class PinsSpy: PinsSaving {
    private(set) var ids: [Int] = []
    func save(id: Int) { ids.append(id) }
}
```

PinBook использует объявленный контракт; сохранение начинается только после успешного load.

```swift
struct PinBook {
    let source: any BooksLoading
    let pins: any PinsSaving
    func execute(id: Int) throws {
        let book = try source.load(id: id)
        pins.save(id: book.id)
    }
}
```

На id=71 source возвращает Book, затем pins получает 71. На id=72 load бросает ошибку, выполнение до save не доходит. Проверяй и аргумент, и число вызовов: [71] обнаружит лишнюю запись, contains(71) — нет.

## Новая фикстура на каждый тест

Фикстура — подготовленное состояние теста. Для общих свойств создавай её в setUp перед каждым методом, освобождай в tearDown после него. Ниже SharedPins уже объявлен; это замена shared static, а не способ заставить testEmpty быть первым.

```swift
final class FreshTests: XCTestCase {
    var pins: SharedPins!
    override func setUp() {
        super.setUp()
        pins = SharedPins()
    }
    override func tearDown() {
        pins = nil
        super.tearDown()
    }
    func testEmpty() { XCTAssertEqual(pins.ids, []) }
}
```

Вызовы super сохраняют поведение базового класса. Не делай вывод, что tearDown стирает любую глобальную переменную: ты сам определяешь, чем владеет фикстура.

## async: ждём результат, не секунды

Для асинхронного источника объяви метод теста async throws. await ждёт завершение операции; sleep и настоящий сервер для этого не нужны. BookDetails получает BookDetailsLoading, DetailsStub возвращает «Космос» для 71 и бросает missing для 72. Для async-ошибки используй do/catch и XCTFail на неожиданном успехе, как в практике.

```swift
protocol BookDetailsLoading {
    func subtitle(id: Int) async throws -> String
}
struct DetailsStub: BookDetailsLoading {
    func subtitle(id: Int) async throws -> String {
        guard id == 71 else { throw ShelfError.missing }
        return "Космос"
    }
}
```

BookDetails делегирует запрос этому источнику.

```swift
struct BookDetails {
    let source: any BookDetailsLoading
    func text(id: Int) async throws -> String {
        try await source.subtitle(id: id)
    }
}
```

```swift
import XCTest
final class AsyncTitleTests: XCTestCase {
    func testSubtitle() async throws {
        let sut = BookDetails(source: DetailsStub())
        let value = try await sut.text(id: 71)
        XCTAssertEqual(value, "Космос")
    }
}
```

Синхронный XCTAssertThrowsError не принимает await внутри своего autoclosure. Сначала дождись результата и затем вызови утверждение, либо перехвати ошибку явно.

## Итог: небольшое правило, два края

Собери маленький самостоятельный тест полки: одинаковый id не увеличивает число книг. В первом методе есть все три шага; второй проверяет пустой вход. XCTest сравнивает результат, а не внутренний выбор Set: реализация может измениться при сохранённом обещании.

```swift
import XCTest
struct ShelfCount {
    func total(_ ids: [Int]) -> Int { Set(ids).count }
}
final class ShelfCountTests: XCTestCase {
    func testDuplicate() {
        let sut = ShelfCount()
        let result = sut.total([71, 71, 72])
        XCTAssertEqual(result, 2)
    }
    func testEmpty() {
        XCTAssertEqual(ShelfCount().total([]), 0)
    }
}
```

Не проверяй тривиальный getter только ради процентов покрытия, внутренние private-детали, работу стандартного Set или настоящего сервера этим unit-тестом. Проверяй собственные правила, границы и эффекты; сеть и UI требуют других проверок.

## Проверь себя

Объясни ход без кода.

- Какие вход, действие и утверждение нужны для найденной и отсутствующей книги?
- Почему [71] у шпиона сильнее, чем contains(71)?
- Как убрать зависимость от порядка и проверить async без ожидания реальных секунд?

## Ответы к «Проверь себя»

- Для найденной книги arrange — `BooksStub(values: [71: Book(id: 71, title: "Орбита")])` и `BookTitle(source:)`, act — `try sut.text(id: 71)`, assert — `XCTAssertEqual(result, "Орбита")`. Для отсутствующей arrange — пустой `BooksStub(values: [:])`, а act и assert сливаются в `XCTAssertThrowsError(try sut.text(id: 72))` с замыканием `XCTAssertEqual(error as? ShelfError, .missing)`. Сверяешь именно `.missing`, потому что «что-то бросилось» пропустит чужую ошибку, а отсутствие не должно превращаться в пустую строку.
- Шпион записывает каждое обращение, поэтому `XCTAssertEqual(spy.ids, [71])` проверяет сразу аргумент и число вызовов. `contains(71)` пройдёт и на `[71, 71]`, и на `[71, 72]`, то есть пропустит двойное или лишнее сохранение. Обещание «сохранить найденный id ровно один раз» ловит только точный массив, а для ошибочного пути — `[]`.
- Порядок уходит вместе с общим `static`-состоянием: каждый тест получает свою фикстуру, которую `setUp` создаёт заново (`pins = SharedPins()`), а `tearDown` освобождает, оба с вызовом `super`. Переименование тестов ради порядка не лечит, порядок не должен быть условием корректности. Async проверяешь методом `func testSubtitle() async throws` с `try await sut.text(id: 71)` над стабом `DetailsStub`: `await` ждёт завершения операции, без `sleep` и сервера, а ошибку ловишь `do/catch` с `XCTFail` на неожиданном успехе.

# ГЛУБЖЕ

## Время как зависимость

Если появится дневной лимит чтения, не вызывай Date() прямо в тестируемом правиле. Передай источник текущего времени и подставь фиксированное значение: отдельно проверь минуту до границы и саму границу. Так тест проверяет твоё сравнение, а не скорость компьютера.

## Ошибка подмены и лишние взаимодействия

Стаб должен уметь вернуть не только успех. Добавь источник, который бросает недоступность, и проверь, что PinBook не вызывает PinsSaving. Не сравнивай каждую внутреннюю операцию: число обращений важно, когда это контракт, например одна запись, но порядок вспомогательных вычислений часто можно менять.

## Callback API и ожидания XCTest

Если источник ещё использует completion, создай expectation, выполни fulfill в callback и дождись fulfillment(of:timeout:) в async-тесте. timeout здесь ограничивает зависший тест, а не задаёт момент исполнения; sleep не является доказательством завершения. Не блокируй главный исполнитель синхронным wait в async-коде.

## Swift Testing — другой синтаксис проверки

На toolchain Swift 6+ тот же контракт можно записать через @Test и #expect. Не смешивай эти макросы с XCTAssert внутри одного стиля; для нового набора проверь поддержку платформы и runner. Ниже новый тест той же полки, а не повтор итогового счётчика.

```swift
import Testing
@Test func missingBook() {
    let sut = BookTitle(source: BooksStub(values: [:]))
    #expect(throws: ShelfError.missing) {
        try sut.text(id: 72)
    }
}
```
