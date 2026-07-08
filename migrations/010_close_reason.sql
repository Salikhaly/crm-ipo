-- migrations/010_close_reason.sql
-- Причина закрытия клиента (amoCRM-механика «причины потерь»).
-- Применить в Supabase SQL Editor. Код работает и БЕЗ миграции
-- (колонка добавляется через addCloseReason + retry), но отчёт
-- «Причины закрытия» в KPI появится только после применения.

alter table clients
  add column if not exists close_reason text default '';

-- Проверка
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'clients' and column_name = 'close_reason';
