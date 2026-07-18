-- ═══════════════════════════════════════════════════════════════════════════
-- МИГРАЦИЯ 022 — СВОДНАЯ. Догоняет базу до текущего состояния кода.
-- Запускать в Supabase → SQL Editor ОДНИМ куском. ПОЛНОСТЬЮ идемпотентна
-- (IF NOT EXISTS / IF EXISTS / ON CONFLICT) — безопасно даже если часть уже есть.
--
-- ДИАГНОСТИКА ПРОДА 18.07.2026 показала: почти всё уже применено. Реально
-- незакрытым остаётся только ОДИН пункт — удаление legacy-колонки pwd (часть 6).
-- Остальные части — страховка/для чистой БД, на текущем проде это no-op.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Расширенные настройки калькулятора (миграции 008/011/013/014/016/017) ──
alter table calc_settings
  add column if not exists progs_data          jsonb   default '[]'::jsonb,
  add column if not exists expense_otbasy       jsonb   default '[]'::jsonb,
  add column if not exists expense_other         jsonb   default '[]'::jsonb,
  add column if not exists mrp_ref               jsonb   default '[]'::jsonb,
  add column if not exists deal_steps            jsonb   default '[]'::jsonb,
  add column if not exists d50_table             jsonb   default '[]'::jsonb,
  add column if not exists rate_presets          jsonb   default '[]'::jsonb,
  add column if not exists insurance_pct         numeric(5,4) default 0.003,
  add column if not exists wa_auto_greeting      text    default '',
  add column if not exists wa_auto_greeting_on   boolean default false,
  add column if not exists wa_round_robin        boolean default false,
  add column if not exists wa_config             jsonb,
  add column if not exists doc_templates         jsonb,
  add column if not exists custom_fields         jsonb,
  add column if not exists accomp_templates      jsonb,
  add column if not exists tax_config            jsonb;


-- ── 2. Необязательные колонки клиента (миграции 004/008/010/012/015) ──────────
alter table clients
  add column if not exists saved_calcs      jsonb default '[]'::jsonb,
  add column if not exists close_reason     text  default '',
  add column if not exists tags             jsonb default '[]'::jsonb,
  add column if not exists custom           jsonb default '{}'::jsonb,
  add column if not exists deal_steps_done  jsonb default '[]'::jsonb,
  add column if not exists deal_steps_notes jsonb default '{}'::jsonb,
  add column if not exists credits          jsonb,
  add column if not exists program          text  default '',
  add column if not exists reass_status     jsonb;


-- ── 3. Метка чата WhatsApp (миграция 020) ────────────────────────────────────
alter table wa_chats add column if not exists category text default '';


-- ── 4. Таблица логов ошибок фронтенда (эндпоинт /api/log-error) ───────────────
create table if not exists error_logs (
  id          bigint generated always as identity primary key,
  message     text,
  stack       text,
  url         text,
  user_name   text,
  user_agent  text,
  created_at  timestamptz default now()
);


-- ── 5. Таблица быстрых ответов WhatsApp (миграция 005) — на случай чистой БД ──
create table if not exists wa_quick_replies (
  id          text primary key default gen_random_uuid()::text,
  trigger     text not null unique,
  title       text not null,
  body        text not null,
  category    text default 'general',
  active      boolean default true,
  sort_order  int  default 0,
  created_at  timestamptz default now()
);


-- ── 6. ⚠️ ГЛАВНОЕ: удаление legacy-колонки pwd (миграция 021) ────────────────
-- Единственный реально незакрытый пункт. Плейнтекст-пароли (дыра безопасности)
-- + из-за NOT NULL создание нового пользователя падало 500 (сейчас обходится
-- ретраем в коде, но эта строка закрывает вопрос совсем). Аутентификация
-- использует только pwd_hash — удаление безопасно.
alter table users drop column if exists pwd;


-- ── ПРОВЕРКА (раскомментируйте и запустите отдельно) ─────────────────────────
-- select column_name from information_schema.columns
--   where table_name='users' order by ordinal_position;   -- pwd не должно быть
-- select category, count(*) from wa_chats group by category;
