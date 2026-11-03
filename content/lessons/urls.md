---
mission: ОПЕРАЦИЯ 24 · ЗАГРУЗИТЬ НАЗВАНИЕ ГЛАВЫ
scenario: Экран аудиокниги запрашивает главу 12 и показывает её название только после успешного HTTP-ответа и разбора JSON. Ошибка сервера не должна выглядеть как загруженная глава.
goals:
- Выполнить GET через URLSession с try await и получить данные вместе с ответом.
- Проверить HTTP-статус до декодирования и различить три причины отказа.
- Передать сессию снаружи и не вернуть результат после обнаруженной отмены.
prereqs:
- rest
- codable
- err
---

## Что должен увидеть слушатель

Давай зафиксируем контракт: GET /chapters/12 при успехе отвечает именно 200 и JSON {"id":12,"title":"Первый снег"}. Экран ждёт название, а не просто любые байты; 503 означает отказ сервера, даже если тело случайно похоже на карточку.

Адрес example.invalid учебный. В уроке показываем клиентскую функцию, а локальные проверки подставляют ответ без обращения к внешнему сервису. Ошибка и пустое название — разные результаты.

## Пишем в лоб: доверились одному JSON

Посмотри, что делает этот фрагмент внутри async-функции. request и session уже заданы; Chapter — модель с id и title.

```swift
let (data, _) = try await session.data(for: request)
let chapter = try JSONDecoder().decode(Chapter.self, from: data)
return chapter
```

При 503 с тем же JSON функция вернёт главу: мы выбросили response и потеряли смысл ответа. URLSession обычно не бросает ошибку только из-за HTTP 4xx или 5xx. Сначала вернём проверку статуса, а потом разрешим JSON стать моделью.

## Разберём try await по словам

Не принимай await за команду остановить весь экран. async помечает функцию, которая может приостановить свою задачу; await обозначает такое место, а try нужен для возможной ошибки. Пока ждём сеть, поток не должен стоять заблокированным нашим ожиданием.

data(for:) получает URLRequest и возвращает пару: Data — байты тела, URLResponse — описание ответа. URLSession похожа на службу доставки: наличие посылки ещё не означает, что в ней именно заказанный товар. async не означает автоматически «каждая строка работает в фоне».

## Сначала модель и виды отказа

Окей, назовём отказы, которыми управляет клиент. Отдельно оставим транспортные ошибки URLSession и DecodingError от JSONDecoder: не будем превращать их все в пустую главу.

```swift
import Foundation
struct Chapter: Decodable { let id: Int; let title: String }
enum LoadError: Error {
    case invalidID, invalidURL, notHTTP
    case status(Int)
}
```

invalidID — наша проверка входа, notHTTP — ответ не HTTP, status хранит код сервера. Конструкция `case status(Int)` уже знакома из enum: причина отказа несёт нужное число. Для чтения тела достаточно Decodable.

## Не декодируй отказ сервера

Теперь восстановим правильный порядок. response пока имеет общий тип; `as?` пробует получить HTTPURLResponse, а guard останавливает путь при неудаче.

```swift
func decodeChapter(data: Data, response: URLResponse) throws -> Chapter {
    guard let http = response as? HTTPURLResponse else { throw LoadError.notHTTP }
    guard http.statusCode == 200 else { throw LoadError.status(http.statusCode) }
    return try JSONDecoder().decode(Chapter.self, from: data)
}
```

200 с правильным JSON даст Chapter. 503 с тем же JSON бросит status(503) до декодера. 200 со сломанной схемой бросит DecodingError. Не расширяй проверку до всех 2xx механически: наш endpoint не обещает JSON на 204.

## Подключим URLSession

Модель, LoadError и decodeChapter уже объявлены. Давай отправим GET; новый URLRequest по умолчанию имеет метод GET, Accept задаёт предпочтение формата ответа.

```swift
func loadChapter(
    id: Int, session: URLSession = .shared
) async throws -> Chapter {
    guard id > 0 else { throw LoadError.invalidID }
    let address = "https://api.example.invalid/chapters/\(id)"
    guard let url = URL(string: address) else {
        throw LoadError.invalidURL
    }
    var request = URLRequest(url: url)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    let (data, response) = try await session.data(for: request)
    return try decodeChapter(data: data, response: response)
}
```

Вызывающий код тоже должен находиться в async-контексте: `let chapter = try await loadChapter(id: 12, session: session)`. Оберни вызов в do/catch, чтобы выбрать ответ при отказе. session передаётся параметром и по умолчанию равна .shared. Это позволяет отдельной проверке дать собственную сессию. Не вызывай функцию на учебном адресе ради получения главы: реального API здесь нет.

## Пройди отказ и отмену

Вручную пройди три ответа: 200 с правильными полями → название; 503 → LoadError.status; 200 с title: 7 → DecodingError. Отсутствие сети или таймаут раньше этой проверки может дать URLError. Ошибку покажи явно через do/catch в вызывающем коде.

