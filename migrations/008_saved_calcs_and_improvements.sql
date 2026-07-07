-- migrations/008 — сохранённые расчёты + автоответ WA + лог ошибок
-- Безопасно повторно.

-- 1. Сохранённые расчёты в карточке клиента
ALTER TABLE clients ADD COLUMN IF NOT EXISTS saved_calcs jsonb DEFAULT '[]'::jsonb;

-- 2. Настройка автоответа новым лидам WA
ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS wa_auto_greeting text DEFAULT '',
  ADD COLUMN IF NOT EXISTS wa_auto_greeting_on boolean DEFAULT false;

-- 3. Лог ошибок фронтенда (лёгкий мониторинг без внешних сервисов)
CREATE TABLE IF NOT EXISTS error_logs (
  id         bigserial PRIMARY KEY,
  message    text,
  stack      text,
  url        text,
  user_name  text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "block_direct_access" ON error_logs;
CREATE POLICY "block_direct_access" ON error_logs FOR ALL USING (false);

-- Индекс для чистки старых логов
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at DESC);
