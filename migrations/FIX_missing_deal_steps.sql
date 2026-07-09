-- FIX_missing_deal_steps.sql
-- Причина 500 при сохранении клиента: в таблице clients отсутствуют колонки
-- deal_steps_done / deal_steps_notes (миграция 004 была пропущена).
-- Код пишет их при каждом сохранении → база отклоняет запрос → 500.
-- Применить: Supabase → SQL Editor → New query → вставить → Run.
-- Безопасно и идемпотентно (IF NOT EXISTS).

alter table clients
  add column if not exists deal_steps_done  jsonb default '[]'::jsonb,
  add column if not exists deal_steps_notes jsonb default '{}'::jsonb;

-- Проверка: должно вернуть 2 строки
select column_name
from information_schema.columns
where table_name = 'clients'
  and column_name in ('deal_steps_done', 'deal_steps_notes');
