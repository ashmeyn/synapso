---
mission: ОПЕРАЦИЯ 63 · ОДИН СПИСОК ЗАМЕТОК В РАЗНЫХ АРХИТЕКТУРАХ
scenario: Экран показывает названия неархивных заметок и обновляется после изменения данных. Сравним один контракт в MVC, MVP и MVVM, затем определим границу use case и репозитория для более сложного приложения.
goals:
- Отделить данные, состояние представления и отображение на одном экране.
- Проверить presenter или view model без UIKit, включая пустой список.
- Вынести сценарий в use case с зависимостью на внутренний контракт репозитория.
prereqs:
- mvvm
- solid
---

## Один вход для честного сравнения

Заметка 41 «План» активна, 42 «Список» архивная; экран должен показать только «План». Не меняй задачу при смене архитектуры. Аналогия: одна и та же посылка через три службы доставки — содержимое одно, меняется, кто принимает, кто хранит и кто вручает. В примерах NotesScreen — обычный контекст отображения без UIKit, не UIViewController. Он позволяет видеть маршруты данных и проверять роли отдельно от настоящих UI-адаптеров.

```swift
let notes = [
    Note(id: 41, title: "План", archived: false),
    Note(id: 42, title: "Список", archived: true)
]
```

Note и NotesLoading объявлены следующим блоком.

```swift
struct Note { let id: Int; let title: String; let archived: Bool }
protocol NotesLoading { func load() -> [Note] }
final class MemoryNotes: NotesLoading {
    var notes: [Note]
    init(_ notes: [Note]) { self.notes = notes }
    func load() -> [Note] { notes }
}
func activeTitles(_ notes: [Note]) -> [String] {
    notes.filter { !$0.archived }.map { $0.title }
}
```

В реальном приложении данные заметок принадлежат модели/источнику; массив строк — состояние представления.

## Пишем в лоб: контроллер берёт всё

В UIKit-контроллер легко сложить чтение файла, фильтр, форматирование и создание UILabel. Тогда проверка правила требует UI, а изменение источника затрагивает экран. Это риск Massive View Controller, не обязательная судьба MVC. Посмотри короткий пример сцепления, затем выдели независимое правило.

```swift
import UIKit
final class NotesController: UIViewController {
    func show(_ notes: [Note]) {
        let label = UILabel()
        label.text = notes.filter { !$0.archived }
            .map { $0.title }.joined(separator: ", ")
        view.addSubview(label)
    }
}
```

Это до-фрагмент с уже объявленным Note. При повторном show он также добавляет новую подпись; создание элементов и повторное обновление нужно разделять.

## MVC: координатор показа не обязан быть огромным

Для контекста после разделения уже существуют source: NotesLoading и screen: NotesScreen. Controller получает событие reload, читает модель и передаёт результат view. У UIKit-MVC эту роль часто выполняет UIViewController; сам доменный фильтр можно проверять без него. Разложи модель и представление по разным причинам изменения.

```swift
final class NotesController {
    let source: any NotesLoading
    let screen: NotesScreen
    init(source: any NotesLoading, screen: NotesScreen) {
        self.source = source; self.screen = screen
    }
    func reload() { screen.render(activeTitles(source.load())) }
}
```

Здесь контроллер — обычный класс ручного контекста. Экран хранит отображённые titles, источник — Note. MVC не запрещает выносить сервисы и тестируемые функции.

## MVP: presenter говорит view, что показать

В passive-view варианте MVP view сообщает события и отображает переданные значения. Presenter хранит titles, получает данные и вызывает контракт NotesViewing, не UILabel. Слабая view не создаёт обратного сильного владения; владелец UI отдельно держит view и presenter. Сравни этот маршрут с предыдущим.

```swift
final class NotesPresenter {
    let source: any NotesLoading
    weak var view: (any NotesViewing)?
    private(set) var titles: [String] = []
    init(source: any NotesLoading) { self.source = source }
    func reload() {
        titles = activeTitles(source.load())
        view?.render(titles)
    }
}
```

Протокол NotesViewing и тестовый экран:

```swift
protocol NotesViewing: AnyObject { func render(_ titles: [String]) }
final class NotesScreen: NotesViewing {
    private(set) var titles: [String] = []
    func render(_ titles: [String]) { self.titles = titles }
}
```

Тест подставляет NotesScreen; другие варианты MVP могут распределять обязанности иначе.

## MVVM: view читает готовое состояние

В MVVM состояние titles живёт в NotesViewModel. View подписывается на изменения и отображает их; она не обязана передавать модели собственные UIKit-элементы. В простом контексте событие обновления — onChange; в SwiftUI это может быть Observation. Назови, кого можно проверить без создания view.

```swift
final class NotesViewModel {
    let source: any NotesLoading
    private(set) var titles: [String] = []
    var onChange: (([String]) -> Void)?
    init(source: any NotesLoading) { self.source = source }
    func reload() {
        titles = activeTitles(source.load())
        onChange?(titles)
    }
}
```

Когда UIKit-адаптер хранит model и callback model обращается к адаптеру, используй слабый захват. Название view model само по себе не гарантирует отделение UI.

## VIPER: роли вместо пяти пустых файлов

Для того же списка Entity — Note, Interactor выполняет сценарий получения активных заметок, Presenter готовит состояние, View отображает, Router организует переходы. Спроси, какая обязанность реально нужна сейчас. Количество файлов не является тестируемостью; VIPER описывает роли и границы, а не магическую защиту от связности.

## Clean: исходные зависимости идут внутрь

