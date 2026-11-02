---
mission: ОПЕРАЦИЯ 68 · СЕАНС ПЕРЕРЫВА ПОД КОНТРОЛЕМ UI
scenario: Экран перерыва запускает и ставит сеанс на паузу, а тест должен проходить независимо от языка кнопки. Нужно задавать начальное состояние приложения, ждать наблюдаемый результат и отдельно проверять внешний вид по эталону.
goals:
- Написать XCUITest с launchArguments, identifier, tap и ожиданием результата.
- Вынести селекторы в Page Object и убрать зависимость от текста кнопки.
- Сравнить снимок с эталоном при фиксированной среде, отделив это от UI-сценария.
prereqs:
- tests
---

## Контракт между приложением и тестом

В приложении session.start обозначает кнопку запуска, session.pause — паузу, session.state — строку состояния. Fixture session-ready начинает с «Готово»; после start получаем «Работает», после pause — «Пауза». Identifier — как инвентарный номер: надпись можно перевести, но тест ищет тот же элемент. В этом уроке тестовый target компилируется; выполнение потребует приложение с этим контрактом.

```swift
import SwiftUI
struct SessionView: View {
    @State private var running = false
    var body: some View {
        VStack {
            Button("Начать") { running = true }
                .accessibilityIdentifier("session.start")
            Text(running ? "Работает" : "Готово")
                .accessibilityIdentifier("session.state")
        }
    }
}
```

Это минимальный app-фрагмент запуска, а не полное приложение с fixture и паузой. accessibilityIdentifier задаётся кодом приложения и не обязан озвучиваться как accessibilityLabel. Не путай технический identifier с доступным пользователю названием.

## Попытка в лоб: ищем русское слово

Для английского интерфейса кнопка имеет label=Start, identifier=session.start. Поиск app.buttons["Начать"] не находит её; tap по отсутствующему элементу не проверяет запуск, а приводит к ошибке теста. Не лечи это вторым селектором для каждого языка — поправь контракт поиска.

```swift
import XCTest
@MainActor
final class SessionTests: XCTestCase {
    func testStart() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing", "--fixture=session-ready"]
        app.launch()
        let start = app.buttons["Начать"]
        start.tap()
    }
}
```

## Запуск с подготовленными данными

XCUIApplication — прокси приложения, XCUIElement — прокси элемента его accessibility-дерева. Создай app, назначь launchArguments до launch, запусти. Эти аргументы сами не создают подмену: приложение читает ProcessInfo.processInfo.arguments и выбирает локальный источник. Если такого обработчика нет, тест остаётся с настоящими данными.

```swift
import XCTest
@MainActor
final class SessionTests: XCTestCase {
    func testStart() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing", "--fixture=session-ready"]
        app.launch()
        let start = app.buttons["session.start"]
        XCTAssertTrue(start.waitForExistence(timeout: 3))
    }
}
```

Для session-ready app очищает старый тестовый сеанс и не использует сеть. В release обработку служебных fixtures обычно отключают; в тестовой сборке ветку выбирают явно. Продолжать тест после неуспешного ожидания кнопки не стоит — получится каскад ошибок.

## Ждём элемент, затем его состояние

waitForExistence(timeout:) возвращает Bool, ожидая появления элемента до заданного предела; это не сон на три секунды. Появление строки состояния не означает, что её label уже «Работает»: она существовала ещё как «Готово». Для изменения label используем predicate expectation из XCTest, с тем же ограничением зависания. Функция ниже импортирует XCTest из предыдущего блока.

```swift
func waitForText(_ text: String, element: XCUIElement) -> Bool {
    let predicate = NSPredicate(format: "label == %@", text)
    let expectation = XCTNSPredicateExpectation(
        predicate: predicate, object: element
    )
    return XCTWaiter.wait(for: [expectation], timeout: 3) == .completed
}
```

После ожидания кнопки вызываем tap, затем waitForText("Работает", element: app.staticTexts["session.state"]). Проверяем наблюдаемый эффект действия, а не только существование кнопки.

## Page Object: одно место для селекторов

Когда несколько тестов запускают сеанс, вынеси взаимодействие в SessionPage. Это объект страницы, а не новая архитектура приложения: селекторы и действие живут рядом, сам тест говорит «стартуй». waitForText уже объявлен; здесь start возвращает false при отсутствии кнопки или неверном конечном состоянии.

