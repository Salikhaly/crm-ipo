-- migrations/013_doc_templates.sql
-- Шаблоны документов (договор, расписка) с плейсхолдерами — редактор в Панели техника.
-- Применить: Supabase SQL Editor → Run.
-- Код переживает неприменённую миграцию: без колонки используются дефолтные шаблоны из кода,
-- но правки в админке сохраняться не будут.

alter table calc_settings
  add column if not exists doc_templates jsonb;

-- Проверка
select column_name from information_schema.columns
where table_name = 'calc_settings' and column_name = 'doc_templates';
