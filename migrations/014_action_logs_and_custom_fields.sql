-- migrations/014_action_logs_and_custom_fields.sql
-- 1) Журнал действий (кто что сделал) — вкладка «Журнал» в Панели техника.
-- 2) Конструктор доп. полей карточки: описания полей в calc_settings.custom_fields,
--    значения — в clients.custom (jsonb).
-- Применить: Supabase SQL Editor → Run.
-- Код переживает неприменённую миграцию: логи молча не пишутся (fire-and-forget),
-- поле custom попадает в OPTIONAL_COLUMNS (retry без него).

-- ── Журнал действий ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS action_logs (
  id          bigserial PRIMARY KEY,
  action      text,          -- create | update | delete | stage | pipeline | settings ...
  entity      text,          -- client | pipeline | settings | template ...
  entity_id   text,
  entity_name text,
  detail      text,
  user_name   text,
  user_id     text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "block_direct_access" ON action_logs;
CREATE POLICY "block_direct_access" ON action_logs FOR ALL USING (false);
CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs (created_at DESC);

-- ── Доп. поля карточки ───────────────────────────────────────────
ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS custom_fields jsonb;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS custom jsonb DEFAULT '{}'::jsonb;

-- Проверка
SELECT 'action_logs' AS obj WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='action_logs')
UNION ALL SELECT column_name FROM information_schema.columns
  WHERE (table_name='calc_settings' AND column_name='custom_fields')
     OR (table_name='clients' AND column_name='custom');
