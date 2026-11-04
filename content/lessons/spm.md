---
mission: ОПЕРАЦИЯ 69 · ПОЛИВ И СВОДКА С ОБЩИМ ЯДРОМ
scenario: Приложение для домашних растений отделяет правило полива от общей модели растения. Нужно собрать локальный пакет, открыть только нужный API и добавить сводку без обратной зависимости ядра от экранов.
goals:
- Собрать Package.swift с products, targets, dependencies и testTarget.
- Открыть межмодульный API через public, оставив детали internal.
- Добавить feature над core без цикла и выбрать диапазон версий зависимости.
prereqs:
- access
---

## Граница, которую будем проверять

Растение id=81 требует полива, 82 — нет. GardenCore описывает Plant, WateringFeature возвращает [81]. Модуль — отдельная область имён и доступа, обычно соответствующая одному Swift target. Пакет — как набор коробок с подписанными выходами: собрать коробки вместе недостаточно, нужный интерфейс ещё надо открыть.

```swift
public struct Plant {
    public let id: Int
    public let needsWater: Bool
    public init(id: Int, needsWater: Bool) {
        self.id = id
        self.needsWater = needsWater
    }
}
```

## Попытка в лоб: public тип без public init

Если у Plant убрать public у init, клиент другого модуля не сможет создать растение. Публичность типа не делает все его члены публичными; синтезированный memberwise-init структуры тоже не становится public автоматически. Ниже намеренно неверная граница: объявление компилируется в core, вызов Plant(id:needsWater:) из другого модуля — нет.

```swift
public struct Plant {
    public let id: Int
    public let needsWater: Bool
    init(id: Int, needsWater: Bool) {
        self.id = id
        self.needsWater = needsWater
    }
}
```

Исправляем именно init, а не ставим public перед каждым внутренним helper. id и needsWater открыты, потому что feature читает их; всё остальное может остаться internal.

## Package.swift: продукт не равен модулю

Начни с manifest — файла описания пакета. Первая строка задаёт минимальную tools version и доступную версию PackageDescription. products определяет то, что пакет отдаёт клиенту, targets — что собирается внутри. Наш продукт GardenKit содержит два модуля; в Swift импортируют GardenCore и WateringFeature, а не придуманное import GardenKit.

```swift
// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "GardenKit",
    products: [.library(name: "GardenKit",
                        targets: ["GardenCore", "WateringFeature"])],
    targets: [
        .target(name: "GardenCore"),
        .target(name: "WateringFeature", dependencies: ["GardenCore"])
    ]
)
```

Это полный стартовый manifest. Sources/GardenCore/Plant.swift хранит Plant, Sources/WateringFeature/WateringList.swift — код следующего раздела. Имя папки должно соответствовать target, если path не переопределён.

## Направление зависимости

WateringFeature зависит от GardenCore, поэтому может import GardenCore и читать его публичную модель. В обратную сторону ребра нет: core не знает экран полива. Пройди вручную [81=true,82=false]: filter оставляет 81, map извлекает id. Ниже файл Sources/WateringFeature/WateringList.swift, использующий Plant из core.

```swift
import GardenCore
public struct WateringList {
    public init() {}
    public func dueIDs(_ plants: [Plant]) -> [Int] {
        plants.filter { $0.needsWater }.map { $0.id }
    }
}
```

## Пакетная и целевая dependencies

У Package есть dependencies на другие пакеты, у target — зависимости на соседние targets и продукты внешних пакетов. Это разные списки. Для внешнего OrderedCollections мало указать URL: клиентский target ещё получает .product(name:package:). В локальном GardenKit внешний список пуст, потому что стандартных возможностей хватает.

```swift
let remote = Package.Dependency.package(
    url: "https://github.com/apple/swift-collections.git", from: "1.1.0"
)
let dependency = Target.Dependency.product(
    name: "OrderedCollections", package: "swift-collections"
)
```

Фрагмент продолжает manifest с import PackageDescription: remote помещается в dependencies пакета, dependency — в dependencies использующего target. Это пример декларации, не необходимость скачивать библиотеку ради полива.

## testTarget — отдельный клиент

Добавь testTarget WateringFeatureTests с dependencies GardenCore и WateringFeature. В Tests/WateringFeatureTests/WateringTests.swift тест импортирует оба модуля, создаёт растения и проверяет [81]. Обычный import проверяет публичный контракт; @testable import даёт доступ к internal при сборке с testability, но не меняет API для приложения.

```swift
import XCTest
import GardenCore
import WateringFeature
final class WateringTests: XCTestCase {
    func testDueIDs() {
        let plants = [Plant(id: 81, needsWater: true),
                      Plant(id: 82, needsWater: false)]
        XCTAssertEqual(WateringList().dueIDs(plants), [81])
    }
}
```

## Версии и Package.resolved

from: "1.1.0" допускает версии от 1.1.0 включительно до 2.0.0 исключительно; upToNextMinor(from: "1.1.0") — до 1.2.0 исключительно. Это диапазон допустимости, а не обещание отсутствия багов. Резолвер выбирает совместимое решение с учётом остальных ограничений, не обязательно максимальную версию при каждом build. Package.resolved записывает выбранные версии и revisions; для приложения сохраняй его в репозитории в принятом командой месте.

