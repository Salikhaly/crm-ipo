-- ═══════════════════════════════════════════════════════════════
-- Миграция 002: WhatsApp улучшения
-- Запустите в Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Добавляем поле status в wa_chats (если ещё нет)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='wa_chats' and column_name='status'
  ) then
    alter table wa_chats add column status text default 'new';
  end if;
end $$;

-- 2. Добавляем поле assigned_to в wa_chats (если ещё нет)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='wa_chats' and column_name='assigned_to'
  ) then
    alter table wa_chats add column assigned_to text references managers(id) on delete set null;
  end if;
end $$;

-- 3. Добавляем статус сообщения в wa_messages (если ещё нет)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='wa_messages' and column_name='status'
  ) then
    alter table wa_messages add column status text default 'sent';
  end if;
end $$;

-- 4. Добавляем медиа-поля в wa_messages (если ещё нет)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='wa_messages' and column_name='media_mime'
  ) then
    alter table wa_messages add column media_mime text default '';
    alter table wa_messages add column media_size int default 0;
  end if;
end $$;

-- 5. Индексы для быстрой фильтрации
create index if not exists wa_chats_status_idx    on wa_chats(status);
create index if not exists wa_chats_assigned_idx  on wa_chats(assigned_to);
create index if not exists wa_messages_status_idx on wa_messages(status);

comment on column wa_chats.status      is 'new | in_work | done';
comment on column wa_messages.status   is 'sent | delivered | read | failed';
