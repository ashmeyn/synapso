---
mission: ОПЕРАЦИЯ 25 · СОХРАНИТЬ ЖУРНАЛ МЕЖДУ ЗАПУСКАМИ
scenario: Журнал хранит настройку компактного списка, черновик записи и токен входа. Настройка, текст и секрет должны попасть в подходящие хранилища, а ошибка записи — остаться видимой.
goals:
- Сохранить маленькую настройку в UserDefaults и отличить отсутствие ключа от false.
- Записать и прочитать черновик через файл, создав его каталог.
- Добавить или обновить токен в Keychain и обработать статусы чтения.
prereqs:
- codable
- err
- esc
---

## Что переживёт закрытие приложения

Давай назовём три разных данных: compactEntries — Bool, черновик — строка «Прогулка у реки», session token — секрет входа. Переменные в памяти исчезнут после завершения процесса, поэтому нужен отдельный выбор хранения.

Настройка пойдёт в UserDefaults, черновик — в файл, токен — в Keychain. Для них не требуется одна общая таблица. Настройка похожа на положение переключателя, файл — на документ, Keychain — на запираемый ящик для секрета.

## Пишем в лоб: отсутствие приняли за выбор

Сначала проверь маленькую ошибку без настоящего аккаунта. Используем отдельный учебный suite, то есть именованное пространство UserDefaults; очищаем только его.

```swift
import Foundation
let defaults = UserDefaults(suiteName: "dev.synapso.lesson.store")!
defaults.removePersistentDomain(forName: "dev.synapso.lesson.store")
print(defaults.bool(forKey: "compactEntries"))
print(defaults.object(forKey: "compactEntries") == nil)
defaults.set(false, forKey: "compactEntries")
print(defaults.bool(forKey: "compactEntries"))
print(defaults.object(forKey: "compactEntries") == nil)
defaults.removePersistentDomain(forName: "dev.synapso.lesson.store")
```

Вывод false, true, false, false. bool(forKey:) даёт false и при отсутствующем ключе, и при сохранённом false. Если требуется различать «не выбирал» и «выключил», сначала смотри object(forKey:). И не клади session token в UserDefaults: это хранилище настроек, не механизм защиты секретов.

## Настройка: маленькое значение по ключу

В приложении не очищай suite при каждом запуске. Сохрани выбор и читай тот же ключ; system API отвечает за сохранение настроек между запусками.

```swift
import Foundation
let defaults = UserDefaults.standard
defaults.set(true, forKey: "compactEntries")
let compact = defaults.bool(forKey: "compactEntries")
```

compact равен true. standard относится к настройкам текущего приложения; учебная проверка использует отдельный suite. Для значения по умолчанию можно применить register(defaults:): это резервное значение, а не сохранённый пользовательский выбор. Не вызывай synchronize как обязательный ритуал после set.

## Черновик: сначала каталог

Для проверочного запуска возьмём временный каталог. В рабочем журнале можно получить Application Support через FileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask); временный каталог не обещает долговременную сохранность.

```swift
func saveDraft(_ text: String, in directory: URL) throws {
    try FileManager.default.createDirectory(
        at: directory, withIntermediateDirectories: true)
    let file = directory.appendingPathComponent("draft.txt")
    try Data(text.utf8).write(to: file, options: .atomic)
}
```

Data(text.utf8) переводит строку в байты. createDirectory создаёт отсутствующий путь, options: .atomic просит сначала записать временный файл и заменить целевой при успешной записи. Это помогает не оставить наполовину записанный файл, но не делает несколько хранилищ общей транзакцией.

## Читаем тот же файл

saveDraft уже объявлена. Пройди запись и чтение: адрес и имя должны совпасть, иначе ты ищешь другую запись.

```swift
let directory = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString)
defer { try? FileManager.default.removeItem(at: directory) }
do {
    try saveDraft("Прогулка у реки", in: directory)
    let file = directory.appendingPathComponent("draft.txt")
    let text = try String(contentsOf: file, encoding: .utf8)
    print(text)
} catch { print("Не сохранено") }
```

Вывод «Прогулка у реки». defer выполнит уборку учебного каталога при выходе из этой области. В журнале постоянный черновик после чтения не удаляй. Ошибка записи не должна превратиться в сообщение «сохранено»; здесь catch сохраняет путь отказа.

## Токен: добавить или обновить

Теперь открой Security: это системный фреймворк для Keychain. Словарь query задаёт класс generic password и пару service/account — устойчивый адрес нашего секрета. CFDictionary — форма словаря для этих системных функций.

```swift
func saveSessionToken(_ token: String) -> OSStatus {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "dev.synapso.journal",
        kSecAttrAccount as String: "session"]
    var item = query
    item[kSecValueData as String] = Data(token.utf8)
    let status = SecItemAdd(item as CFDictionary, nil)
    if status == errSecDuplicateItem {
        let changes = [kSecValueData as String: Data(token.utf8)]
        return SecItemUpdate(query as CFDictionary, changes as CFDictionary)
    }
    return status
}
```

Контекст — import Foundation и import Security. SecItemAdd возвращает OSStatus, код результата. При errSecDuplicateItem обновляем существующую запись через SecItemUpdate; прочий отказ не выдаём за успех. Не удаляй старую запись заранее ради добавления новой: неудачный add после delete потеряет действующий токен.

## Отсутствие токена и ошибка — разные случаи

Не превращай любой статус в «вышел из аккаунта». Сначала обработай errSecItemNotFound как допустимое отсутствие; другие ошибки оставь вызывающему коду. Нужны Foundation, Security и `enum StorageError: Error { case keychain(OSStatus), invalidToken }`.

