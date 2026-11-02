---
mission: ОПЕРАЦИЯ 58 · КАТАЛОГ РАСТЕНИЙ ПО СТАБИЛЬНЫМ ID
scenario: Каталог домашних растений показывает карточки в две колонки и переносит избранное в отдельный раздел. Переименование растения не должно превращать его в новый элемент, а повторные id не должны попадать в snapshot.
goals:
- Построить snapshot с уникальными стабильными id и применить его к data source.
- Собрать compositional layout из item, group и section.
- Переместить элемент между секциями, сохранив уникальный id.
prereqs:
- table
- layout
---

## Что меняется, а что остаётся

Есть растение 71 «Фикус» и 72 «Кактус». Название можно исправить, id остаётся прежним. Сначала раздели две вещи: модель с содержимым и snapshot с порядком идентификаторов. snapshot — снимок состояния разделов и элементов для diffable data source.

```swift
import UIKit
enum Section: Hashable { case plants, favorites }
struct Plant {
    let id: Int
    var title: String
}
```

## Пишем в лоб: одно растение дважды

Если источник дважды прислал 71, это не две независимые карточки. В snapshot id должны быть уникальны среди всех элементов, даже разных секций; идентификаторы секций тоже уникальны. Не запускай повторный append как успешный пример: UIKit считает такое состояние недопустимым. Сначала проверь входы.

```swift
let ids = [71, 71]
print(Set(ids).count == ids.count)
```

Вывод — false. В этой миссии повтор считаем ошибкой данных, а не молча выбираем одну версию; этот контракт реализуешь письменно.

## Снимок хранит порядок id

Представь snapshot как список мест в каталоге с инвентарными номерами: подпись можно поменять, номер не меняется. Создай раздел прежде, чем добавлять в него элементы. Здесь уже объявлен Section; результат содержит один раздел и id в заданном порядке.

```swift
var snapshot = NSDiffableDataSourceSnapshot<Section, Int>()
snapshot.appendSections([.plants])
snapshot.appendItems([71, 72], toSection: .plants)
assert(snapshot.itemIdentifiers == [71, 72])
```

Int уже Hashable. Если сделать изменяемую модель идентификатором с синтезированными Equatable/Hashable, изменение title сделает значение другим элементом; дело не в случайном значении hash.

## Ячейка читает содержимое отдельно

В следующих фрагментах store — словарь Int → Plant. CellRegistration описывает настройку ячейки по типу и id; создавай регистрацию заранее, не заново внутри provider. Здесь UICollectionViewListCell используется как простая карточка с подписью, а не как требование list-layout.

```swift
let registration = UICollectionView.CellRegistration<
    UICollectionViewListCell, Int
> { cell, _, id in
    var content = UIListContentConfiguration.cell()
    content.text = store[id]?.title ?? "Неизвестное растение"
    cell.contentConfiguration = content
}
```

При каждом вызове handler берёт актуальное название из store. Это не отменяет правила полного сброса содержимого и защиты async-картинок из темы table.

## Связываем data source и apply

Уже существуют collectionView, registration и snapshot. provider получает id, а не модель из текущего номера массива, и возвращает настроенную ячейку. Сохрани dataSource у владельца экрана: collection view не заменяет сильное владение источником.

```swift
let dataSource = UICollectionViewDiffableDataSource<Section, Int>(
    collectionView: collectionView
) { view, path, id in
    view.dequeueConfiguredReusableCell(
        using: registration, for: path, item: id
    )
}
dataSource.apply(snapshot, animatingDifferences: false)
```

apply передаёт новое состояние diffable data source. Здесь без анимации различий; это не обещание завершённого рисования экрана в следующей строке.

## Раскладка: item, group, section

Теперь собери геометрию снизу вверх. item описывает одну карточку, group — две карточки в строке, section — повторение таких строк. fractionalWidth у item считается от содержащей группы; у group — от содержащей области секции. estimated — исходная оценка, а не фиксированная или минимальная высота.

