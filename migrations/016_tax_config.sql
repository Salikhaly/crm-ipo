-- migrations/016_tax_config.sql
-- Налоговые константы калькулятора «Налоги» — редактируются в Панели техника
-- (раньше были зашиты в код: при изменении налогов РК приходилось ждать программиста).
-- Применить: Supabase SQL Editor → Run. Идемпотентно.
-- Код переживает неприменённую миграцию: без колонки используются встроенные значения.

alter table calc_settings
  add column if not exists tax_config jsonb;

-- Проверка
select column_name from information_schema.columns
where table_name = 'calc_settings' and column_name = 'tax_config';
