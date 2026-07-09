-- migrations/012_client_tags.sql
-- Теги клиентов: ["vip","горячий","повторный"] — фильтр в списке, чипы в карточке.
-- Применить: Supabase SQL Editor → Run.
-- Код переживает неприменённую миграцию (OPTIONAL_COLUMNS в lib/supabase.js),
-- но теги начнут сохраняться только после неё.

alter table clients
  add column if not exists tags jsonb default '[]'::jsonb;

-- Проверка
select column_name from information_schema.columns
where table_name = 'clients' and column_name = 'tags';
