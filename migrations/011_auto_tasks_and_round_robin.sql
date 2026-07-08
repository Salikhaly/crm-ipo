-- migrations/011_auto_tasks_and_round_robin.sql
-- 1) Настраиваемые авто-задачи этапов воронки (конструктор в Панели техника → Воронка)
--    auto_task: null = дефолт из кода · {"off":true} = выключено · {"type":"📞 Позвонить","text":"..."} = своя
-- 2) Round-robin: автораспределение новых WhatsApp-лидов по менеджерам (тумблер в админке)
-- Применить: Supabase SQL Editor → Run.
-- Код переживает неприменённую миграцию (fallback), но конструктор и round-robin заработают только после неё.

alter table pipeline_stages
  add column if not exists auto_task jsonb;

alter table calc_settings
  add column if not exists wa_round_robin boolean default false;

-- Проверка
select column_name from information_schema.columns
where (table_name = 'pipeline_stages' and column_name = 'auto_task')
   or (table_name = 'calc_settings'   and column_name = 'wa_round_robin');
