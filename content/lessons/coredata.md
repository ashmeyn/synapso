---
mission: ОПЕРАЦИЯ 74 · ДОМАШНИЕ ЗАДАЧИ В КОНТЕКСТЕ
scenario: Трекер домашних задач сохраняет записи и показывает только невыполненные в понятном порядке. Нужно проверить сохранение и откат, а фоновое завершение передать между контекстами без чужого NSManagedObject.
goals:
- Собрать in-memory NSPersistentContainer и выполнить fetch с predicate и sort.
- Сохранить изменения и откатить несохранённое состояние после ошибки.
- Работать через очередь контекста и передать постоянный objectID вместо объекта.
prereqs:
- store
- codable
---

## Сущность — схема, объект — запись

Задача 101 «Пол» не выполнена, 102 «Посуда» выполнена. Сущность описывает поля, TaskRecord — экземпляр NSManagedObject с управляемыми свойствами; @NSManaged предоставляет реализации через Core Data. Context — как рабочий черновик редактора: изменения есть в нём, но ещё не обязательно зафиксированы в store. Здесь id — наш идентификатор задачи, objectID — отдельная идентичность Core Data.

```swift
import CoreData
@objc(LabTaskRecord)
final class TaskRecord: NSManagedObject {
    @NSManaged var id: Int64
    @NSManaged var title: String
    @NSManaged var done: Bool
}
```

## Пишем в лоб: вставили, но не сохранили

После insert запись видна своему context, но другой новый context не обязан её увидеть: insert не равен save. Не делай вывод о диске по этому уроку: store намеренно in-memory. save фиксирует в нём изменения, а после уничтожения всего такого stack данные исчезают. В production выбирают постоянный store, здесь проверяем семантику без файла.

## Стек без xcdatamodeld

NSPersistentContainer собирает model, coordinator и contexts. Для лаборатории создаём model кодом, без внешнего файла. field делает обязательный атрибут, makeModel связывает entity с классом TaskRecord. Эти определения нужны во всех ключах практики.

```swift
func field(_ name: String, _ type: NSAttributeType) -> NSAttributeDescription {
    let value = NSAttributeDescription()
    value.name = name
    value.attributeType = type
    value.isOptional = false
    return value
}
```

```swift
func makeModel() -> NSManagedObjectModel {
    let entity = NSEntityDescription()
    entity.name = "TaskRecord"
    entity.managedObjectClassName = NSStringFromClass(TaskRecord.self)
    entity.properties = [field("id", .integer64AttributeType),
                         field("title", .stringAttributeType),
                         field("done", .booleanAttributeType)]
    let model = NSManagedObjectModel()
    model.entities = [entity]
    return model
}
```

Три обязательных поля соответствуют @NSManaged свойствам. Этот пример сам не обеспечивает уникальность бизнес-id: входы урока уникальны, для импорта нужно отдельное правило обновления.

## In-memory container и готовность store

Ниже makeContainer создаёт NSInMemoryStoreType. shouldAddStoreAsynchronously=false делает загрузку store синхронной для этой локальной модели, callback сохраняет ошибку, которую мы выбрасываем. В приложении асинхронная загрузка должна сообщить готовность до первого fetch; не подменяй её sleep.

```swift
func makeContainer() throws -> NSPersistentContainer {
    let container = NSPersistentContainer(name: "Tasks",
                                          managedObjectModel: makeModel())
    let description = NSPersistentStoreDescription()
    description.type = NSInMemoryStoreType
    description.shouldAddStoreAsynchronously = false
    container.persistentStoreDescriptions = [description]
    var loadError: Error?
    container.loadPersistentStores { _, error in loadError = error }
    if let loadError { throw loadError }
    return container
}
```

viewContext использует main queue; newBackgroundContext даёт private queue. Это не «по контексту на каждый поток»: к контексту обращаются через его очередь, вызывая perform либо performAndWait.

## Insert, save и fetch — разные шаги

На очереди context вставь объект и задай обязательные поля. Затем try save, после — fetch с predicate done==NO и sort title, затем id для одинаковых названий. Ниже helper вставки; выполнять его нужно внутри блока контекста.

```swift
func insertTask(
    _ context: NSManagedObjectContext, id: Int64, title: String, done: Bool
) -> TaskRecord {
    let value = TaskRecord(context: context)
    value.id = id
    value.title = title
    value.done = done
    return value
}
```

