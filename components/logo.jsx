// components/logo.jsx
// Фирменный знак: дом с замочной скважиной («ключи от дома»).
// Используется на логине, в сайдбаре, на лендинге и в favicon.svg —
// при изменении формы обновить и public/favicon.svg.

import React from 'react'

export function Logo({ size = 36, radius = 12, id = 'lgrad' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="Логотип">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb"/>
          <stop offset="1" stopColor="#1e3a8a"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={radius} fill={`url(#${id})`}/>
      {/* Дом */}
      <path d="M24 9.5 L39 22.5 H34.5 V37 H13.5 V22.5 H9 Z" fill="#fff"/>
      {/* Замочная скважина */}
      <circle cx="24" cy="25.5" r="3.4" fill="#1e3a8a"/>
      <path d="M22.4 27.5 L21.2 33.5 H26.8 L25.6 27.5 Z" fill="#1e3a8a"/>
    </svg>
  )
}

// Знак + название в строку (сайдбар, шапка лендинга)
export function LogoRow({ size = 30, dark = false, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <Logo size={size} id={dark ? 'lgrad-d' : 'lgrad-r'}/>
      <div>
        <div style={{ fontSize:15, fontWeight:900, letterSpacing:'-.3px', color: dark ? '#fff' : '#0f172a', lineHeight:1.1 }}>
          Ипотека CRM
        </div>
        {sub && <div style={{ fontSize:9.5, color: dark ? '#64748b' : '#94a3b8', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  )
}
