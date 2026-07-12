// pages/promo.js
// Продающий лендинг — crm-ipo.vercel.app/promo
// Полностью автономная страница: не тянет данные, не требует логина.
// ⚠️ ЗАМЕНИТЕ WA_PHONE на свой номер WhatsApp для приёма заявок!

import React from 'react'
import Head from 'next/head'
import { Logo } from '../components/logo'

// Номер задаётся в Vercel → Environment Variables → NEXT_PUBLIC_WA_PHONE (без +).
// Пока не задан — используется заглушка: ЗАЯВКИ С ЛЕНДИНГА НИКУДА НЕ ПРИХОДЯТ!
const WA_PHONE = process.env.NEXT_PUBLIC_WA_PHONE || '77000000000'
const WA_TEXT  = encodeURIComponent('Здравствуйте! Интересует Ипотека CRM — хочу демо.')
const WA_LINK  = `https://wa.me/${WA_PHONE}?text=${WA_TEXT}`

// ─── мелкие блоки ─────────────────────────────────────────────────
const Cta = ({ children, ghost, href = WA_LINK, style }) => (
  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
    className={ghost ? 'cta cta-ghost' : 'cta'} style={style}>{children}</a>
)

const SectionTitle = ({ kicker, title, sub }) => (
  <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 36px' }}>
    {kicker && <div className="kicker">{kicker}</div>}
    <h2 className="h2">{title}</h2>
    {sub && <p className="sub">{sub}</p>}
  </div>
)

