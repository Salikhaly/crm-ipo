-- migrations/004_deal_steps.sql
-- Добавляет колонки для этапов кредитования в таблицу clients
-- Применить: psql $DATABASE_URL -f migrations/004_deal_steps.sql
-- Или через Supabase SQL Editor

alter table clients
  add column if not exists deal_steps_done  jsonb default '[]'::jsonb,
  add column if not exists deal_steps_notes jsonb default '{}'::jsonb;

-- Проверка
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'clients'
  and column_name in ('deal_steps_done', 'deal_steps_notes');