```swift
import PackageDescription
let url = "https://github.com/apple/swift-collections.git"
let majorRange = Package.Dependency.package(url: url, from: "1.1.0")
let minorRange = Package.Dependency.package(
    url: url, .upToNextMinor(from: "1.1.0")
)
```

Не редактируй resolved руками вместо изменения manifest. Обновление зависимости делай осознанно, с diff и тестами; файл с зафиксированным решением не отменяет диапазон в manifest.

## Итог: небольшой пакет с проверкой

Собери дерево из трёх файлов и теста: полный manifest ниже; Plant и WateringList — ровно из основы, WateringTests — из раздела теста. Запусти swift test в каталоге GardenKit. Это самостоятельный комплект, а не один Swift-файл: PackageDescription исполняется менеджером пакетов, исходники собираются по targets.

```swift
// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "GardenKit",
    products: [.library(name: "GardenKit",
                        targets: ["GardenCore", "WateringFeature"])],
    dependencies: [],
    targets: [
        .target(name: "GardenCore"),
        .target(name: "WateringFeature", dependencies: ["GardenCore"]),
        .testTarget(name: "WateringFeatureTests",
                    dependencies: ["GardenCore", "WateringFeature"])
    ]
)
```

В JSON ключах границы файлов обозначены строками // Файл: …; копируй содержимое каждого в соответствующий файл. Добавление GardenReport создаёт ещё одну feature→core, но не core→feature. Если graph стал циклическим, перенеси общую модель ниже или вынеси интерфейс; public не лечит цикл.

## Проверь себя

Нарисуй стрелки без manifest.

- Почему GardenKit как имя продукта не означает import GardenKit?
- Что нужно открыть у Plant, чтобы другой модуль создал и прочитал его?
- Чем отличается диапазон зависимости от версии в Package.resolved и где возник бы цикл?

## Ответы к «Проверь себя»

- Продукт в `products` — это то, что пакет отдаёт клиенту, а модуль — это target, отдельная область имён и доступа. `.library(name: "GardenKit", targets: ["GardenCore", "WateringFeature"])` лишь упаковывает два модуля в одну коробку с подписанным выходом. Поэтому в Swift-коде пишешь `import GardenCore` и `import WateringFeature`, а `import GardenKit` не найдёт модуля с таким именем.
- Открываешь сам тип (`public struct Plant`), свойства `public let id` и `public let needsWater`, которые читает feature, и явный `public init(id:needsWater:)`. Публичность типа не делает члены публичными, а синтезированный memberwise-init остаётся internal, поэтому без `public init` другой модуль не сможет вызвать `Plant(id:needsWater:)`. Внутренние helper при этом остаются internal: открываешь только то, что нужно клиенту.
- Диапазон в manifest — правило допустимости: `from: "1.1.0"` пускает версии до 2.0.0 исключительно, а `.upToNextMinor(from: "1.1.0")` — до 1.2.0. `Package.resolved` записывает конкретные версии и revisions, которые выбрал резолвер; его не правят руками вместо manifest. Цикл возник бы, если бы `GardenCore` начал зависеть от `WateringFeature` или сводки: стрелки идут только feature→core, а при цикле общую модель переносят ниже или выносят интерфейс — `public` цикл не лечит.

# ГЛУБЖЕ

## Зависимость, которую не стоит добавлять

Когда полив и сводка оба требуют Plant, не делай сводку зависимой от внутренностей полива. Общая модель уже в core, каждый feature может использовать её прямо. Если общая логика появилась позже, выделяй её по реальной обязанности, а не превращай core в склад всех классов приложения.

## Внутренний target без отдельного продукта

Не каждый target обязан быть перечислен как отдельный публичный продукт. Внутренний ParsingSupport может обслуживать WateringFeature; клиент всё равно использует объявленный продукт. При этом import и модификаторы доступа остаются вопросом модулей, а не названия продукта. Проверь, не просочился внутренний тип в публичную сигнатуру.

## Локальный пакет и публикация версии

Для соседнего пакета при разработке можно использовать .package(path: "../GardenCoreKit") вместо URL с версией. В опубликованном пакете путь к твоему Desktop не станет переносимой зависимостью: выбери доступный репозиторий и семантическую версию. Ресурсы объявляются отдельно через resources target; копирование картинки в Sources само по себе не описывает контракт доступа к ней.

## Тест internal и стоимость API

@testable помогает проверить внутреннее правило, но тест на public API лучше показывает обещание внешнему клиенту. Не делай DiskPath public ради теста: открытый тип становится обязательством поддержки. В Swift 5.9 есть и package-доступ между модулями одного пакета; это отдельная граница, а не замена public для стороннего приложения. Разделение может помочь переиспользованию, независимым тестам и инкрементальной сборке, но изменение общего API затронет клиентов: число targets само по себе не обещает ускорение.