Фильтр выбирает невыполненные, sort задаёт порядок, не меняя id. Определение запроса — отдельный шаг.

```swift
func pendingRequest() -> NSFetchRequest<TaskRecord> {
    let request = NSFetchRequest<TaskRecord>(entityName: "TaskRecord")
    request.predicate = NSPredicate(format: "done == NO")
    request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true),
                               NSSortDescriptor(key: "id", ascending: true)]
    return request
}
```

## Ошибка save и rollback

После успешного save title=«Пол». Если обязательный title станет nil через KVC, следующий save даст validation error, но контекст не станет чистым сам. Поймай ошибку, затем rollback отменит все его несохранённые изменения, не только последнее поле. При нормальном UI обычно не допускают такой ввод; здесь он даёт воспроизводимую ошибку для проверки отката.

## Фоновая работа: передаём идентичность

Нельзя взять TaskRecord из viewContext и менять его внутри writer.perform: это всё ещё объект очереди viewContext. На исходной очереди сначала save, получи постоянный objectID, передай только его. В writer.perform получи собственный объект через existingObject(with:), измени done и сохрани. existingObject может бросить ошибку, если объект недоступен; object(with:) может вернуть fault без такой проверки. Для отрисовки передай значения либо смержи изменения на очереди UI.

```swift
let writer = container.newBackgroundContext()
try writer.performAndWait {
    let task = try writer.existingObject(with: id) as! TaskRecord
    task.done = true
    try writer.save()
}
```

Фрагмент продолжает stack с уже сохранённой TaskRecord и её id типа NSManagedObjectID. as! здесь опирается на известную сущность из нашего входа, не подходит для произвольного чужого objectID. perform планирует блок, performAndWait ждёт завершение; не строй из него цепочку взаимного ожидания очередей.

## Итог: полный stack и результат

Полный самостоятельный пример ниже состоит из модели, сборки container, операций и запуска. Объедини блоки в один Swift-файл: внешней модели и файла базы нет. Все обращения к объектам — в performAndWait, ожидаемый результат [«Пол»].

```swift
import CoreData
@objc(LabTaskRecord)
final class TaskRecord: NSManagedObject {
    @NSManaged var id: Int64
    @NSManaged var title: String
    @NSManaged var done: Bool
}
func field(_ name: String, _ type: NSAttributeType) -> NSAttributeDescription {
    let value = NSAttributeDescription()
    value.name = name
    value.attributeType = type
    value.isOptional = false
    return value
}
func makeModel() -> NSManagedObjectModel {
    let entity = NSEntityDescription()
    entity.name = "TaskRecord"
    entity.managedObjectClassName = NSStringFromClass(TaskRecord.self)
    entity.properties = [field("id", .integer64AttributeType),
                         field("title", .stringAttributeType),
                         field("done", .booleanAttributeType)]
    let model = NSManagedObjectModel()
    model.entities = [entity]
    return model
}
```

```swift
func makeContainer() throws -> NSPersistentContainer {
    let container = NSPersistentContainer(name: "Tasks",
                                          managedObjectModel: makeModel())
    let description = NSPersistentStoreDescription()
    description.type = NSInMemoryStoreType
    description.shouldAddStoreAsynchronously = false
    container.persistentStoreDescriptions = [description]
    var loadError: Error?
    container.loadPersistentStores { _, error in loadError = error }
    if let loadError { throw loadError }
    return container
}
```

```swift
func insertTask(
    _ context: NSManagedObjectContext, id: Int64, title: String, done: Bool
) -> TaskRecord {
    let value = TaskRecord(context: context)
    value.id = id
    value.title = title
    value.done = done
    return value
}
func pendingRequest() -> NSFetchRequest<TaskRecord> {
    let request = NSFetchRequest<TaskRecord>(entityName: "TaskRecord")
    request.predicate = NSPredicate(format: "done == NO")
    request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true),
                               NSSortDescriptor(key: "id", ascending: true)]
    return request
}
```

```swift
let container = try makeContainer()
let context = container.viewContext
let titles = try context.performAndWait {
    _ = insertTask(context, id: 101, title: "Пол", done: false)
    _ = insertTask(context, id: 102, title: "Посуда", done: true)
    try context.save()
    return try context.fetch(pendingRequest()).map { $0.title }
}
assert(titles == ["Пол"])
```