```swift
let itemSize = NSCollectionLayoutSize(
    widthDimension: .fractionalWidth(0.5), heightDimension: .estimated(80)
)
let item = NSCollectionLayoutItem(layoutSize: itemSize)
let groupSize = NSCollectionLayoutSize(
    widthDimension: .fractionalWidth(1), heightDimension: .estimated(80)
)
let group = NSCollectionLayoutGroup.horizontal(
    layoutSize: groupSize, subitems: [item, item]
)
let section = NSCollectionLayoutSection(group: group)
let layout = UICollectionViewCompositionalLayout(section: section)
```

По 0.5 ширины дают две колонки без дополнительного spacing. Для роста по тексту нужна корректная self-sizing конфигурация ячейки; estimated сам по себе не создаёт constraints внутри контента.

## Переименование и перенос — разные изменения

При переименовании обнови store и вызови reconfigureItems для уже существующего id, затем apply: одинаковые id не сообщают data source, что текст поменялся. При переносе 72 в избранное не добавляй второй 72: сначала удали его из старого места и добавь в новую секцию. Попробуй назвать оба результата.

```swift
snapshot.appendSections([.favorites])
snapshot.deleteItems([72])
snapshot.appendItems([72], toSection: .favorites)
```

Фрагмент продолжает snapshot с 71 и 72 в plants. reconfigureItems доступен с iOS 15; он отмечает существующие элементы для повторной настройки, не создаёт новые id.

## Итог: проверяем до UIKit

Сначала проверим все id через Set; при повторе бросим свой Swift Error до построения snapshot. Это не перехват внутреннего исключения UIKit. Затем создадим секцию и добавим порядок id. Восстанови пустой и повторный вход, прежде чем смотреть итог.

```swift
import UIKit
enum Section: Hashable { case plants, favorites }
struct Plant {
    let id: Int
    var title: String
}
enum SnapshotError: Error { case duplicateID(Int) }
func checkedIDs(_ plants: [Plant]) throws -> [Int] {
    var seen = Set<Int>()
    for plant in plants {
        guard seen.insert(plant.id).inserted else {
            throw SnapshotError.duplicateID(plant.id)
        }
    }
    return plants.map { $0.id }
}
func makeSnapshot(
    _ plants: [Plant]
) throws -> NSDiffableDataSourceSnapshot<Section, Int> {
    let ids = try checkedIDs(plants)
    var snapshot = NSDiffableDataSourceSnapshot<Section, Int>()
    snapshot.appendSections([.plants])
    snapshot.appendItems(ids, toSection: .plants)
    return snapshot
}
```

makeSnapshot([]) создаёт пустую секцию, повтор id вызывает duplicateID. Хранение содержимого, provider и layout остаются отдельными частями экрана.

## Проверь себя

Закрой код и объясни каждую границу.

- Почему title не должен определять идентичность карточки?
- Почему item с fractionalWidth(0.5) ещё нуждается в group и section?
- Как перенести id между секциями и как отдельно обновить его содержимое?

# ГЛУБЖЕ

## Уникальность через весь snapshot

Если тебя спросят про одинаковый id в двух секциях, ответ всё равно — недопустимый повтор. Для двух разных представлений одного объекта можно определить отдельный стабильный идентификатор представления, например пара role/id, но это уже другой контракт. В нашей миссии одна карточка растения имеет одно место.

## Self-sizing и estimated

Проверь, что контент ячейки имеет достаточные constraints по вертикали и правильно заданную ширину. item и group в примере имеют estimated-height; замена item-height на fractionalHeight может закрепить высоту внутри группы и помешать желаемому росту. Не предсказывай фактическую высоту только по оценке 80.

## Изменение ширины контейнера

Если нужны четыре колонки на широком экране, используй section provider и environment.container.effectiveContentSize.width. Это размер реального контейнера layout, не просто UIScreen.main.bounds. provider строит section по этим входам; его вызовы во время настоящей раскладки проверяются отдельно.

## Перестановка и обновление содержимого

snapshot умеет вставлять и удалять id, сохраняя модели в store. reconfigureItems отмечает повторную настройку контента существующей ячейки; при смене типа ячейки может понадобиться другой подход, например reloadItems. Сначала реши, меняется личность, место или только текст, затем выбери операцию.
