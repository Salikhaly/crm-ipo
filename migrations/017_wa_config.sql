-- migrations/017_wa_config.sql
-- Конфигурация WhatsApp-автоматизации (автоответ в нерабочее время и т.п.).
-- Хранится одной jsonb-колонкой, чтобы не плодить поля под каждую настройку.
--
-- ⚠️ ВЫПОЛНИТЬ В Supabase → SQL Editor ОДИН РАЗ. Идемпотентно (add column if not exists).
-- Код переживает НЕприменённую миграцию: без колонки автоответ в нерабочее время
-- просто не работает, остальное WhatsApp — как раньше.

alter table calc_settings add column if not exists wa_config jsonb;

-- Форма значения (пример):
-- {
--   "offhours_on":   true,
--   "offhours_text": "Спасибо за обращение! Ответим в рабочее время с 9:00. 🌙",
--   "work_from":     "09:00",
--   "work_to":       "18:00"
-- }
