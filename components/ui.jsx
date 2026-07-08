// components/ui.jsx
// Общие UI-примитивы — вынесены из pages/index.js.
// Зависят от констант (PIPELINE_DEFAULT, SRC, CR).

import React from 'react'
import { PIPELINE_DEFAULT, SRC, CR } from '../lib/constants'

export function Fl({ l, req, ch }) {
  return <div style={{marginBottom:13}}>
    <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5}}>
      {l}{req && <span style={{color:'#ef4444',marginLeft:3}}>*</span>}
    </div>
    {ch}
  </div>
}

export function Tag({ c, ch }) {
  return <span style={{padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:c+'22',color:c,display:'inline-flex',alignItems:'center',gap:3,whiteSpace:'nowrap'}}>{ch}</span>
}

export function StTag({ id, pl }) {
  const p = (pl||PIPELINE_DEFAULT).find(x => x.id === id)
  return p ? <Tag c={p.c} ch={p.l}/> : null
}

export function SrTag({ id }) {
  const s = SRC[id]
  return s ? <span style={{padding:'2px 6px',borderRadius:4,fontSize:10,fontWeight:700,textTransform:'uppercase',background:s.c+'22',color:s.c}}>{s.l}</span> : null
}

export function CrTag({ id }) {
  const c = CR[id]
  return c ? <Tag c={c.c} ch={c.l}/> : null
}

export function Tgl({ on, onClick }) {
  return <div onClick={onClick} style={{width:40,height:22,background:on?'#3b82f6':'#cbd5e1',borderRadius:20,position:'relative',cursor:'pointer',transition:'background .2s',flexShrink:0,display:'inline-block'}}>
    <div style={{position:'absolute',top:3,left:on?21:3,width:16,height:16,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
  </div>
}

export function Prog({ pct, c, sz='h' }) {
  const h = sz==='h'?7:sz==='sm'?5:4
  return <div style={{background:'#e2e8f0',borderRadius:20,overflow:'hidden',height:h}}>
    <div style={{height:'100%',width:`${Math.min(100,Math.max(0,pct||0))}%`,background:c||'#3b82f6',borderRadius:20,transition:'width .4s'}}/>
  </div>
}

// forwardRef + ...rest: пробрасывает ref, onKeyDown, autoFocus и любые другие
// нативные пропсы (раньше они молча игнорировались)
export const Inp = React.forwardRef(function Inp({ value, onChange, placeholder, type='text', disabled, maxLength, style={}, ...rest }, ref) {
  return <input ref={ref} type={type} value={value||''} onChange={onChange} placeholder={placeholder} disabled={disabled} maxLength={maxLength}
    {...rest}
    style={{background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',color:'#0f172a',fontSize:14,width:'100%',outline:'none',transition:'border .15s',...style}}
    onFocus={e=>e.target.style.borderColor='#3b82f6'}
    onBlur={e=>e.target.style.borderColor='#cbd5e1'}
  />
})

export function Sel({ value, onChange, children, disabled, style={} }) {
  return <select value={value||''} onChange={onChange} disabled={disabled}
    style={{background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',color:'#0f172a',fontSize:14,width:'100%',outline:'none',cursor:'pointer',...style}}>
    {children}
  </select>
}

export function Btn({ children, onClick, variant='ghost', size='md', disabled, style={} }) {
  const base = {display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,border:'2px solid transparent',borderRadius:10,fontFamily:'inherit',fontWeight:700,cursor:disabled?'not-allowed':'pointer',transition:'all .15s',whiteSpace:'nowrap',opacity:disabled?.6:1,...style}
  const sz   = size==='sm'?{padding:'6px 11px',fontSize:12,borderRadius:8}:size==='lg'?{padding:'13px 22px',fontSize:15,borderRadius:14}:{padding:'9px 15px',fontSize:13}
  const va   = variant==='primary'?{background:'#3b82f6',color:'#fff'}:variant==='success'?{background:'#10b981',color:'#fff'}:variant==='danger'?{background:'#fef2f2',color:'#ef4444',borderColor:'#fecaca'}:variant==='warn'?{background:'#fffbeb',color:'#f59e0b',borderColor:'#fde68a'}:{background:'#f1f5f9',color:'#64748b',borderColor:'#cbd5e1'}
  return <button onClick={disabled?undefined:onClick} style={{...base,...sz,...va}}>{children}</button>
}
