-- migrations/021_drop_legacy_pwd_column.sql
-- Убирает legacy-колонку `pwd` из таблицы users.
--
-- ЗАЧЕМ. На проде миграция 003 (rename pwd→pwd_hash) не выполнялась — вместо неё
-- pwd_hash добавили отдельной колонкой, а старая plaintext-`pwd` (NOT NULL, без
-- default) осталась. Из-за неё INSERT нового пользователя падал 500 «not-null
-- constraint» — завести нового сотрудника через админку было НЕВОЗМОЖНО. Плюс
-- это дыра безопасности: пароли лежали в базе открытым текстом.
--
-- Аутентификация использует ТОЛЬКО pwd_hash (bcrypt) — удаление pwd безопасно.
--
-- !!! ВНИМАНИЕ !!! ЭТА МИГРАЦИЯ НЕ ПРИМЕНЕНА АВТОМАТИЧЕСКИ.
-- !!! Выполнить в Supabase → SQL Editor. Идемпотентна (IF EXISTS), повторный
-- !!! запуск безопасен. Код и без неё уже переживает лишнюю колонку (endpoint
-- !!! дозаполняет pwd маской), но эта миграция закрывает вопрос насовсем.

alter table users drop column if exists pwd;

-- Проверка: колонки users после удаления
select column_name, is_nullable, data_type
from information_schema.columns
where table_name = 'users'
order by ordinal_position;
