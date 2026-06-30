-- migrations/005_calc_settings_and_wa_replies.sql
-- Таблицы для настроек калькулятора и быстрых ответов WA
-- Применить: psql $DATABASE_URL -f migrations/005_calc_settings_and_wa_replies.sql
-- Или через Supabase SQL Editor

-- ─── Настройки калькулятора ──────────────────────────────────────────────────
create table if not exists calc_settings (
  id          text primary key default 'main',
  mrp         int  not null default 4325,
  pm_nauryz   int  not null default 10,
  pm_other    int  not null default 13,
  kd          jsonb not null default '{"p1":40,"p2":65,"p3":90,"v1":0.40,"v2":0.50,"v3":0.60,"v4":0.70}'::jsonb,
  updated_at  timestamptz default now()
);

-- ─── Программы ипотеки ───────────────────────────────────────────────────────
create table if not exists calc_programs (
  key         text primary key,
  name        text not null,
  icon        text default '🏠',
  down_ratio  numeric(4,2) not null default 0.20,
  desc_text   text default '',
  active      boolean default true,
  sort_order  int  default 0,
  variants    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- ─── Быстрые ответы WA ───────────────────────────────────────────────────────
create table if not exists wa_quick_replies (
  id          text primary key default gen_random_uuid()::text,
  trigger     text not null unique,
  title       text not null,
  body        text not null,
  category    text default 'general',
  active      boolean default true,
  sort_order  int  default 0,
  created_at  timestamptz default now()
);

-- RLS (открываем для авторизованных пользователей)
alter table calc_settings   enable row level security;
alter table calc_programs   enable row level security;
alter table wa_quick_replies enable row level security;

create policy "all_calc_settings"    on calc_settings    for all using (true) with check (true);
create policy "all_calc_programs"    on calc_programs    for all using (true) with check (true);
create policy "all_wa_quick_replies" on wa_quick_replies for all using (true) with check (true);

-- ─── Seed: базовые настройки ─────────────────────────────────────────────────
insert into calc_settings (id, mrp, pm_nauryz, pm_other) values ('main', 4325, 10, 13)
on conflict (id) do nothing;

-- ─── Seed: программы ─────────────────────────────────────────────────────────
insert into calc_programs (key, name, icon, down_ratio, desc_text, sort_order, variants) values
  ('5050',     'Ипотека 50/50',      '🏛️', 0.50, 'Взнос 50%',  1, '[{"label":"8.5% — 8 лет","coeff":0.0080522},{"label":"5% — 6 лет","coeff":0.0080525}]'),
  ('3070',     'Программа 30/70',    '🏠', 0.30, 'Взнос 30%',  2, '[{"label":"~10-12 лет","coeff":0.00886788}]'),
  ('nauryz20', 'Наурыз 20%',         '🌸', 0.20, 'Взнос 20%',  3, '[{"label":"7% — 19 лет","coeff":0.00843335},{"label":"9% — 19 лет","coeff":0.0101}]'),
  ('nauryz10', 'Наурыз 10%',         '🌷', 0.10, 'Взнос 10%',  4, '[{"label":"7% — 19 лет","coeff":0.00943335},{"label":"9% — 19 лет","coeff":0.0111}]'),
  ('jasyl',    'Жасыл Ипотека',      '🌿', 0.20, 'Взнос 20%',  5, '[{"label":"7% очередники","coeff":0.00783333},{"label":"11% военные","coeff":0.01116667},{"label":"15% все","coeff":0.01241667}]'),
  ('askeri',   'Наурыз Аскери',      '🎖️', 0.00, 'Взнос 0%',   6, '[{"label":"1-8 лет","coeff":0.0127},{"label":"9-19 лет","coeff":0.00376}]'),
  ('720',      '7-20-25',            '🏗️', 0.20, 'Взнос 20% · первичка · макс 25 млн', 7, '[{"label":"7% — 25 лет","coeff":0.00783333}]'),
  ('otau',     'Отау',               '🏡', 0.20, 'Взнос 20% · до 35 лет',              8, '[{"label":"9% — 19 лет","coeff":0.0101}]'),
  ('umay',     'Умай ♀',             '🌺', 0.20, 'Взнос 20% · женщины · запуск 2026',  9, '[{"label":"14.4% — 25 лет","coeff":0.01241667}]')
on conflict (key) do nothing;

-- ─── Seed: быстрые ответы WA ─────────────────────────────────────────────────
insert into wa_quick_replies (trigger, title, body, category, sort_order) values
  ('/привет',    'Приветствие',           'Здравствуйте, {{имя}}! 👋 Меня зовут {{менеджер}}, я ваш ипотечный специалист. Готов помочь с подбором программы и расчётами. Чем могу помочь?', 'greeting', 1),
  ('/одобрено',  'Одобрение получено',    '🎉 Отличная новость, {{имя}}! Банк одобрил вашу заявку! Сумма: {{сумма}} ₸. Можем приступать к поиску квартиры. Когда вам удобно созвониться?', 'approval', 2),
  ('/отказ',     'Отказ банка',           'Здравствуйте, {{имя}}. К сожалению, на данный момент банк не одобрил заявку. Но не расстраивайтесь — есть другие варианты. Давайте разберём причины 💪', 'rejection', 3),
  ('/документы', 'Список документов',     '📋 Для оформления ипотеки нужны:\n✅ Удостоверение личности\n✅ У/Л супруги\n✅ Свидетельство о браке\n✅ Справка о доходах / ОПВ\n✅ Справка о задолженностях\n\nЕсть вопросы — пишите!', 'docs', 4),
  ('/расчёт',    'Расчёт готов',          '🧮 Расчёт по программе {{программа}}:\n\n💰 Цена: {{цена}} ₸\n📥 Взнос ({{пв}}%): {{взнос}} ₸\n🏦 Кредит: {{кредит}} ₸\n💳 Платёж/мес: {{платёж}} ₸\n📊 Ставка: {{ставка}}', 'calc', 5),
  ('/встреча',   'Приглашение на встречу','Здравствуйте, {{имя}}! Приглашаю на консультацию. Разберём варианты ипотеки и сделаем расчёты. Когда вам удобно? 🗓️', 'meeting', 6),
  ('/спасибо',   'Благодарность',         'Спасибо за доверие, {{имя}}! 🙏 Рады были помочь. Если будут вопросы — всегда на связи. Будем рады рекомендациям! ⭐', 'thanks', 7),
  ('/ожидание',  'Ждём ответ банка',      'Здравствуйте, {{имя}}! Заявка на рассмотрении. Обычно 1-3 рабочих дня. Как только будет ответ — сразу сообщу! 🕐', 'status', 8),
  ('/этапы',     'Этапы сделки',          '📋 Этапы оформления ипотеки:\n1️⃣ Предварительное одобрение\n2️⃣ Поиск квартиры\n3️⃣ Задаток\n4️⃣ Оценка недвижимости — 21 600 ₸\n5️⃣ Кред. заявка\n6️⃣ Одобрение\n7️⃣ ДКП нотариус\n8️⃣ Регистрация ДКП\n9️⃣ ДЗНИ\n🔟 Выдача денег\n\nОбычно 2-4 недели от одобрения до ключей!', 'docs', 9),
  ('/страховка', 'О страховке',           'По ипотеке обязательна страховка жилья (~0.3% от стоимости квартиры в год). Например, квартира 30 млн ₸ → страховка ~90 000 ₸/год. Подберём выгодный вариант! 🛡️', 'docs', 10)
on conflict (trigger) do nothing;

-- Проверка
select 'calc_settings' as tbl, count(*) from calc_settings
union all
select 'calc_programs', count(*) from calc_programs
union all
select 'wa_quick_replies', count(*) from wa_quick_replies;
