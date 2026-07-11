-- migrations/015_pkb_sync_credits_routes.sql
-- 1) credits       — кредитная история клиента (из анкеты ПКБ), таблица во вкладке «Финансы»
-- 2) program       — ипотечная программа клиента (Наурыз, 7-20-25…), чип в шапке карточки
-- 3) reass_status  — статусы переуступки: справка о задолженности / справка о переуступке / кредит закрыт
-- 4) accomp_templates — редактируемые маршруты сопровождения по группам программ (админка → Маршруты)
-- 5) deleted_clients  — корзина клиентов (задел под следующую волну: восстановление вместо безвозвратного удаления)
-- Применить: Supabase SQL Editor → Run. Идемпотентно, повторный запуск безопасен.
-- Код переживает неприменённую миграцию (OPTIONAL_COLUMNS + fallback'и).

alter table clients
  add column if not exists credits jsonb,
  add column if not exists program text default '',
  add column if not exists reass_status jsonb;

alter table calc_settings
  add column if not exists accomp_templates jsonb;

create table if not exists deleted_clients (
  id          text primary key,
  data        jsonb not null,
  fio         text,
  phone       text,
  deleted_by  text,
  deleted_at  timestamptz default now()
);
alter table deleted_clients enable row level security;
drop policy if exists "block_direct_access" on deleted_clients;
create policy "block_direct_access" on deleted_clients for all using (false);

-- Проверка: 5 строк
select 'clients.credits' as added where exists (select 1 from information_schema.columns where table_name='clients' and column_name='credits')
union all select 'clients.program' where exists (select 1 from information_schema.columns where table_name='clients' and column_name='program')
union all select 'clients.reass_status' where exists (select 1 from information_schema.columns where table_name='clients' and column_name='reass_status')
union all select 'calc_settings.accomp_templates' where exists (select 1 from information_schema.columns where table_name='calc_settings' and column_name='accomp_templates')
union all select 'table deleted_clients' where exists (select 1 from information_schema.tables where table_name='deleted_clients');
