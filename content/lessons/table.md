---
mission: ОПЕРАЦИЯ 55 · КАТАЛОГ ИГР БЕЗ ЧУЖИХ ОБЛОЖЕК
scenario: Таблица показывает настольные игры, отмечает сохранённые и открывает выбранную игру. Переиспользованная строка должна полностью показывать новую игру, даже если старая обложка пришла позже.
goals:
- Подключить dataSource, зарегистрировать ячейку и вернуть её через dequeue.
- Полностью настроить состояние строки и отсеять устаревшую картинку по id.
- Обработать выбор через delegate и сохранить id выбранной игры.
prereqs:
- layout
- proto
- async
---

## Две игры и одна строка

В каталоге игра 61 «Маяки» сохранена, игра 62 «Остров» — нет. Одна и та же ячейка может позже показать другую игру. Сначала назови, что обязано смениться: название, отметка, обложка и id представляемой модели. Индекс строки — положение, не идентичность игры.

```swift
import UIKit
struct Game {
    let id: Int
    let title: String
    let saved: Bool
}
let games = [
    Game(id: 61, title: "Маяки", saved: true),
    Game(id: 62, title: "Остров", saved: false)
]
```

## Попытка в лоб: галочка не ушла

Если устанавливать галочку только для сохранённой игры, несохранённая унаследует прежнюю. Прочитай условие ниже: оно ничего не делает при `false`. Фрагмент — ошибочный метод внутри `GameCell`; `Game` уже объявлен.

```swift
func configure(_ game: Game) {
    textLabel?.text = game.title
    if game.saved { accessoryType = .checkmark }
}
```

Переиспользование похоже на многоразовую рамку: вставил новую карточку — убери все следы предыдущей. В правильной конфигурации каждой ветке данных соответствует явное состояние UI.

## Кто отвечает на вопросы таблицы

`UITableViewDataSource` сообщает количество строк и создаёт или получает ячейку для заданного `IndexPath`. В нашем каталоге одна секция, поэтому возвращаем число игр. Далее методы находятся внутри `GameSource` с объявленным `let games: [Game]`; покажи, как строка 1 приводит к игре 62.

```swift
func tableView(
    _ tableView: UITableView, numberOfRowsInSection section: Int
) -> Int { games.count }
func tableView(
    _ tableView: UITableView, cellForRowAt indexPath: IndexPath
) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(
        withIdentifier: "Game", for: indexPath
    ) as! GameCell
    cell.configure(games[indexPath.row])
    return cell
}
```

`dequeueReusableCell(withIdentifier:for:)` возвращает существующую подходящую ячейку или создаёт новую по регистрации. Приведение `as! GameCell` здесь допустимо только потому, что под этим identifier мы регистрируем именно этот класс.

## Регистрация до первого dequeue

Теперь свяжи таблицу с источником. Здесь уже объявлены `GameCell`, `GameSource` и `games`; их определения соберёшь в практике. `register` говорит таблице, какой класс создавать для identifier «Game». Сам identifier — имя типа переиспользуемых строк, а не id игры.

```swift
let table = UITableView(
    frame: CGRect(x: 0, y: 0, width: 320, height: 480), style: .plain
)
let source = GameSource(games: games)
table.register(GameCell.self, forCellReuseIdentifier: "Game")
table.dataSource = source
```

Сохрани `source`: свойство `dataSource` у таблицы слабое и не удерживает владельца. Обычно контроллер держит источник своим свойством. Не полагайся на скролл, чтобы проверить существование регистрации.

## Настрой всё, включая отсутствие картинки

Для класса `GameCell` объявлено `var representedID: Int?`. Метод ниже каждый раз задаёт название, галочку и пустую обложку. Остановись на `nil`: отсутствие новой картинки тоже состояние, его нужно установить явно. Затем приложение может запросить обложку по id.

```swift
func configure(_ game: Game) {
    representedID = game.id
    textLabel?.text = game.title
    accessoryType = game.saved ? .checkmark : .none
    imageView?.image = nil
}
```

`prepareForReuse` вызывает super и очищает временное состояние, например representedID или handle запроса. Основное содержимое всё равно полностью задавай в configure/cellForRowAt: корректность не должна зависеть только от вызова prepareForReuse.

## Подвох: старая обложка пришла последней

Ячейка уже показывает 62, а completion для 61 только сейчас получил картинку. Ни слабый захват, ни сам факт отмены запроса не подтверждают актуальность. Проверь `representedID` перед записью. Фрагмент использует уже определённый `GameCell`; `CoverSource.load(id:done:)` сохраняет callback, все вызовы выполняются на главном потоке.

```swift
@MainActor
func requestCover(cell: GameCell, id: Int, source: CoverSource) {
    source.load(id: id) { [weak cell] image in
        guard let cell, cell.representedID == id else { return }
        cell.imageView?.image = image
        cell.setNeedsLayout()
    }
}
```

`CoverSource` — локальный источник, не сеть; его определение дано в практике. В миссии на один id есть один незавершённый запрос. Для двух запросов одной и той же игры понадобится ещё версия запроса — это отдельная задача банка.

