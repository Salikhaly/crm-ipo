-- ═══════════════════════════════════════════════════════════════════
-- MORTGAGE CRM — ПРОДАКШЕН SQL (запустить в Supabase SQL Editor)
-- Объединяет: индексы + безопасность + расширенные настройки калькулятора
-- Безопасно запускать повторно (IF NOT EXISTS / IF EXISTS)
--
-- ВАЖНО: перед этим должны быть выполнены базовые миграции 002-005
-- (создающие таблицы clients, users, wa_chats, calc_settings и т.д.)
-- Если база новая — сначала запустите schema.sql, потом миграции 002-005.
-- ═══════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ЧАСТЬ 1 — ИНДЕКСЫ ПРОИЗВОДИТЕЛЬНОСТИ                             │
-- └─────────────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_clients_manager
  ON clients (manager) WHERE manager IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_stage
  ON clients (stage);
CREATE INDEX IF NOT EXISTS idx_clients_responsible_manager
  ON clients (responsible_manager) WHERE responsible_manager IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_iin
  ON clients (iin) WHERE iin != '';
CREATE INDEX IF NOT EXISTS idx_clients_phone
  ON clients (phone) WHERE phone != '';
CREATE INDEX IF NOT EXISTS idx_clients_created_at
  ON clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_manager_stage
  ON clients (manager, stage) WHERE manager IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_messages_chat_id
  ON wa_messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_chat_created
  ON wa_messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chats_status
  ON wa_chats (status);
CREATE INDEX IF NOT EXISTS idx_wa_chats_last_message
  ON wa_chats (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_login
  ON users (login);
CREATE INDEX IF NOT EXISTS idx_managers_active
  ON managers (active) WHERE active = true;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ЧАСТЬ 2 — БЕЗОПАСНОСТЬ ПАРОЛЕЙ                                   │
-- └─────────────────────────────────────────────────────────────────┘

-- Очищаем старые открытые пароли (приложение использует только pwd_hash)
UPDATE users SET pwd = '***'
  WHERE pwd IS NOT NULL AND pwd != '***';
-- После проверки что логин работает, можно убрать столбец совсем:
-- ALTER TABLE users DROP COLUMN IF EXISTS pwd;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ЧАСТЬ 3 — ROW LEVEL SECURITY                                     │
-- │ Приложение использует service_role (обходит RLS) — работа не    │
-- │ изменится. Защита от утечки anon-ключа.                          │
-- └─────────────────────────────────────────────────────────────────┘

ALTER TABLE clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_direct_access" ON clients;
CREATE POLICY "block_direct_access" ON clients     FOR ALL USING (false);
DROP POLICY IF EXISTS "block_direct_access" ON users;
CREATE POLICY "block_direct_access" ON users       FOR ALL USING (false);
DROP POLICY IF EXISTS "block_direct_access" ON wa_chats;
CREATE POLICY "block_direct_access" ON wa_chats    FOR ALL USING (false);
DROP POLICY IF EXISTS "block_direct_access" ON wa_messages;
CREATE POLICY "block_direct_access" ON wa_messages FOR ALL USING (false);
DROP POLICY IF EXISTS "block_direct_access" ON managers;
CREATE POLICY "block_direct_access" ON managers    FOR ALL USING (false);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ЧАСТЬ 4 — РАСШИРЕННЫЕ НАСТРОЙКИ КАЛЬКУЛЯТОРА                     │
-- │ Колонки для данных, которые раньше были захардкожены в коде     │
-- └─────────────────────────────────────────────────────────────────┘

ALTER TABLE calc_settings
  ADD COLUMN IF NOT EXISTS progs_data     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expense_otbasy jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expense_other  jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mrp_ref        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deal_steps     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS d50_table      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rate_presets   jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS insurance_pct  numeric(5,4) DEFAULT 0.003;

-- Убеждаемся что строка настроек существует
INSERT INTO calc_settings (id, mrp, pm_nauryz, pm_other)
  VALUES ('main', 4325, 10, 13)
  ON CONFLICT (id) DO NOTHING;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ПРОВЕРКА (раскомментируйте и запустите отдельно)                 │
-- └─────────────────────────────────────────────────────────────────┘

-- Индексы:
-- SELECT indexname, tablename FROM pg_indexes
--   WHERE schemaname='public' ORDER BY tablename;

-- RLS включён:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND tablename IN
--   ('clients','users','wa_chats','wa_messages','managers');

-- Колонки калькулятора:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='calc_settings' ORDER BY column_name;
