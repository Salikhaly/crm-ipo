# 📁 Настройка Google Drive — пошаговая инструкция

После настройки документы клиентов будут автоматически организованы так:

```
CRM — Документы клиентов/          ← корневая папка на Google Drive
├── Айгерим Байсейтова/             ← папка менеджера
│   ├── Иванов Петр_a3f29c/         ← папка клиента (ФИО + короткий ID)
│   │   ├── Справка_о_доходах.pdf
│   │   ├── Удостоверение_личности.jpg
│   │   └── ЭЦП_заёмщика.pdf
│   └── Петрова Анна_b8e41d/
│       └── Справка_о_доходах.pdf
├── Данияр Сейтов/
│   └── Сидоров Олег_c2f88a/
│       └── ...
└── Без менеджера/                  ← для клиентов без назначенного менеджера
    └── ...
```

Лимит файла — **20 МБ** (вместо текущих 2 МБ в base64).

---

## Шаг 1 — Создать проект в Google Cloud

1. Открой [console.cloud.google.com](https://console.cloud.google.com)
2. Сверху слева — выпадающий список проектов → **"New Project"**
3. Название: `CRM Drive Integration` → **Create**
4. Подожди 10-20 секунд пока проект создастся, выбери его в списке

---

## Шаг 2 — Включить Google Drive API

1. В левом меню → **"APIs & Services"** → **"Library"**
2. В поиске введи `Google Drive API`
3. Открой результат → нажми **"Enable"**

---

## Шаг 3 — Создать Service Account (служебный аккаунт)

1. **"APIs & Services"** → **"Credentials"**
2. **"Create Credentials"** → **"Service Account"**
3. Заполни:
   - Service account name: `crm-drive-bot`
   - Service account ID: оставь автозаполненный
4. **"Create and Continue"**
5. На шаге "Grant access" — **просто нажми "Continue"** (роли не нужны)
6. **"Done"**

---

## Шаг 4 — Создать JSON-ключ

1. В списке Service Accounts найди только что созданный `crm-drive-bot`
2. Нажми на него → вкладка **"Keys"**
3. **"Add Key"** → **"Create new key"**
4. Тип: **JSON** → **Create**
5. Файл `.json` скачается автоматически — **сохрани его**, он понадобится в Шаге 6

⚠️ Этот файл — как пароль. Никому не передавай, не публикуй в открытый репозиторий.

---

## Шаг 5 — Создать корневую папку на Google Drive и дать доступ

1. Открой [drive.google.com](https://drive.google.com) **под своим личным аккаунтом**
2. Создай новую папку, например: `CRM — Документы клиентов`
3. Открой скачанный в Шаге 4 JSON-файл — найди там поле `client_email`:
   ```json
   "client_email": "crm-drive-bot@crm-drive-integration.iam.gserviceaccount.com"
   ```
4. На созданной папке → правая кнопка → **"Share"** (Поделиться)
5. Вставь этот email → выбери роль **"Editor"** (Редактор) → **"Send"**

Без этого шага сервисный аккаунт не увидит папку и всё упадёт с ошибкой доступа.

---

## Шаг 6 — Получить ID корневой папки

1. Открой созданную папку на Google Drive
2. Посмотри на адрес в браузере:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz123456
   ```
3. Всё что после `/folders/` — это **ID папки**: `1AbCdEfGhIjKlMnOpQrStUvWxYz123456`

---

## Шаг 7 — Добавить переменные в Vercel

1. Открой проект на [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**
2. Добавь две переменные:

### `GOOGLE_DRIVE_ROOT_FOLDER_ID`
Значение — ID из Шага 6:
```
1AbCdEfGhIjKlMnOpQrStUvWxYz123456
```

### `GOOGLE_SERVICE_ACCOUNT_JSON`
Открой скачанный в Шаге 4 файл `.json` целиком, скопируй **весь его текст одной строкой** (без переносов строк — Vercel должен принять как есть, содержимое JSON может содержать `\n` внутри `private_key` — это нормально, не трогай).

Пример того что нужно вставить (сократил для примера):
```json
{"type":"service_account","project_id":"crm-drive-integration","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n","client_email":"crm-drive-bot@crm-drive-integration.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
```

3. Для обеих переменных выбери окружение **Production** (и Preview, если используешь)
4. **Save**

---

## Шаг 8 — Передеплой

После добавления переменных нужен новый деплой чтобы они подхватились:

```bash
git commit --allow-empty -m "trigger redeploy for Drive env vars"
git push origin main
```

Или в Vercel Dashboard → Deployments → на последнем деплое → **"⋯"** → **"Redeploy"**.

---

## ✅ Проверка

1. Открой любого клиента в CRM
2. Перейди на вкладку **"📁 Сопровождение"**
3. Загрузи любой файл в один из этапов
4. Если всё настроено правильно — файл появится в:
   ```
   Google Drive → CRM — Документы клиентов → [Имя менеджера клиента] → [ФИО клиента]_[id]
   ```
5. На вкладке **"📁 Файлы"** в карточке клиента появится ссылка на папку

---

## ❓ Частые ошибки

**"WhatsApp не подключён"** или **503** — переменные не заданы или равны `placeholder`. Проверь шаги 7-8.

**"GOOGLE_SERVICE_ACCOUNT_JSON содержит невалидный JSON"** — при копировании JSON в Vercel что-то потерялось (часто — кавычки или экранирование). Скопируй файл заново, целиком, без редактирования.

**Ошибка доступа / "File not found"** — Шаг 5 не выполнен: сервисный аккаунт не имеет доступа к папке. Проверь что `client_email` из JSON добавлен в Sharing с ролью Editor.

**Файлы создаются в корне, а не в папке менеджера** — проверь что в Supabase у клиента указан `manager` (ссылка на запись в таблице `managers`), а у менеджера заполнено поле `name`.

---

## 💾 Где теперь хранятся документы

| Было | Стало |
|------|-------|
| `clients.accomp_stages` JSONB, base64 | Google Drive, ссылка в `clients.drive_link` |
| Лимит 2 МБ на файл | Лимит 20 МБ на файл |
| Нет структуры — всё в одной колонке | Менеджер → Клиент → Документы |
| Растёт размер базы Supabase | База не растёт, файлы в Drive (15 ГБ бесплатно) |