Есть ещё отмена задачи: `try Task.checkCancellation()` бросает CancellationError, если флаг уже выставлен. Для переноса в ступени 6 поставь такую проверку до запроса и после await, перед возвратом модели. URLSession тоже поддерживает отмену; не считай её доказательством, что сервер ничего не успел сделать.

## Собираем загрузку

Проверь последовательность целиком: вход → адрес → сеть → HTTP → JSON. Эта функция возвращает модель и не меняет интерфейс.

```swift
import Foundation
struct Chapter: Decodable { let id: Int; let title: String }
enum LoadError: Error {
    case invalidID, invalidURL, notHTTP
    case status(Int)
}
func decodeChapter(data: Data, response: URLResponse) throws -> Chapter {
    guard let http = response as? HTTPURLResponse else { throw LoadError.notHTTP }
    guard http.statusCode == 200 else { throw LoadError.status(http.statusCode) }
    return try JSONDecoder().decode(Chapter.self, from: data)
}
func loadChapter(
    id: Int, session: URLSession = .shared
) async throws -> Chapter {
    guard id > 0 else { throw LoadError.invalidID }
    let address = "https://api.example.invalid/chapters/\(id)"
    guard let url = URL(string: address) else {
        throw LoadError.invalidURL
    }
    var request = URLRequest(url: url)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    let (data, response) = try await session.data(for: request)
    return try decodeChapter(data: data, response: response)
}
```

- Не выбрасывай response ради короткой строки декодирования.
- Проверяй успешный статус по контракту конкретного endpoint.
- Дай ошибке дойти до вызывающего кода; там выбирается сообщение и повтор.

## Проверь себя

Закрой итог и назови первый шаг, который останавливает каждый плохой ответ.

- Почему 503 с корректным JSON не должен дать Chapter?
- Что приостанавливает await и почему async не гарантирует главный поток для UI?
- Что изменит checkCancellation после await и чего она не отменяет на сервере?

## Ответы к «Проверь себя»

- `decodeChapter` берёт `response as? HTTPURLResponse` и требует `statusCode == 200` до `JSONDecoder`, поэтому 503 бросает `LoadError.status(503)` раньше, чем тело станет моделью. Контракт endpoint обещает главу только с 200, а URLSession обычно не бросает ошибку из-за 4xx или 5xx. Если выбросить `response` и декодировать сразу, отказ сервера будет выглядеть как загруженная глава.
- `await` отмечает место, где функция может приостановить свою задачу, пока ждёт сеть; экран и поток при этом не стоят заблокированными нашим ожиданием. `async` говорит только о возможной приостановке, а не о том, на каком потоке пойдут следующие строки: это не «всё в фоне» и не «всё на главном». Поэтому сетевой клиент возвращает модель или ошибку, а обновлять UI — забота вызывающего кода на главном потоке (`@MainActor`).
- `try Task.checkCancellation()` после `await` бросает `CancellationError`, если задачу уже отменили, пока шёл запрос. Так уже ненужная модель не вернётся экрану и отмена не превратится в успешный результат. Но запрос мог дойти до сервера, поэтому отмена на клиенте не доказывает, что сервер ничего не успел сделать.

# ГЛУБЖЕ

## Результат для экрана

Не добавляй изменение UI внутрь сетевого клиента. Состояние SwiftUI или UIKit обновляй в подходящем контексте MainActor; экран может вызвать клиента и обработать результат оттуда.

Task наследует контекст изоляции в предусмотренных языком случаях. Поэтому утверждение «Task всегда фоновый» неверно; равно как и обещание, что любой Task подходит для UI. Изоляцию нужно видеть в объявлении владельца или задачи.

## Своя конфигурация

Если главу проверяют без сети, передай URLSession с конфигурацией, у которой protocolClasses содержит локальный URLProtocol. Это способ перехватить запрос, вернуть статус и JSON и проверить именно клиентский путь.

В рабочем приложении своя конфигурация также задаёт кэш, cookies и таймауты. ephemeral не делает сервер анонимным и не заменяет проверку ошибок; она меняет сохранение части данных сессии.

## Data, download и upload

При выборе API сначала оцени размер результата. Название главы удобно получить через data(for:): тело окажется в памяти. Большую аудиозапись разумнее получать загрузкой в файл, а не собирать целиком ради одной строки.

upload предназначен для отправки данных; download отдаёт временный файл, который нужно перенести, если он должен сохраниться. Фоновые передачи требуют отдельной конфигурации и обработки жизненного цикла, а не просто одного Task.

## Запросы обгоняют друг друга

Представь, что слушатель выбрал главу 12, затем 13, а ответ 12 пришёл позже. Отмена прежней задачи полезна, но владелец экрана должен ещё сверять, что результат относится к актуальному выбору.

Не маскируй эту гонку одной проверкой HTTP. Успешный ответ может быть уже не нужен экрану. Автоматический повтор тоже зависит от операции: для создания ресурса сохрани правило из rest про неизвестный исход POST.
