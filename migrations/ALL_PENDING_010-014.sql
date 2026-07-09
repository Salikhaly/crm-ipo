-- ═══════════════════════════════════════════════════════════════════════════
-- ВСЕ НЕПРИМЕНЁННЫЕ МИГРАЦИИ ОДНИМ ФАЙЛОМ (объединяет 010, 011, 012, 013, 014)
-- ═══════════════════════════════════════════════════════════════════════════
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Безопасно: всё через IF NOT EXISTS — повторный запуск ничего не сломает и не
-- затрёт данные. Если часть колонок уже есть — они просто пропускаются.
--
-- Что добавляет:
--   010 — причина закрытия клиента (отчёт «Причины потерь» в KPI)
--   011 — авто-задачи этапов (конструктор в воронке) + round-robin WhatsApp-лидов
--   012 — теги клиентов
--   013 — шаблоны документов (генератор договоров)
--   014 — журнал действий + конструктор доп. полей карточки
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 010: причина закрытия клиента ───────────────────────────────────────────
alter table clients
  add column if not exists close_reason text default '';

-- ── 011: авто-задачи этапов + round-robin ───────────────────────────────────
alter table pipeline_stages
  add column if not exists auto_task jsonb;

alter table calc_settings
  add column if not exists wa_round_robin boolean default false;

-- ── 012: теги клиентов ──────────────────────────────────────────────────────
alter table clients
  add column if not exists tags jsonb default '[]'::jsonb;

-- ── 013: шаблоны документов ─────────────────────────────────────────────────
alter table calc_settings
  add column if not exists doc_templates jsonb;

-- ── 014: журнал действий ────────────────────────────────────────────────────
create table if not exists action_logs (
  id          bigserial primary key,
  action      text,          -- create | update | delete | stage | pipeline | settings ...
  entity      text,          -- client | pipeline | settings | template ...
  entity_id   text,
  entity_name text,
  detail      text,
  user_name   text,
  user_id     text,
  created_at  timestamptz default now()
);
alter table action_logs enable row level security;
drop policy if exists "block_direct_access" on action_logs;
create policy "block_direct_access" on action_logs for all using (false);
create index if not exists idx_action_logs_created on action_logs (created_at desc);

-- ── 014: конструктор доп. полей карточки ────────────────────────────────────
alter table calc_settings
  add column if not exists custom_fields jsonb;

alter table clients
  add column if not exists custom jsonb default '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- ПРОВЕРКА: должно вернуть 8 строк (все новые колонки + таблица action_logs)
-- ═══════════════════════════════════════════════════════════════════════════
select 'clients.close_reason'       as added
  where exists (select 1 from information_schema.columns where table_name='clients' and column_name='close_reason')
union all select 'pipeline_stages.auto_task'
  where exists (select 1 from information_schema.columns where table_name='pipeline_stages' and column_name='auto_task')
union all select 'calc_settings.wa_round_robin'
  where exists (select 1 from information_schema.columns where table_name='calc_settings' and column_name='wa_round_robin')
union all select 'clients.tags'
  where exists (select 1 from information_schema.columns where table_name='clients' and column_name='tags')
union all select 'calc_settings.doc_templates'
  where exists (select 1 from information_schema.columns where table_name='calc_settings' and column_name='doc_templates')
union all select 'calc_settings.custom_fields'
  where exists (select 1 from information_schema.columns where table_name='calc_settings' and column_name='custom_fields')
union all select 'clients.custom'
  where exists (select 1 from information_schema.columns where table_name='clients' and column_name='custom')
union all select 'table action_logs'
  where exists (select 1 from information_schema.tables where table_name='action_logs');
