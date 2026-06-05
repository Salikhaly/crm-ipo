-- ================================================================
-- ИПОТЕКА CRM — ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ
-- Запустите ОДИН РАЗ в Supabase → SQL Editor → New query → Run
-- ================================================================

-- ─── МЕНЕДЖЕРЫ ───────────────────────────────────────────────────
create table if not exists managers (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  phone      text default '',
  role       text default 'manager',
  color      text default '#3b82f6',
  active     boolean default true,
  created_at timestamptz default now()
);

-- ─── ПОЛЬЗОВАТЕЛИ (логины) ────────────────────────────────────────
create table if not exists users (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  login       text unique not null,
  pwd         text not null,
  role        text default 'manager',
  manager_id  text references managers(id) on delete set null,
  created_at  timestamptz default now()
);

-- ─── КЛИЕНТЫ ─────────────────────────────────────────────────────
create table if not exists clients (
  id                    text primary key default gen_random_uuid()::text,
  fio                   text default '',
  iin                   text default '',
  phone                 text default '',
  city                  text default 'Алматы',
  manager               text references managers(id) on delete set null,
  date_in               text default '',
  source                text default 'other',
  stage                 text default 'new_lead',
  is_whatsapp           boolean default false,
  wa_msg_preview        text default '',
  contact_status        text default '',
  marital_status        text default '',
  children              text default '',
  official_income       text default '',
  extra_income          text default '',
  extra_income_confirmed boolean default false,
  pension_contributions text default '',
  work_experience       text default '',
  work_type             text default 'official',
  down_payment          text default '',
  down_payment_type     text default 'cash',
  deposit_bank          text default '',
  deposit_amount        text default '',
  deposit_term          text default '',
  otbasy_deposit        boolean default false,
  otbasy_reward         text default '',
  otbasy_queue          text default '',
  otbasy_queue_year     text default '',
  otbasy_queue_city     text default '',
  credit_status         text default 'good',
  has_overdue           boolean default false,
  credits_count         text default '',
  monthly_load          text default '',
  had_bank_refusal      boolean default false,
  has_refinancing       boolean default false,
  problematic_credits   boolean default false,
  court_restrictions    boolean default false,
  is_reassignment       boolean default false,
  reassignment_complex  text default '',
  reassignment_developer text default '',
  reassignment_amount   text default '',
  mortgage_balance      text default '',
  reassignment_bank     text default '',
  has_debt              boolean default false,
  urgent_sale           boolean default false,
  contract_type         text default '',
  contract_amount       numeric default 0,
  responsible_manager   text references managers(id) on delete set null,
  mortgage_specialist   text default '',
  accomp_stage_index    int default 0,
  accomp_stages         jsonb default '{}'::jsonb,
  payments              jsonb default '[]'::jsonb,
  miro_link             text default '',
  roadmap_link          text default '',
  drive_link            text default '',
  drive_folder_name     text default '',
  comments              jsonb default '[]'::jsonb,
  tasks                 jsonb default '[]'::jsonb,
  contracts5y           jsonb default '{}'::jsonb,
  contracts5y_plus      jsonb default '{}'::jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── ЧЕКЛИСТЫ (шаблоны по этапам) ────────────────────────────────
create table if not exists checklist_templates (
  id         text primary key default gen_random_uuid()::text,
  stage_name text not null unique,
  items      jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- ─── НАСТРОЙКИ ВОРОНКИ ────────────────────────────────────────────
create table if not exists pipeline_stages (
  id         text primary key,
  label      text not null,
  color      text default '#3b82f6',
  sort_order int default 0,
  updated_at timestamptz default now()
);

-- ─── WHATSAPP ЧАТЫ ───────────────────────────────────────────────
create table if not exists wa_chats (
  id              text primary key,
  phone           text not null,
  name            text default '',
  last_message    text default '',
  last_message_at timestamptz default now(),
  unread_count    int default 0,
  client_id       text references clients(id) on delete set null,
  assigned_to     text references managers(id) on delete set null,
  status          text default 'new',
  created_at      timestamptz default now()
);

-- ─── WHATSAPP СООБЩЕНИЯ ───────────────────────────────────────────
create table if not exists wa_messages (
  id          text primary key,
  chat_id     text not null references wa_chats(id) on delete cascade,
  direction   text not null default 'in',
  type        text not null default 'text',
  body        text default '',
  media_url   text default '',
  media_name  text default '',
  media_mime  text default '',
  media_size  int default 0,
  author      text default '',
  status      text default 'sent',
  sent_at     timestamptz default now(),
  created_at  timestamptz default now()
);

-- ─── ИНДЕКСЫ ─────────────────────────────────────────────────────
create index if not exists clients_stage_idx     on clients(stage);
create index if not exists clients_manager_idx   on clients(manager);
create index if not exists clients_iin_idx       on clients(iin);
create index if not exists clients_phone_idx     on clients(phone);
create index if not exists clients_created_idx   on clients(created_at desc);
create index if not exists wa_messages_chat_idx  on wa_messages(chat_id);
create index if not exists wa_messages_sent_idx  on wa_messages(sent_at desc);
create index if not exists wa_chats_client_idx   on wa_chats(client_id);

-- ─── RLS (публичный доступ — для простого деплоя) ─────────────────
alter table managers            enable row level security;
alter table users               enable row level security;
alter table clients             enable row level security;
alter table checklist_templates enable row level security;
alter table pipeline_stages     enable row level security;
alter table wa_chats            enable row level security;
alter table wa_messages         enable row level security;

create policy "all_managers"    on managers            for all using (true) with check (true);
create policy "all_users"       on users               for all using (true) with check (true);
create policy "all_clients"     on clients             for all using (true) with check (true);
create policy "all_checklists"  on checklist_templates for all using (true) with check (true);
create policy "all_pipeline"    on pipeline_stages     for all using (true) with check (true);
create policy "all_wa_chats"    on wa_chats            for all using (true) with check (true);
create policy "all_wa_messages" on wa_messages         for all using (true) with check (true);

-- ─── REALTIME ─────────────────────────────────────────────────────
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table wa_chats;
alter publication supabase_realtime add table wa_messages;

-- ─── AUTO updated_at ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin NEW.updated_at = now(); return NEW; end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- ─── ОБНОВЛЕНИЕ ЧАТА ПРИ НОВОМ СООБЩЕНИИ ─────────────────────────
create or replace function update_wa_chat_on_message()
returns trigger as $$
begin
  update wa_chats set
    last_message = case
      when NEW.type='text' then left(NEW.body,100)
      when NEW.type='image' then '📷 Фото'
      when NEW.type in ('audio','voice') then '🎤 Голосовое'
      when NEW.type='video' then '🎥 Видео'
      when NEW.type='document' then '📎 '||NEW.media_name
      else '📨 Сообщение' end,
    last_message_at = NEW.sent_at,
    unread_count = case when NEW.direction='in' then unread_count+1 else unread_count end
  where id = NEW.chat_id;
  return NEW;
end;
$$ language plpgsql;

create trigger wa_msg_trigger after insert on wa_messages
  for each row execute function update_wa_chat_on_message();

-- ─── НАЧАЛЬНЫЕ ДАННЫЕ ─────────────────────────────────────────────
insert into managers (id,name,phone,role,color,active) values
  ('m1','Айгерим Байсейтова','+7 701 000-00-01','manager','#6366f1',true),
  ('m2','Данияр Сейтов','+7 702 000-00-02','manager','#10b981',true),
  ('m3','Мадина Касымова','+7 705 000-00-03','manager','#f59e0b',true),
  ('m4','Руслан Тулеев','+7 747 000-00-04','manager','#ec4899',true)
on conflict do nothing;

insert into users (id,name,login,pwd,role,manager_id) values
  ('u0','Техник','admin','admin123','admin',null),
  ('u1','Руководитель','head','head123','head',null),
  ('u2','Айгерим Б.','aigerim','a123','manager','m1'),
  ('u3','Данияр С.','daniyar','d123','manager','m2'),
  ('u4','Мадина К.','madina','m123','manager','m3'),
  ('u5','Руслан Т.','ruslan','r123','manager','m4')
on conflict do nothing;

insert into pipeline_stages (id,label,color,sort_order) values
  ('new_lead','Новый лид','#6366f1',1),
  ('in_work','Взят в работу','#0ea5e9',2),
  ('analysis','Анализ','#f59e0b',3),
  ('consultation','Консультация','#a855f7',4),
  ('contract','Договор','#ec4899',5),
  ('accompaniment','Сопровождение','#14b8a6',6),
  ('approval','Одобрение','#10b981',7),
  ('deal','Сделка','#f97316',8),
  ('issuance','Выдача ипотеки','#22c55e',9),
  ('closed','Закрыто','#64748b',10)
on conflict do nothing;

insert into checklist_templates (stage_name, items) values
  ('Сбор документов','[{"id":"sd1","t":"Удостоверение личности","tp":"doc"},{"id":"sd2","t":"Справка о доходах","tp":"doc"},{"id":"sd3","t":"ЭЦП заёмщика","tp":"ecp"},{"id":"sd4","t":"ЭЦП созаёмщика","tp":"ecp"},{"id":"sd5","t":"Выписка ЕНПФ","tp":"doc"}]'),
  ('Проверка БКИ','[{"id":"bk1","t":"Запрос в БКИ сделан","tp":"check"},{"id":"bk2","t":"Отчёт получен","tp":"doc"},{"id":"bk3","t":"Нагрузка рассчитана","tp":"check"}]'),
  ('Подготовка доходов','[{"id":"pd1","t":"Офиц. доход подтверждён","tp":"check"},{"id":"pd2","t":"Доп. доход оформлен","tp":"check"},{"id":"pd3","t":"2-НДФЛ получена","tp":"doc"}]'),
  ('Выбор программы','[{"id":"vp1","t":"Банки сравнены","tp":"check"},{"id":"vp2","t":"Программа выбрана","tp":"check"},{"id":"vp3","t":"КП отправлено","tp":"check"}]'),
  ('Подача заявки','[{"id":"pz1","t":"Заявка подана","tp":"check"},{"id":"pz2","t":"Документы переданы","tp":"doc"},{"id":"pz3","t":"Номер заявки получен","tp":"check"}]'),
  ('Одобрение','[{"id":"od1","t":"Решение банка получено","tp":"check"},{"id":"od2","t":"Сумма подтверждена","tp":"check"},{"id":"od3","t":"ЭЦП на решение","tp":"ecp"}]'),
  ('Поиск квартиры','[{"id":"pk1","t":"Требования зафиксированы","tp":"check"},{"id":"pk2","t":"Квартира выбрана","tp":"check"},{"id":"pk3","t":"Договор задатка","tp":"doc"}]'),
  ('Оценка','[{"id":"oc1","t":"Оценщик выбран","tp":"check"},{"id":"oc2","t":"Отчёт об оценке","tp":"doc"},{"id":"oc3","t":"Передан в банк","tp":"check"}]'),
  ('Сделка','[{"id":"sk1","t":"Дата сделки назначена","tp":"check"},{"id":"sk2","t":"Договор купли-продажи","tp":"doc"},{"id":"sk3","t":"ЭЦП заёмщика","tp":"ecp"},{"id":"sk4","t":"ЭЦП созаёмщика","tp":"ecp"}]'),
  ('Выдача ипотеки','[{"id":"vi1","t":"Деньги перечислены","tp":"check"},{"id":"vi2","t":"Акт приёма-передачи","tp":"doc"},{"id":"vi3","t":"Ключи получены","tp":"check"}]'),
  ('Закрытие','[{"id":"zk1","t":"Отзыв получен","tp":"check"},{"id":"zk2","t":"Рекомендации запрошены","tp":"check"},{"id":"zk3","t":"Архив сформирован","tp":"doc"}]')
on conflict (stage_name) do nothing;
