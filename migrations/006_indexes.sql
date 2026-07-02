-- ================================================================
-- MIGRATION 006 — Индексы производительности
-- Запустить ОДИН РАЗ: Supabase → SQL Editor → Run
-- Закрывает аудит C4: нет ни одного индекса в БД
-- ================================================================

-- ─── CLIENTS ─────────────────────────────────────────────────────────────────
-- Основной фильтр: менеджер видит только своих клиентов
-- GET /api/clients?  → WHERE manager = $1  (все запросы менеджеров)
CREATE INDEX IF NOT EXISTS idx_clients_manager
  ON clients (manager)
  WHERE manager IS NOT NULL;

-- Фильтр по стадии воронки
-- GET /api/clients?stage=new_lead
CREATE INDEX IF NOT EXISTS idx_clients_stage
  ON clients (stage);

-- Ответственный специалист (specialist-role фильтр)
CREATE INDEX IF NOT EXISTS idx_clients_responsible_manager
  ON clients (responsible_manager)
  WHERE responsible_manager IS NOT NULL;

-- Поиск по ИИН и телефону (ILIKE — нужен GIN для production)
CREATE INDEX IF NOT EXISTS idx_clients_iin
  ON clients (iin)
  WHERE iin != '';

CREATE INDEX IF NOT EXISTS idx_clients_phone
  ON clients (phone)
  WHERE phone != '';

-- Сортировка по дате создания (ORDER BY created_at DESC — во всех запросах)
CREATE INDEX IF NOT EXISTS idx_clients_created_at
  ON clients (created_at DESC);

-- KPI: группировка по менеджеру + stage (composite)
CREATE INDEX IF NOT EXISTS idx_clients_manager_stage
  ON clients (manager, stage)
  WHERE manager IS NOT NULL;

-- ─── WA_MESSAGES ─────────────────────────────────────────────────────────────
-- Загрузка истории чата: WHERE chat_id = $1 ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_wa_messages_chat_id
  ON wa_messages (chat_id);

CREATE INDEX IF NOT EXISTS idx_wa_messages_chat_created
  ON wa_messages (chat_id, created_at DESC);

-- ─── WA_CHATS ────────────────────────────────────────────────────────────────
-- Фильтр: незакрытые чаты
CREATE INDEX IF NOT EXISTS idx_wa_chats_status
  ON wa_chats (status);

-- Сортировка по последнему сообщению
CREATE INDEX IF NOT EXISTS idx_wa_chats_last_message
  ON wa_chats (last_message_at DESC);

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Логин — уникальность уже есть (UNIQUE), но явный индекс для быстрого lookup
CREATE INDEX IF NOT EXISTS idx_users_login
  ON users (login);

-- ─── MANAGERS ────────────────────────────────────────────────────────────────
-- Список активных менеджеров (используется во всех дропдаунах)
CREATE INDEX IF NOT EXISTS idx_managers_active
  ON managers (active)
  WHERE active = true;

-- ─── ПОЛНОТЕКСТОВЫЙ ПОИСК (опционально) ────────────────────────────────────
-- Для поиска по ФИО через ILIKE лучше GIN-индекс с pg_trgm
-- Раскомментировать если установлено расширение:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_clients_fio_trgm ON clients USING GIN (fio gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm ON clients USING GIN (phone gin_trgm_ops);