## Выбор — отдельная ответственность

`UITableViewDelegate` сообщает о выборе. Следующий метод находится внутри `GameSource`, который дополнительно реализует этот протокол и хранит `var selectedID: Int?`. Выбрав строку, сохрани id модели и сними визуальное выделение; открыть экран по этому id может координатор приложения.

```swift
func tableView(
    _ tableView: UITableView, didSelectRowAt indexPath: IndexPath
) {
    selectedID = games[indexPath.row].id
    tableView.deselectRow(at: indexPath, animated: false)
}
```

Также присвой `table.delegate = source`. Как и dataSource, delegate не служит сильным владельцем. Индекс строки может измениться после сортировки; id выбранной игры сохраняет смысл.

## Итог: минимальный источник без скролла

Перед async-обложками закрепи основу: источник возвращает количество и полностью настроенную стандартную ячейку. Это самостоятельное определение `GameSource`; для него регистрируй `UITableViewCell.self` под identifier «Game». В версии с обложками замени класс на `GameCell` и используй configure с проверкой id из предыдущих разделов.

```swift
import UIKit
struct Game {
    let id: Int
    let title: String
    let saved: Bool
}
final class GameSource: NSObject, UITableViewDataSource {
    let games: [Game]
    init(games: [Game]) { self.games = games }
    func tableView(
        _ tableView: UITableView, numberOfRowsInSection section: Int
    ) -> Int { games.count }
    func tableView(
        _ tableView: UITableView, cellForRowAt indexPath: IndexPath
    ) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(
            withIdentifier: "Game", for: indexPath
        )
        let game = games[indexPath.row]
        cell.textLabel?.text = game.title
        cell.accessoryType = game.saved ? .checkmark : .none
        cell.imageView?.image = nil
        return cell
    }
}
```

В ручной проверке создай таблицу с размером 320×480, сохрани source и вызови его методы для существующей строки. Отдельно настрой одну ячейку двумя моделями подряд: ручной вызов dataSource сам по себе не доказывает, что реальный скролл переиспользовал именно этот объект.

## Проверь себя

Восстанови три контракта перед написанием кода.

- Что таблица спрашивает у dataSource и зачем заранее register?
- Почему configure должен обработать saved=false и image=nil?
- Почему позднему ответу мало weak-захвата, а выбранной игре мало номера строки?

## Ответы к «Проверь себя»

- Таблица задаёт dataSource два вопроса: сколько строк в секции (`numberOfRowsInSection`) и какую ячейку показать для `IndexPath` (`cellForRowAt`). `register` заранее говорит, какой класс создавать под identifier «Game», поэтому `dequeueReusableCell(withIdentifier:for:)` либо вернёт свободную ячейку, либо создаст новую. Если регистрации нет, dequeue не знает, что строить, а `as! GameCell` держится только на том, что под этим identifier зарегистрирован именно `GameCell`.
- Ячейка переиспользуется, как многоразовая рамка: в ней остаются следы прошлой игры. Если ставить галочку только при `saved == true`, несохранённая игра унаследует чужую галочку, а без `imageView?.image = nil` — чужую обложку. Поэтому каждой ветке данных нужно явное состояние: `accessoryType = game.saved ? .checkmark : .none` и пустая обложка, пока своя не пришла.
- `[weak cell]` лишь не удерживает ячейку, но живая ячейка к этому моменту может показывать уже другую игру. Поэтому перед записью картинки сверяешь `cell.representedID == id` и отбрасываешь чужой ответ. Номер строки — положение, а не игра: после сортировки строка 1 станет другой, так что в `didSelectRowAt` сохраняешь `games[indexPath.row].id`.

# ГЛУБЖЕ

## Ручной источник и ручное переиспользование

Для количества и содержимого достаточно явно вызвать методы dataSource на таблице с заданным размером. Для чужой галочки используй одну ячейку: configure(saved=true), затем configure(saved=false). Для гонки настрой её на другую игру и доставь callbacks в известном порядке. Такой тест проверяет контракт кода; автоматический цикл скролла и выбора — отдельная проверка UIKit.

## prepareForReuse и отмена

Если тебя спросят, зачем prepareForReuse при полной конфигурации, назови временные ресурсы: отменить запрос, сбросить representedID, остановить анимацию. В override вызови super. Отмена кооперативна и не исключает позднего callback, поэтому проверку актуальности сохраняй. Не заставляй prepareForReuse быть единственным местом сброса всего содержимого.

## Повторный запрос для того же id

Теперь представь, что обложку игры обновили: два запроса для одного id пришли в обратном порядке. Одной проверки representedID недостаточно. Заведи монотонную версию запроса, захвати её при запуске и сравни перед применением. Этот номер идентифицирует запрос, а не модель; при переиспользовании тоже сделай старую версию недействительной.

## Diffable коротко

`UITableViewDiffableDataSource` описывает содержимое snapshot с идентификаторами секций и элементов и рассчитывает изменения таблицы. Это другой способ управления данными; он не отменяет настройку переиспользуемой ячейки и проверку async-ответа. Если позже перейдёшь на него, сохрани стабильный id игры, а не её изменяемое название.