Clean отделяет правила и use cases от UI и инфраструктуры. Контракт репозитория определяется потребностями внутреннего сценария, внешний адаптер реализует его. Ниже ActiveNotes получает NotesRepository, возвращает сущности и не импортирует UIKit или конкретную базу. Во время исполнения он вызывает адаптер, но исходная зависимость остаётся на внутренний протокол.

```swift
protocol NotesRepository { func all() -> [Note] }
struct ActiveNotes {
    let repository: any NotesRepository
    func execute() -> [Note] { repository.all().filter { !$0.archived } }
}
struct MemoryRepository: NotesRepository {
    let notes: [Note]
    func all() -> [Note] { notes }
}
```

Это маленький участок границы, не полный шаблон Clean. Presenter/адаптер превращает результат в строки. VIPER и Clean можно сочетать; это не пять взаимоисключающих списков классов.

## Итог: проверяем состояние, выбираем по задаче

Восстанови модель входа и view model ниже; UI для теста не нужен. Для небольшой команды и простого экрана достаточно ясных границ MVC или MVVM. MVP полезен для явного теста presenter через view-контракт; дополнительные роли VIPER/Clean оправдывай сложностью сценариев, независимой разработкой и ценой сопровождения. На собесе объясни компромисс, не объявляй единственного победителя.

```swift
struct Note { let id: Int; let title: String; let archived: Bool }
protocol NotesLoading { func load() -> [Note] }
final class MemoryNotes: NotesLoading {
    var notes: [Note]
    init(_ notes: [Note]) { self.notes = notes }
    func load() -> [Note] { notes }
}
func activeTitles(_ notes: [Note]) -> [String] {
    notes.filter { !$0.archived }.map { $0.title }
}
final class NotesViewModel {
    let source: any NotesLoading
    private(set) var titles: [String] = []
    var onChange: (([String]) -> Void)?
    init(source: any NotesLoading) { self.source = source }
    func reload() {
        titles = activeTitles(source.load())
        onChange?(titles)
    }
}
```

Реальный binding, навигация и UIKit отображение проверяются отдельно. Независимость этого состояния доказывается компиляцией и исполнением без UIKit.

## Проверь себя

Закрой код и пройди один reload по трём вариантам.

- Кто получает Note, кто хранит titles и кто отображает в MVC, MVP и MVVM?
- Почему UILabel внутри view model снова связывает тест с UIKit?
- Почему интерфейс репозитория принадлежит use case, а не детали хранения?

## Ответы к «Проверь себя»

- Note во всех трёх вариантах приходит из `source.load()`, меняется только то, кто держит результат. В MVC контроллер читает модель и сразу передаёт `activeTitles` в `screen.render`, titles хранит экран; в MVP presenter сам хранит `titles` и командует слабой view через `NotesViewing`; в MVVM `titles` живут в view model, а view получает их через `onChange` и только отображает. Как посылка через три службы доставки: содержимое одно, а принимает, хранит и вручает каждый раз другой.
- Смысл view model — состояние, которое проверяется без создания view: `model.reload()` и сравнение `model.titles`. Если внутри появляется `UILabel`, модель снова знает конкретный UIKit-элемент, и тесту приходится его создавать и читать `label.text`. Название «view model» отделения от UI не гарантирует: модель отдаёт `[String]` через `onChange`, а отображает их адаптер.
- Clean направляет исходные зависимости внутрь: `ActiveNotes` описывает нужный ему `NotesRepository` с `all()` и не импортирует UIKit или конкретную базу. Внешний адаптер вроде `MemoryRepository` реализует этот контракт, поэтому при смене хранилища меняется адаптер, а правило `filter { !$0.archived }` и его тест остаются. Во время исполнения use case вызывает адаптер, но в коде он зависит только от своего протокола.

# ГЛУБЖЕ

## MVVM в SwiftUI: Observation вместо onChange

В SwiftUI-версии тот же NotesViewModel не нужен с ручным onChange: макрос @Observable отслеживает чтение titles в body, и view перерисуется сама. source и правило остаются прежними, поэтому тест модели не меняется.

```swift
import Observation
@Observable final class ObservedNotes {
    let source: any NotesLoading
    private(set) var titles: [String] = []
    init(source: any NotesLoading) { self.source = source }
    func reload() { titles = activeTitles(source.load()) }
}
```

NotesLoading и activeTitles объявлены в основе. Observation меняет способ доставки изменений, а не границу ответственности: модель всё так же не знает о Text и List.

## Как худеет Massive View Controller

Если тебя спросят, можно ли тестировать MVC, ответь: независимые правила и адаптеры можно; MVC не означает UIKit в каждой функции. Типичные шаги разгрузки контроллера: вынести источник данных таблицы в отдельный объект, правила — в чистые функции или сервисы, сетевые и файловые вызовы — за протокол, крупные части экрана — в дочерние контроллеры. Контроллер остаётся связующим звеном жизненного цикла и событий. Смена архитектуры на MVVM или VIPER без такого разделения ответственности переносит ту же массу в другой файл.

## Ошибки и пустота — разные состояния

Пустой список — успешный результат без элементов; ошибка репозитория не обязана превращаться в пустоту. Если операция throws, use case передаёт или осмысленно преобразует ошибку, а presenter выбирает понятное состояние экрана. Не добавляй catch{return []} ради зелёного теста.

## Сборка и владелец

Composition root связывает источник, presenter/model и view. Удержи их по времени жизни экрана, направь обратное событие слабо. DI — способ собрать этот граф; архитектурное название не делает его автоматически правильным. При реальном UI добавь соответствующую изоляцию главного потока.