Сохранённость здесь проверяется новым context того же container, не перезапуском приложения и не SQLite. После фона viewContext может держать старое значение: в практике refresh(mergeChanges:true) явно читает обновление; в приложении настрой подходящее merge изменений.

## Проверь себя

Проследи владельца до обращения к полю.

- Почему insert и fetch своего context ещё не доказывают сохранение?
- Что отменяет rollback после ошибки и какой порядок даёт sort?
- Почему perform чужого context не переносит в него объект и какой id можно передать?

## Ответы к «Проверь себя»

- Insert меняет только черновик — сам context, поэтому его собственный fetch видит запись ещё до save. Другой context того же container видит только то, что зафиксировано в store через `try context.save()`. Поэтому доказательство сохранения — чтение из `newBackgroundContext()` после save; и даже оно в уроке проверяет in-memory store, а не диск и не перезапуск приложения.
- Неудачный save сам контекст не чистит: несохранённые правки так и остаются в нём. В `catch` вызываешь `context.rollback()`, и он отменяет все несохранённые изменения этого context, возвращая его к последнему save, а не только сломанное поле. Порядок задаёт `sortDescriptors`: сначала `title` по возрастанию, при одинаковом названии — `id` по возрастанию, так что результат стабилен, а predicate `done == NO` лишь отбирает невыполненные.
- `perform` только выполняет блок на очереди writer, а `TaskRecord` из viewContext по-прежнему принадлежит viewContext и его очереди. Поэтому на исходной очереди сначала `save()`, чтобы `objectID` стал постоянным, и передаёшь только его. В `writer.perform` получаешь собственный объект `try writer.existingObject(with: id)`, меняешь `done` и сохраняешь writer.

# ГЛУБЖЕ

## Временный и постоянный objectID

Новый объект сначала может иметь temporary objectID. obtainPermanentIDs(for:) выдаёт постоянные идентификаторы, но сам не сохраняет запись; другому context всё равно нужны доступные сохранённые данные. Поэтому пример сначала save, затем передача. Бизнес-id нужен для API и импорта, objectID — для Core Data конкретного store.

## Слияние не равно передаче объекта

automaticallyMergesChangesFromParent помогает viewContext принимать сохранения связанных contexts, но не разрешает читать их NSManagedObject с main. Если два context меняют одну запись, выбери merge policy по продуктовым правилам; не обещай, что last write автоматически решает смысловой конфликт. reset выбрасывает зарегистрированное состояние: сохрани нужные DTO до него, не читай прежние объекты после.

## SwiftData: похожие обязанности, другой API

Для SwiftUI на iOS 17+ SwiftData предлагает @Model и ModelContainer; локальная модель ниже описывает ту же задачу, а конфигурация снова in-memory. У ModelContext своя изоляция, это не NSManagedObjectContext с perform. mainContext используй на MainActor; autosave не заменяет явный save там, где нужно подтверждение результата.

```swift
import Foundation
import SwiftData
@Model final class LocalTask {
    var title: String
    var done: Bool
    init(title: String, done: Bool = false) {
        self.title = title
        self.done = done
    }
}
```

```swift
@MainActor func makeSwiftData() throws -> ModelContainer {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    return try ModelContainer(for: LocalTask.self, configurations: config)
}
```

Core Data подходит, когда нужен существующий stack, тонкое управление contexts, миграциями и интеграцией. SwiftData удобна при принятом SwiftUI-подходе и подходящем минимальном OS; проверь необходимые возможности и миграцию своего продукта, не выбирай только по числу строк.

## Query и готовый container

@Query читает модели из ModelContext окружения SwiftUI и обновляет результат запроса. Передай ModelContainer через .modelContainer(container) у приложения/родителя, иначе свойство само store не соберёт. Ниже View использует LocalTask предыдущего раздела; это пример декларации, не запущенный экран.

```swift
import SwiftUI
import SwiftData
struct LocalTasksView: View {
    @Query(filter: #Predicate<LocalTask> { !$0.done }, sort: \LocalTask.title)
    private var tasks: [LocalTask]
    var body: some View { List(tasks) { Text($0.title) } }
}
```
