---
mission: ОПЕРАЦИЯ 54 · ЧИТАЛКА ПОЯВЛЯЕТСЯ СНОВА
scenario: Экран главы должен один раз создать подпись и полосу прогресса, обновлять название при каждом появлении и пересчитывать размеры после layout. Повторный вход не должен добавлять копии элементов или удерживать закрытый экран.
goals:
- Разнести создание элементов и повторное обновление по callbacks контроллера.
- Перенести расчёт размеров в viewDidLayoutSubviews и проверить повторный layout.
- Разорвать удержание контроллера замыканием и завершить таймер по его времени жизни.
prereqs:
- arc
- weak
---

## Одна глава, два появления

Открой главу, уйди на другой экран и вернись. Подпись должна показать актуальное название, а число элементов остаться прежним. Договоримся, что `loadChapter` — локальный синхронный источник строки: настоящая сеть не нужна. Сравни три задачи: создать элементы, обновить данные, расположить их.

## Пишем в лоб: ширина ещё нулевая

Если рассчитать полосу при загрузке, можно навсегда сохранить начальную ширину. Ниже `loadView` специально создаёт корневую view с нулевым размером, поэтому полоса получает ширину 0. После изменения размера корня этот код сам не пересчитает полосу.

```swift
import UIKit
final class ReadingController: UIViewController {
    let progressBar = UIView()
    override func loadView() { view = UIView(frame: .zero) }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.addSubview(progressBar)
        progressBar.frame = CGRect(
            x: 0, y: 0, width: view.bounds.width / 2, height: 4
        )
    }
}
```

В настоящем приложении исходный размер может быть другим. Баг в предположении, что размер из `viewDidLoad` уже окончательный, а не в обязательном нуле у каждой view.

## Как читать цепочку появления

Думай о контроллере как о комнате: мебель создаётся один раз, посетители приходят много раз. `loadView` создаёт или загружает корневую view; `viewDidLoad` вызывается после её загрузки. При обычном завершённом показе идут `viewWillAppear`, `viewIsAppearing`, `viewDidAppear`; при уходе — `viewWillDisappear`, `viewDidDisappear`. Попробуй произнести порядок, прежде чем выбирать место для кода.

Это не полный список событий: layout может происходить между callbacks и повторяться. Загрузка может случиться заранее через `loadViewIfNeeded`, без появления; отменённый интерактивный переход и контейнеры требуют отдельного разбора.

## Создать один раз

Добавь подпись в `viewDidLoad`, а не при каждом возвращении. Здесь «один раз» означает один цикл загрузки этой view, не один раз на всё приложение. Обычно UIKit загружает view контроллера один раз; новый контроллер получит свою. При переопределении стандартного callback вызывай `super`.

```swift
import UIKit
final class ReadingController: UIViewController {
    let titleLabel = UILabel()
    override func viewDidLoad() {
        super.viewDidLoad()
        titleLabel.text = "Глава 1"
        view.addSubview(titleLabel)
    }
}
```

Если сам создаёшь корневую view в `loadView`, присвой `view` и не вызывай `super.loadView` для второй загрузки. `viewDidLoad` не нужно вызывать руками в рабочем приложении.

## Обновить при возвращении

Источник мог изменить название, пока экран был скрыт. Перенеси чтение в `viewWillAppear`: оно повторится перед очередным показом. Следующий фрагмент — методы внутри `ReadingController`, где уже объявлены `titleLabel` и `loadChapter`.

```swift
override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    titleLabel.text = loadChapter()
}
```

`viewIsAppearing` полезен для обновления с уже актуальными геометрией и traits при появлении. Метод добавлен в SDK iOS 17, но доступен начиная с iOS 13. Он вызывается один раз за переход появления, в отличие от повторяющегося layout.

## Размеры после layout

Остановись на источнике ширины: это текущий `view.bounds.width`. Следующий метод принадлежит тому же контроллеру с уже добавленной `progressBar`. UIKit вызывает `viewDidLayoutSubviews` после размещения дочерних view; пересчёт безопасно повторять.

```swift
override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    progressBar.frame = CGRect(
        x: 0, y: 0, width: view.bounds.width / 2, height: 4
    )
}
```

На ширине 320 получится 160, на 200 — 100. Здесь ручные frame, без Auto Layout. Не добавляй элементы и не начинай загрузку в каждом layout: это другой контракт.

## Кто удерживает ушедший экран

Уход с экрана не равен освобождению: navigation stack, родитель или другая ссылка могут продолжать держать контроллер. `deinit` приходит, когда больше нет сильного владения. Проверь callback, который хранит сам контроллер: сильный `self` замыкает цикл. Ниже свойства и методы внутри контроллера: таймер увеличивает учебный счётчик `ticks`, а `stopTimer` завершает работу. Вызывай start после появления, stop после исчезновения; в `deinit` также отключи timer.

```swift
private var timer: Timer?
private var ticks = 0
func startTimer() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) {
        [weak self] _ in self?.ticks += 1
    }
}
func stopTimer() { timer?.invalidate(); timer = nil }
```

Для таймера с замыканием также нужен осмысленный захват. Если его работа нужна только видимому экрану, запускай после появления, отключай после исчезновения и защищай повторный start; `[weak self]` сам по себе таймер не останавливает.

