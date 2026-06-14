-- migrations/003_rename_pwd_to_pwd_hash.sql
-- Переименовывает колонку pwd -> pwd_hash в таблице users.
-- Применять ТОЛЬКО если БД уже существует с колонкой pwd.
-- Для новых установок достаточно schema.sql — там уже pwd_hash.
--
-- ПРИМЕНИТЬ:
--   psql $DATABASE_URL -f migrations/003_rename_pwd_to_pwd_hash.sql
--   Или через Supabase SQL Editor.
--
-- БЕЗОПАСНО: переименование колонки в PostgreSQL атомарно.

alter table users rename column pwd to pwd_hash;

-- После переименования все существующие пользователи не смогут войти,
-- т.к. в колонке хранится plaintext, а код ожидает bcrypt-хеш.
-- Необходимо обновить пароли:
--
--   1. Запустите: node scripts/gen-seed-hashes.js
--   2. Скопируйте полученный INSERT и выполните в Supabase SQL Editor.
--   3. Либо через админ-панель CRM смените пароли каждого пользователя.