```swift
import XCTest
@MainActor
struct SessionPage {
    let app: XCUIApplication
    var state: XCUIElement { app.staticTexts["session.state"] }
    func start() -> Bool {
        let button = app.buttons["session.start"]
        guard button.waitForExistence(timeout: 3) else { return false }
        button.tap()
        return waitForText("Работает", element: state)
    }
}
```

Оставляй требования в тесте: он проверяет успешный start. Не делай Page Object набором задержек и скрытых повторов; иначе не поймёшь, почему прошёл сценарий.

## Snapshot: сравнение, а не просто картинка

UI-тест отвечает «после tap сеанс работает». Snapshot-тест сравнивает изображение нужного состояния с утверждённым эталоном и обнаруживает изменение вида: обрезанную подпись, отступ, размер. Такой тест полезен для компонентов и статичных состояний, где важны вёрстка и стиль. Зафиксируй устройство, OS, scale, язык, Dynamic Type и тему; убери анимации и меняющиеся время/данные. Снимок без сравнения — только диагностическое вложение.

```swift
let shot = app.screenshot()
let attachment = XCTAttachment(screenshot: shot)
attachment.lifetime = .keepAlways
add(attachment)
```

Фрагмент находится внутри XCTestCase с уже запущенным app. В практике используем собственный минимальный raster для строгого сравнения размеров и RGBA-пикселей с PNG-эталоном. Это учебная реализация без сторонней библиотеки; реальному набору обычно нужны diff-изображение, выбранный допуск и процесс принятия эталонов.

## Подвох: смена среды похожа на регрессию

Если шрифт или OS изменились, отличие картинки ещё не доказывает баг приложения. Сначала сравни метаданные среды и открой diff; не нажимай «перезаписать все эталоны». При полезном изменении дизайна человек принимает новый эталон, при случайном дрейфе исправляют среду. PNG-файлы не сравниваем как байты архива: сравниваем декодированные пиксели и размер.

## Итог: запуск, действие, результат

Самостоятельный UI-тест ниже использует контракт экрана. waitForText — из основы; в ключах практики функция включена целиком. Нет реального времени сеанса: запуск меняет состояние локально. Для snapshot есть отдельный тест и эталон, который нельзя честно сгенерировать без выбранного приложения и среды.

```swift
import XCTest
@MainActor
final class SessionTests: XCTestCase {
    func testStart() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing", "--fixture=session-ready"]
        app.launch()
        let start = app.buttons["session.start"]
        guard start.waitForExistence(timeout: 3) else {
            XCTFail("Нет session.start")
            return
        }
        start.tap()
        let state = app.staticTexts["session.state"]
        XCTAssertTrue(waitForText("Работает", element: state))
    }
}
```

Для запуска нужен UI Testing Bundle target, связанный с host app. @MainActor задаёт исполнителя тестовых методов. Компиляция target проверяет API, но не доказывает наличие identifiers, работу launchArguments или совпадение screenshot.

## Проверь себя

Предложи проверку вместо задержки.

- Кто создаёт session.start и кто обрабатывает launchArguments?
- Почему ожидание существования session.state недостаточно после tap?
- Что ещё нужно кроме screenshot, чтобы назвать проверку snapshot-тестом?

# ГЛУБЖЕ

## exists не равно isHittable

Кнопка может существовать, но находиться за другим элементом или вне видимой области. Когда tap падает, сначала проверь дерево и перекрытие, затем нужный scroll или ожидание доступности. isHittable отвечает на другой вопрос, чем exists; случайный sleep не объясняет ни один из них.

## Синхронизация с состоянием приложения

XCUITest старается синхронизироваться с приложением, но постоянная анимация или фоновая работа может мешать стабильному ожиданию. Тестовый режим должен давать конечное наблюдаемое состояние. Не заменяй это обходом всех ошибок: predicate ожидание сохраняет понятный контракт и ограниченный timeout.

## Граница простого сравнения пикселей

Учебный raster в практике предполагает upright CGImage и приводит обе картинки к sRGB RGBA. Он строгий: один изменённый пиксель уже даёт отличие, даже если для глаза оно безвредно. Допуск следует выбирать обоснованно и хранить вместе с эталоном; слишком большой скроет регрессию. Размер сравнивают до интерпретации diff.

## Подмена не должна стать режимом пользователя

В app обработай два аргумента вместе, а в релизной сборке не включай тестовый источник. Настройки языка и Dynamic Type фиксируй средствами тестовой среды либо явно поддерживаемой debug-конфигурацией приложения. Сама строка --fixture=games-large не увеличивает шрифт: соответствующий обработчик должен это делать.