## Итог: у каждой работы своё событие

Сначала назови три места по памяти, затем сравни с кодом. Элементы добавляются при загрузке, название читается перед появлением, размеры пересчитываются после layout. Источник должен возвращать строку синхронно на главном потоке; асинхронное обновление потребовало бы проверки актуальности ответа.

```swift
import UIKit
final class ReadingController: UIViewController {
    var loadChapter: () -> String = { "Глава 1" }
    let titleLabel = UILabel()
    let progressBar = UIView()
    override func viewDidLoad() {
        super.viewDidLoad()
        view.addSubview(titleLabel)
        view.addSubview(progressBar)
    }
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        titleLabel.text = loadChapter()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        titleLabel.frame = CGRect(
            x: 16, y: 16, width: max(0, view.bounds.width - 32), height: 24
        )
        progressBar.frame = CGRect(
            x: 16, y: 48, width: view.bounds.width / 2, height: 4
        )
    }
}
```

Для чтения порядка можно вызвать методы вручную в известной последовательности и записать лог. Такой тест проверяет наш код на этих вызовах; он не доказывает, что UIKit сам проведёт конкретный переход именно так.

## Проверь себя

Представь второе появление и изменение ширины. Назови событие, нужное каждой задаче, и причину выбора.

- Почему viewDidLoad не подходит для обновления названия при каждом возвращении?
- Почему вычисление frame в viewDidLoad может устареть?
- Почему viewDidDisappear не гарантирует deinit и weak-захват не заменяет invalidate?

## Ответы к «Проверь себя»

- `viewDidLoad` вызывается один раз за загрузку view, а возвращение на экран view заново не загружает. Источник мог сменить название, пока экран был скрыт, поэтому чтение ставишь в `viewWillAppear`: `super.viewWillAppear(animated)`, затем `titleLabel.text = loadChapter()`. В `viewDidLoad` остаётся только создание: `view.addSubview(titleLabel)`, иначе каждый показ добавлял бы копию.
- В `viewDidLoad` размер корня ещё не окончательный: в уроке `loadView` даёт `.zero`, и полоса навсегда получает ширину 0. Этот код больше не выполнится, поэтому после смены размера корня frame никто не пересчитает. Расчёт переносишь в `viewDidLayoutSubviews`: `progressBar.frame = CGRect(x: 0, y: 0, width: view.bounds.width / 2, height: 4)` — он повторяется после каждого layout и даёт 160 на 320 и 100 на 200.
- Уход с экрана не равен освобождению: navigation stack, родитель или другая ссылка могут держать контроллер, а `deinit` придёт только когда сильного владения не останется. `[weak self]` лишь не даёт замыканию держать контроллер, но повторяющийся `Timer` продолжит тикать, пока его не отключат. Поэтому `stopTimer()` с `timer?.invalidate(); timer = nil` вызываешь после исчезновения, перед start отключаешь старый таймер и дублируешь `invalidate` в `deinit`.

# ГЛУБЖЕ

## Ручной журнал без настоящего UI

Для учебной проверки задай события сам и посмотри журнал. Это модель последовательности, не `UIViewController`: никаких автоматических вызовов здесь нет. После неё полезно сопоставить имена с реальными overrides, а в приложении посмотреть фактический лог.

```swift
final class AppearanceLog {
    var events: [String] = []
    func record(_ event: String) { events.append(event) }
}
let log = AppearanceLog()
log.record("loadView")
log.record("viewDidLoad")
log.record("viewWillAppear")
log.record("viewIsAppearing")
log.record("viewDidAppear")
print(log.events.joined(separator: " -> "))
```

Для настоящего контроллера `loadViewIfNeeded` загружает view, если нужно. Если вызвать его повторно на той же загруженной view, он не должен повторять её создание; ручные вызовы appearance-методов лишь исполняют вызванные методы.

## viewIsAppearing и повторный layout

Раздели два вопроса: один показ и изменение геометрии. `viewIsAppearing` подходит для работы с актуальной view перед её показом; callback появился в SDK iOS 17 и поддерживает iOS 13+. `viewDidLayoutSubviews` может приходить несколько раз, включая изменения размеров уже видимой view. Если полосе нужна новая ширина при каждом layout, оставь расчёт там.

## Таймер: два разных окончания

Если счётчик нужен только видимому экрану, отключай таймер в `viewDidDisappear`; `deinit` оставь дополнительной очисткой. Перед новым start отключай прежний timer, иначе появятся две подписки на время. Повторяющийся таймер удерживается run loop; таймер с target/action сильно удерживает target, а таймер с блоком — свой callback. Callback может удерживать контроллер; используй `[weak self]` и `invalidate` по контракту. При временном скрытии остановка — решение продукта, а не универсальное правило UIKit.

## Жизненный цикл не заменяет архитектуру

Если тебя спросят, где хранить данные главы, не перечисляй callbacks вместо ответа. Контроллер организует показ, источник отвечает за данные. В `viewDidLoad` можно подключить зависимость, но повторные запросы, отмена и защита от устаревших ответов требуют своего правила. `Timer.publish` из Combine — альтернативный источник тиков с подпиской, которую тоже нужно завершать.
