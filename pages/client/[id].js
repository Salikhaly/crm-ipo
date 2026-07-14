// pages/client/[id].js
// ПУБЛИЧНАЯ страница статуса заявки для клиента — открывается по ссылке с UUID,
// без логина. Менеджер копирует ссылку из карточки и отправляет клиенту.
// Показывает прогресс, текущий шаг и контакт менеджера. Минимум данных.

import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function ClientPortal() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)
  const [err,  setErr]  = useState('')

  useEffect(() => {
    if (!id) return
    fetch('/api/portal/' + id)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setErr('Заявка не найдена. Проверьте ссылку у вашего менеджера.'))
  }, [id])

  const S = {
    page:  { minHeight:'100vh', background:'linear-gradient(160deg,#0f172a,#1e3a5f)', fontFamily:"'Inter',system-ui,sans-serif", padding:'0 16px 40px' },
    card:  { maxWidth:520, margin:'0 auto', background:'#fff', borderRadius:20, padding:'24px 22px', boxShadow:'0 20px 60px rgba(0,0,0,.3)' },
  }

  return (
    <div style={S.page}>
      <Head>
        <title>Статус вашей заявки — Ипотека</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>

      <div style={{textAlign:'center', padding:'30px 0 20px', color:'#fff'}}>
        <div style={{fontSize:34, marginBottom:6}}>🏠</div>
        <div style={{fontSize:17, fontWeight:800}}>Ипотечный брокер</div>
        <div style={{fontSize:13, color:'#94a3b8'}}>Статус вашей заявки</div>
      </div>

      {err && (
        <div style={S.card}>
          <div style={{textAlign:'center', color:'#64748b', fontSize:14, lineHeight:1.6, padding:'20px 0'}}>
            <i className="ti ti-search-off" style={{fontSize:38, color:'#cbd5e1', display:'block', marginBottom:12}}/>
            {err}
          </div>
        </div>
      )}

      {!err && !data && (
        <div style={S.card}>
          <div style={{textAlign:'center', color:'#94a3b8', padding:'30px 0'}}>Загрузка…</div>
        </div>
      )}

      {data && (
        <div style={S.card}>
          <div style={{fontSize:20, fontWeight:900, color:'#0f172a', marginBottom:2}}>
            Здравствуйте, {data.firstName}! 👋
          </div>
          <div style={{fontSize:13.5, color:'#64748b', marginBottom:18}}>Вот как продвигается ваша заявка на ипотеку.</div>

          {/* Прогресс */}
          <div style={{background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:14, padding:'15px 16px', marginBottom:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
              <div style={{fontSize:12, fontWeight:700, color:'#166534', textTransform:'uppercase', letterSpacing:'.05em'}}>Текущий этап</div>
              <div style={{fontSize:15, fontWeight:900, color:'#16a34a'}}>{data.progress}%</div>
            </div>
            <div style={{fontSize:17, fontWeight:800, color:'#0f172a', marginBottom:10}}>{data.stage}</div>
            <div style={{height:8, background:'#dcfce7', borderRadius:20, overflow:'hidden'}}>
              <div style={{height:'100%', width:data.progress+'%', background:'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius:20, transition:'width .5s'}}/>
            </div>
          </div>

          {/* Что сейчас */}
          <div style={{display:'flex', gap:11, background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:13, padding:'13px 15px', marginBottom:16}}>
            <i className="ti ti-info-circle" style={{fontSize:20, color:'#3b82f6', flexShrink:0, marginTop:1}}/>
            <div style={{fontSize:13.5, color:'#1e40af', lineHeight:1.55}}>{data.step}</div>
          </div>

          {/* Цепочка этапов */}
          <div style={{marginBottom:18}}>
            {data.stages.map((st, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:11, padding:'7px 0'}}>
                <div style={{width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  background: st.done ? '#22c55e' : st.current ? '#3b82f6' : '#e2e8f0',
                  color: (st.done||st.current) ? '#fff' : '#94a3b8', fontSize:11, fontWeight:800}}>
                  {st.done ? '✓' : i+1}
                </div>
                <div style={{fontSize:13.5, fontWeight: st.current?800:500, color: st.current?'#0f172a':st.done?'#334155':'#94a3b8'}}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* Менеджер */}
          {data.manager && (
            <div style={{background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:13, padding:'13px 15px'}}>
              <div style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6}}>Ваш консультант</div>
              <div style={{fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:8}}>{data.manager.name || 'Менеджер'}</div>
              {data.manager.phone && (
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  <a href={'tel:'+data.manager.phone} style={{flex:1, minWidth:120, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#3b82f6', color:'#fff', textDecoration:'none', borderRadius:10, padding:'10px', fontSize:13.5, fontWeight:700}}>
                    <i className="ti ti-phone"/>Позвонить
                  </a>
                  <a href={'https://wa.me/'+data.manager.phone.replace(/\D/g,'')} target="_blank" rel="noreferrer" style={{flex:1, minWidth:120, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#25d366', color:'#fff', textDecoration:'none', borderRadius:10, padding:'10px', fontSize:13.5, fontWeight:700}}>
                    <i className="ti ti-brand-whatsapp"/>WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}

          <div style={{textAlign:'center', fontSize:11.5, color:'#94a3b8', marginTop:16, lineHeight:1.5}}>
            Эта страница обновляется автоматически по мере продвижения заявки.<br/>Сохраните ссылку, чтобы следить за статусом.
          </div>
        </div>
      )}
    </div>
  )
}