```swift
func readSessionToken() throws -> String? {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "dev.synapso.journal",
        kSecAttrAccount as String: "session",
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess else { throw StorageError.keychain(status) }
    guard let data = result as? Data,
          let token = String(data: data, encoding: .utf8)
    else { throw StorageError.invalidToken }
    return token
}
```

kSecReturnData просит байты, kSecMatchLimitOne — один результат. При успехе переводим Data в UTF-8 строку; повреждённые данные не называем отсутствием. При выходе из аккаунта SecItemDelete должен удалить только query этого service/account, а его статус тоже нужно проверить.

## Собираем сохранение журнала

Окей, совместим три записи без обещания общей атомарности. directory и defaults передаёт владелец приложения; функция не выбирает учебный путь за него.

```swift
import Foundation
import Security
func saveSessionToken(_ token: String) -> OSStatus {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "dev.synapso.journal",
        kSecAttrAccount as String: "session"]
    var item = query
    item[kSecValueData as String] = Data(token.utf8)
    item[kSecAttrAccessible as String] =
        kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    let status = SecItemAdd(item as CFDictionary, nil)
    if status == errSecDuplicateItem {
        let changes: [String: Any] = [kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String:
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        return SecItemUpdate(query as CFDictionary, changes as CFDictionary)
    }
    return status
}
func persistJournal(
    token: String, draft: String, directory: URL, defaults: UserDefaults
) throws {
    defaults.set(true, forKey: "compactEntries")
    let status = saveSessionToken(token)
    guard status == errSecSuccess else {
        throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
    }
    try FileManager.default.createDirectory(
        at: directory, withIntermediateDirectories: true)
    let file = directory.appendingPathComponent("draft.txt")
    try Data(draft.utf8).write(to: file, options: .atomic)
}
```

Функция ничего не печатает: возвращает Void только после успешных шагов или бросает ошибку. Настройка может уже сохраниться, даже если токен или файл не записались. UI должен сообщить отказ, а не рисовать общий успех заранее.

- Маленькая несекретная настройка — UserDefaults; токен — Keychain.
- Для файла выбирай назначение каталога и проверяй ошибки записи.
- Отсутствие значения, отказ доступа и повреждённые данные не одно и то же.

## Проверь себя

Без кода разложи три данных по местам и назови по одному отказу.

- Почему отсутствующий compactEntries и сохранённый false выглядят одинаково через bool(forKey:)?
- Почему .atomic не сохраняет токен и файл одной транзакцией?
- Что надо сделать при errSecDuplicateItem, а что — при errSecItemNotFound во время чтения?

## Ответы к «Проверь себя»

- `bool(forKey:)` всегда возвращает `Bool`, и для отсутствующего ключа подставляет `false`, поэтому «не выбирал» и «выключил» сливаются в одно значение. Отличить их можно только по наличию записи: `defaults.object(forKey: "compactEntries") == nil` верно лишь до первого `set`. Если экрану важно, делал ли пользователь выбор, сначала смотришь `object(forKey:)`, а `register(defaults:)` даёт лишь резервное значение, не сохранённый выбор.
- `.atomic` касается одного файла: сначала пишется временный файл, и целевой заменяется только при успешной записи, так что наполовину записанного черновика не останется. UserDefaults, Keychain и файл — три разных хранилища, и общей транзакции между ними нет. Поэтому в `persistJournal` настройка может уже сохраниться, когда токен или файл не записались, и UI должен сообщить об отказе, а не рисовать общий успех заранее.
- `errSecDuplicateItem` от `SecItemAdd` значит, что запись с этой парой service/account уже есть: обновляешь её через `SecItemUpdate(query as CFDictionary, changes as CFDictionary)`, а не удаляешь заранее, иначе неудачный add после delete потеряет действующий токен. `errSecItemNotFound` при `SecItemCopyMatching` — допустимое отсутствие, поэтому `return nil`. Любой другой статус не выдаёшь за «вышел из аккаунта», а бросаешь `StorageError.keychain(status)` вызывающему коду.

# ГЛУБЖЕ

## Защита и доступность

Не считай любой Keychain item доступным в любой момент. В финале при добавлении и обновлении задан kSecAttrAccessibleWhenUnlockedThisDeviceOnly: секрет доступен на разблокированном устройстве и не переносится на другое через восстановление резервной копии.

Для фоновой работы и требований продукта выбирается подходящая политика; не меняй её автоматически на менее строгую ради исчезновения ошибки. Keychain защищает хранение, но не делает токен безопасным для вывода в лог или отправки постороннему серверу.

## Documents, Application Support и Caches

Сначала спроси, может ли пользователь потерять эти данные. Документы пользователя и служебные постоянные файлы имеют разные назначения; Application Support подходит для внутреннего черновика, Documents — для пользовательских документов.

Caches предназначен для восстанавливаемых данных и может очищаться системой. temporaryDirectory тоже не постоянное хранилище. Резервное копирование, исключение из него и защита файлов задаются отдельно; слово «файл» не означает отсутствие требований к конфиденциальности.

## Формат и миграция

Если черновик стал Draft с id и текстом, используй Codable для записи модели, но проверь, как новый decoder прочитает прежние файлы. Добавление обязательного поля без миграции способно сломать загрузку старой версии.

Большую историю связанных записей не превращай в гигантскую строку UserDefaults. Там уместна база данных; размер, поиск и изменение отдельных записей — отдельные требования, а не повод выбрать Keychain для всего.

## Частичное сохранение

Пройди сценарий: настройка записалась, токен обновился, файл не записался. Ни .atomic у файла, ни успех SecItemUpdate не откатывают прежние два шага.

Определи, какие действия действительно должны быть согласованы, и показывай фактическое состояние. Для сложного процесса нужна отдельная стратегия восстановления. Повторные записи токена и черновика должны оставаться предсказуемыми по объявленному контракту.
