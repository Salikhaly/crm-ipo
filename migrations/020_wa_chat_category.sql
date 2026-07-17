-- migrations/020_wa_chat_category.sql
-- Метка типа обращения на чате WhatsApp (Сопровождение / Жилзайм / Вопрос / 300).
-- Менеджер ставит вручную — на следующий день сразу видно, с кем как работать.
--
-- !!! ВНИМАНИЕ !!! ЭТА МИГРАЦИЯ НЕ ПРИМЕНЕНА АВТОМАТИЧЕСКИ.
-- !!! Выполнить в Supabase → SQL Editor. Идемпотентна (add column if not exists),
-- !!! повторный запуск безопасен. Код переживает её отсутствие: PATCH при
-- !!! «column category does not exist» повторяет запрос без метки и просит
-- !!! применить миграцию, остальная логика чата продолжает работать.

alter table wa_chats add column if not exists category text default '';

-- Проверка
select id, name, status, category from wa_chats limit 20;
