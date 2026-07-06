# 🚀 PRODUCTION — деплой Mortgage CRM

Проверено: production-сборка Next.js ✓, 167/167 тестов ✓, безопасность ✓

---

## ЧЕКЛИСТ ПЕРЕД ДЕПЛОЕМ

- [ ] 1. Supabase: запустить `migrations/PRODUCTION_SETUP.sql`
- [ ] 2. Vercel: проверить переменные окружения (список ниже)
- [ ] 3. Green API: настроить инстанс + webhook
- [ ] 4. Git: залить код
- [ ] 5. Vercel: включить обязательную проверку тестов
- [ ] 6. Проверить работу на сайте

---

## ШАГ 1 — Supabase

SQL Editor → New query → вставить весь `migrations/PRODUCTION_SETUP.sql` → **Run**

Это добавит: индексы (скорость), RLS (безопасность), очистит старые пароли,
добавит колонки настроек калькулятора.

> Если база НОВАЯ (с нуля): сначала `schema.sql`, потом миграции `002`→`005`,
> потом `PRODUCTION_SETUP.sql`.
> Если база РАБОЧАЯ: только `PRODUCTION_SETUP.sql`.

---

## ШАГ 2 — Vercel Environment Variables

Settings → Environment Variables. Обязательные:

| Переменная | Как получить |
|-----------|--------------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role key |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `WEBHOOK_SECRET` | `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` |
| `GREEN_API_ID` | Green API консоль → idInstance |
| `GREEN_API_TOKEN` | Green API консоль → apiTokenInstance |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud → сервисный аккаунт → ключ JSON |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID папки в Google Drive |

> ⚠️ НЕ используйте anon key вместо service_role — часть функций не заработает.
> После добавления переменных сделайте **Redeploy**.

---

## ШАГ 3 — Green API (WhatsApp)

1. my.green-api.com → создать инстанс
2. Скопировать `idInstance` и `apiTokenInstance` → в Vercel (шаг 2)
3. Сканировать QR телефоном **отдельного** номера (не личного!)
4. Settings → Notifications → включить:
   - ✅ Incoming messages and files
   - ✅ Outgoing message statuses
5. Webhook URL:
   ```
   https://crm-ipo.vercel.app/api/wa/webhook?secret=ВАШ_WEBHOOK_SECRET
   ```

> 🛡️ Защита от бана уже в коде: пауза 4 сек, дневной лимит 250.
> Обязательно прочитайте GREEN_API_БЕЗОПАСНОСТЬ.md — правила прогрева номера.

---

## ШАГ 4 — Git

```bash
cd crm-ipo
# скопировать все файлы из архива поверх
git add .
git commit -m "production: full calc config, WA anti-ban, security, indexes"
git push origin main
```

GitHub Actions запустит 167 тестов. При зелёном — Vercel задеплоит.

---

## ШАГ 5 — Vercel: обязательные проверки

Settings → Git → Required Checks → добавить `Run Tests`.
Теперь сломанный коммит не задеплоится.

---

## ШАГ 6 — Проверка после деплоя

- [ ] Логин работает
- [ ] Клиенты загружаются
- [ ] Калькулятор → Ипотека: показывает платежи (не «—/мес»)
- [ ] Калькулятор → ОПВ: считает
- [ ] Калькулятор → Бухгалтер: комиссия работает
- [ ] admin → Панель техника → Калькулятор: все 6 секций открываются
- [ ] head → Настройки калькулятора: доступ есть, юзеров не видит
- [ ] WhatsApp: тестовое сообщение доходит
- [ ] Настроить калькулятор: пройти секции → Сохранить (запишет в БД)

---

## Что уже настроено в коде

| Компонент | Статус |
|-----------|--------|
| Security headers (CSP, HSTS, X-Frame) | ✅ next.config.js |
| Rate limiting логина (10/10мин) | ✅ |
| Rate limiting WhatsApp (пауза + лимит) | ✅ |
| Ошибки API не утекают клиенту | ✅ apiError |
| CI/CD (тесты блокируют деплой) | ✅ .github/workflows |
| robots.txt (noindex) | ✅ |
| Все данные калькулятора из БД | ✅ |
| Доступ head к настройкам | ✅ |

## Известные ограничения (не блокеры)

- `index.js` — один большой файл (6900 строк). Работает, но рефакторинг на features/ желателен.
- Роутинг через useState (браузерный «назад» выходит из приложения).
- WA-polling каждые 10 сек (можно заменить на Supabase Realtime).

Эти пункты не мешают продакшену — можно улучшать постепенно.