// CSS-мокап канбана для hero (вместо скриншота — всегда чётко в любом размере)
function KanbanMock() {
  const cols = [
    { l:'Новый лид', c:'#6366f1', cards:[['Айгерим С.','WhatsApp · 5 мин назад'],['Данияр К.','Instagram']] },
    { l:'Анализ', c:'#f59e0b', cards:[['Мадина Т.','Наурыз 20% · 32 млн ₸']] },
    { l:'Сопровождение', c:'#14b8a6', cards:[['Ерлан Ж.','Этап 6/11 · Одобрение ✓'],['Салтанат Б.','Отбасы банк']] },
    { l:'Выдача', c:'#22c55e', cards:[['Арман Н.','🔑 Ключи 15 июля']] },
  ]
  return (
    <div className="mock">
      <div className="mock-top">
        <span className="mock-dot" style={{background:'#f87171'}}/>
        <span className="mock-dot" style={{background:'#fbbf24'}}/>
        <span className="mock-dot" style={{background:'#34d399'}}/>
        <span style={{marginLeft:10,fontSize:11,color:'#94a3b8',fontWeight:600}}>Ипотека CRM — Клиенты</span>
      </div>
      <div className="mock-body">
        {cols.map(col => (
          <div key={col.l} className="mock-col">
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:7}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:col.c}}/>
              <span style={{fontSize:10.5,fontWeight:800,color:col.c}}>{col.l}</span>
            </div>
            {col.cards.map(([n,s]) => (
              <div key={n} className="mock-card">
                <div style={{fontSize:11,fontWeight:700,color:'#0f172a'}}>{n}</div>
                <div style={{fontSize:9.5,color:'#94a3b8',marginTop:2}}>{s}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Promo() {
  return (
    <>
      <Head>
        <title>Ипотека CRM — система для ипотечных брокеров Казахстана</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <meta name="description" content="Лид из WhatsApp → расчёт по госпрограммам (Наурыз, Отбасы, 7-20-25) → сопровождение до ключей. CRM, созданная ипотечными брокерами для ипотечных брокеров."/>
        <meta property="og:title" content="Ипотека CRM — для ипотечных брокеров Казахстана"/>
        <meta property="og:description" content="WhatsApp-лиды, расчёт госпрограмм РК, маршруты сопровождения со скриптами, KPI. В одной системе."/>
        <link rel="icon" href="/favicon.svg"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      </Head>

      <div className="lp">
        {/* ── ШАПКА ── */}
        <header className="hdr">
          <div className="wrap hdr-in">
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Logo size={34} id="lp-logo"/>
              <span style={{fontWeight:900,fontSize:16,letterSpacing:'-.3px'}}>Ипотека CRM</span>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <a href="/" className="hdr-link">Войти</a>
              <Cta style={{padding:'9px 16px',fontSize:13}}>Получить демо</Cta>
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="hero">
          <div className="wrap hero-in">
            <div className="hero-txt">
              <div className="kicker">Создана брокерами — для брокеров 🇰🇿</div>
              <h1 className="h1">CRM для ипотечных брокеров Казахстана</h1>
              <p className="sub" style={{fontSize:17}}>
                Лид из WhatsApp → расчёт по госпрограммам → договор → сопровождение до ключей.
                Всё в одной системе, менеджер всегда знает, <b>что делать и что говорить</b>.
              </p>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}>
                <Cta>💬 Получить демо в WhatsApp</Cta>
                <Cta ghost href="/">У меня есть доступ → Войти</Cta>
              </div>
              <div style={{display:'flex',gap:18,marginTop:22,flexWrap:'wrap'}}>
                {[['13','калькуляторов'],['7','маршрутов сделки'],['24/7','приём WA-лидов']].map(([v,l]) => (
                  <div key={l}><span style={{fontWeight:900,fontSize:20,color:'#1d4ed8'}}>{v}</span> <span style={{color:'#64748b',fontSize:13}}>{l}</span></div>
                ))}
              </div>
            </div>
            <div className="hero-mock"><KanbanMock/></div>
          </div>
        </section>

        {/* ── БОЛЬ → РЕШЕНИЕ ── */}
        <section className="sec">
          <div className="wrap">
            <SectionTitle kicker="Знакомо?" title="Три причины, почему брокеры теряют сделки"/>
            <div className="grid3">
              {[
                ['📱','Лиды тонут в личных ватсапах','Клиент написал вечером — менеджер увидел через день. У нас: общий WhatsApp-инбокс, лид создаётся сам, автоответ мгновенно, звук и бейдж менеджеру.'],
                ['📊','Расчёты в Excel и «на глазок»','Наурыз, Отбасы, 7-20-25, 50/50 — у каждой программы свои правила. У нас: расчёт за 30 секунд, PDF клиенту, ставки правит админ без программиста.'],
                ['🤷','Новичок не знает, что говорить','Опыт — в голове у старших. У нас: на каждом этапе сделки чек-лист, подсказка «что делать» и готовый скрипт «что сказать клиенту».'],
              ].map(([i,t,d]) => (
                <div key={t} className="card3">
                  <div style={{fontSize:30,marginBottom:10}}>{i}</div>
                  <div style={{fontWeight:800,fontSize:16,marginBottom:8}}>{t}</div>
                  <div style={{fontSize:13.5,color:'#64748b',lineHeight:1.6}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── КАК РАБОТАЕТ ── */}
        <section className="sec sec-alt">
          <div className="wrap">
            <SectionTitle kicker="Как это работает" title="От сообщения до ключей — один поток"/>
            <div className="steps">
              {[
                ['1','Клиент пишет в WhatsApp','Лид появляется в CRM сам, получает автоответ. Менеджер видит уведомление.'],
                ['2','Расчёт за 30 секунд','Менеджер жмёт «Рассчитать» — платёж по госпрограммам уходит клиенту в чат или PDF.'],
                ['3','Договор и оплата','Тип договора, сумма, график платежей. CRM сама ставит задачи на каждом этапе.'],
                ['4','Сопровождение до ключей','Маршрут под программу: чек-листы, документы в Google Drive, скрипты для менеджера.'],
              ].map(([n,t,d]) => (
                <div key={n} className="step">
                  <div className="step-n">{n}</div>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>{t}</div>
                  <div style={{fontSize:13,color:'#64748b',lineHeight:1.55}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ГОСПРОГРАММЫ ── */}
        <section className="sec">
          <div className="wrap" style={{textAlign:'center'}}>
            <SectionTitle title="Госпрограммы РК — из коробки" sub="То, чего нет ни в amoCRM, ни в Bitrix. Ставки и условия обновляет ваш админ за минуту."/>
            <div style={{display:'flex',gap:9,flexWrap:'wrap',justifyContent:'center'}}>
              {['🌸 Наурыз 10/20%','🏠 7-20-25','🏦 Отбасы банк','🏛️ 50/50','🌿 Жасыл','🎖️ Аскери','🏠 Отау','👨‍👩‍👧 Бақытты отбасы','💼 Коммерческие банки'].map(p => (
                <span key={p} className="chip">{p}</span>
              ))}
            </div>
            <div style={{marginTop:22,fontSize:13.5,color:'#64748b'}}>
              Плюс: расчёт ОПВ и доходов, план «как добрать до нужной зарплаты», налоги для бухгалтера, аренда-vs-ипотека, досрочное погашение.
            </div>
          </div>
        </section>

        {/* ── ДЛЯ КОГО ── */}
        <section className="sec sec-alt">
          <div className="wrap">
            <SectionTitle kicker="Для кого" title="Работает для всей команды"/>
            <div className="grid4">
              {[
                ['🧑‍💼','Менеджер','Канбан, звонок и WA в 1 клик, калькулятор, «следующий шаг» по каждому клиенту.'],
                ['🤝','Специалист','Маршруты сопровождения, чек-листы этапов, документы клиента в Google Drive.'],
                ['📈','Руководитель','KPI: воронка, источники, причины потерь, выручка по менеджерам. Всё считается само.'],
                ['⚙️','Админ','Ставки программ, шаблоны WhatsApp, чек-листы, пользователи — без программиста.'],
              ].map(([i,t,d]) => (
                <div key={t} className="card3" style={{textAlign:'center'}}>
                  <div style={{fontSize:26,marginBottom:8}}>{i}</div>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>{t}</div>
                  <div style={{fontSize:12.5,color:'#64748b',lineHeight:1.55}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ТАРИФЫ ── */}
        <section className="sec" id="price">
          <div className="wrap">
            <SectionTitle kicker="Тарифы" title="Настроим под вас за 1 день" sub="Отдельная защищённая база под каждое агентство — ваши клиенты только ваши."/>
            <div className="grid3">
              {[
                ['Соло','15 000 ₸/мес','Для независимого консультанта',['1 пользователь','WhatsApp-инбокс','Все калькуляторы','Карточки клиентов'],false],
                ['Команда','49 000 ₸/мес','Для агентства до 5 человек',['До 5 пользователей','Роли и доступы','KPI и воронка','Google Drive','Автоответ лидам'],true],
                ['Агентство','99 000 ₸/мес','Для команды 5–15 человек',['До 15 пользователей','Отдельная инсталляция','Обучение команды','Приоритетная поддержка'],false],
              ].map(([name,price,who,feats,hot]) => (
                <div key={name} className={'price' + (hot ? ' price-hot' : '')}>
                  {hot && <div className="price-badge">Популярный</div>}
                  <div style={{fontWeight:800,fontSize:17}}>{name}</div>
                  <div style={{fontWeight:900,fontSize:26,color:'#1d4ed8',margin:'8px 0 2px'}}>{price}</div>
                  <div style={{fontSize:12.5,color:'#94a3b8',marginBottom:14}}>{who}</div>
                  {feats.map(f => <div key={f} style={{fontSize:13.5,padding:'5px 0',color:'#334155'}}>✓ {f}</div>)}
                  <Cta style={{width:'100%',justifyContent:'center',display:'flex',marginTop:14}}>Обсудить в WhatsApp</Cta>
                </div>
              ))}
            </div>
            <div style={{textAlign:'center',marginTop:18,fontSize:13,color:'#64748b'}}>
              Разовая настройка (база, WhatsApp, программы, обучение) — обсуждается отдельно. Первые 14 дней — бесплатно.
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="sec sec-alt">
          <div className="wrap" style={{maxWidth:760}}>
            <SectionTitle kicker="Вопросы" title="Частые вопросы"/>
            {[
              ['Чем это лучше amoCRM?','amoCRM — универсальная CRM, она не знает про Наурыз, Отбасы и ОПВ. Здесь ипотека РК зашита в ядро: калькуляторы, маршруты сделок, скрипты. И это дешевле.'],
              ['Наши данные в безопасности?','У каждого агентства отдельная база данных (Supabase). Доступ только через сервер с ролями, прямого доступа к базе нет. Логины и права раздаёте вы.'],
              ['Сложно ли перенести клиентов?','Поможем с переносом при настройке. Новые лиды из WhatsApp появляются в системе сами.'],
              ['Менеджеры не захотят заполнять…','Большинство заполняется само: лиды из WhatsApp, автозадачи, автоответы. Менеджеру остаётся ставить галочки — а взамен он получает готовые расчёты и скрипты.'],
              ['Ставки по программам поменялись — что делать?','Админ меняет ставку в панели за минуту. Без программиста и обновлений.'],
            ].map(([q,a]) => (
              <div key={q} className="faq">
                <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>{q}</div>
                <div style={{fontSize:13.5,color:'#64748b',lineHeight:1.6}}>{a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ФИНАЛЬНЫЙ CTA ── */}
        <section className="sec final">
          <div className="wrap" style={{textAlign:'center'}}>
            <h2 className="h2" style={{color:'#fff'}}>Покажем систему на ваших сценариях</h2>
            <p style={{color:'#94a3b8',fontSize:15,maxWidth:520,margin:'10px auto 24px',lineHeight:1.6}}>
              Напишите в WhatsApp — проведём демо за 15 минут и настроим систему под ваше агентство за 1 день.
            </p>
            <Cta style={{fontSize:15,padding:'14px 26px'}}>💬 Написать в WhatsApp</Cta>
          </div>
        </section>

        <footer className="ftr">
          <div className="wrap" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <Logo size={24} id="lp-logo-f"/>
              <span style={{fontSize:13,fontWeight:700}}>Ипотека CRM</span>
            </div>
            <div style={{fontSize:12,color:'#94a3b8'}}>Сделано в Казахстане · {new Date().getFullYear()}</div>
            <a href="/" className="hdr-link" style={{fontSize:13}}>Вход для клиентов</a>
          </div>
        </footer>

        {/* Плавающая WA-кнопка (мобильные) */}
        <a href={WA_LINK} target="_blank" rel="noreferrer" className="wa-float" aria-label="Написать в WhatsApp">💬</a>
      </div>

      <style jsx global>{`
        .lp{font-family:'Inter',system-ui,sans-serif;color:#0f172a;background:#fff;-webkit-font-smoothing:antialiased}
        .lp *{box-sizing:border-box;margin:0;padding:0}
        .wrap{max-width:1080px;margin:0 auto;padding:0 20px}
        .kicker{display:inline-block;font-size:12px;font-weight:800;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:5px 13px;margin-bottom:14px;letter-spacing:.02em}
        .h1{font-size:42px;font-weight:900;letter-spacing:-1.5px;line-height:1.08;margin-bottom:16px}
        .h2{font-size:30px;font-weight:900;letter-spacing:-.8px;line-height:1.15}
        .sub{font-size:15px;color:#475569;line-height:1.65;margin-top:12px}
        .cta{display:inline-flex;align-items:center;gap:7px;background:#1d4ed8;color:#fff;font-weight:800;font-size:14px;padding:12px 20px;border-radius:12px;text-decoration:none;transition:all .16s;box-shadow:0 4px 14px rgba(29,78,216,.3)}
        .cta:hover{background:#1e40af;transform:translateY(-1px);box-shadow:0 6px 20px rgba(29,78,216,.4)}
        .cta-ghost{background:#fff;color:#1d4ed8;border:2px solid #bfdbfe;box-shadow:none}
        .cta-ghost:hover{background:#eff6ff;box-shadow:none}
        .hdr{position:sticky;top:0;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid #e2e8f0;z-index:100}
        .hdr-in{display:flex;justify-content:space-between;align-items:center;padding-top:12px;padding-bottom:12px}
        .hdr-link{color:#475569;font-weight:700;font-size:14px;text-decoration:none}
        .hdr-link:hover{color:#1d4ed8}
        .hero{background:linear-gradient(180deg,#f8fafc,#eff6ff);padding:64px 0 72px;overflow:hidden}
        .hero-in{display:grid;grid-template-columns:1.1fr 1fr;gap:44px;align-items:center}
        .sec{padding:72px 0}
        .sec-alt{background:#f8fafc}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .card3{background:#fff;border:1.5px solid #e2e8f0;border-radius:18px;padding:26px 24px;box-shadow:0 1px 4px rgba(15,23,42,.05)}
        .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .step{background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;padding:22px 20px}
        .step-n{width:32px;height:32px;border-radius:10px;background:#1d4ed8;color:#fff;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
        .chip{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:22px;padding:9px 16px;font-size:13.5px;font-weight:700;color:#334155}
        .price{position:relative;background:#fff;border:1.5px solid #e2e8f0;border-radius:20px;padding:26px 24px}
        .price-hot{border:2.5px solid #1d4ed8;box-shadow:0 10px 34px rgba(29,78,216,.15)}
        .price-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#1d4ed8;color:#fff;font-size:11px;font-weight:800;border-radius:20px;padding:4px 13px}
        .faq{background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px 20px;margin-bottom:10px}
        .final{background:linear-gradient(140deg,#0f172a,#1e3a5f)}
        .ftr{border-top:1px solid #e2e8f0;padding:20px 0}
        .mock{background:#fff;border:1.5px solid #dbe3ee;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,.14);overflow:hidden}
        .mock-top{display:flex;align-items:center;gap:5px;padding:10px 14px;border-bottom:1px solid #eef2f7;background:#f8fafc}
        .mock-dot{width:9px;height:9px;border-radius:50%}
        .mock-body{display:flex;gap:8px;padding:12px;overflow:hidden}
        .mock-col{flex:1;min-width:0;background:#f4f7fb;border-radius:10px;padding:8px}
        .mock-card{background:#fff;border:1px solid #e6ebf2;border-radius:8px;padding:7px 8px;margin-bottom:6px;box-shadow:0 1px 2px rgba(15,23,42,.05)}
        .wa-float{display:none;position:fixed;bottom:18px;right:16px;width:54px;height:54px;border-radius:50%;background:#25d366;color:#fff;font-size:24px;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(37,211,102,.45);z-index:200;text-decoration:none}
        @media(max-width:900px){
          .hero-in{grid-template-columns:1fr;gap:30px}
          .h1{font-size:32px}
          .h2{font-size:24px}
          .grid3{grid-template-columns:1fr}
          .grid4,.steps{grid-template-columns:1fr 1fr}
          .sec{padding:52px 0}
          .wa-float{display:flex}
        }
        @media(max-width:520px){
          .grid4,.steps{grid-template-columns:1fr}
          .h1{font-size:28px}
        }
      `}</style>
    </>
  )
}
