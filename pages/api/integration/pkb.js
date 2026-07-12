// pages/api/integration/pkb.js
// POST — приём лида из десктоп-приложения ПКБ (автопередача после создания анкеты).
// Авторизация: заголовок x-api-key === env PKB_API_KEY (или WEBHOOK_SECRET как fallback).
// Дедуп: по нормализованному телефону или ИИН — существующий клиент обновляется
// (доход/нагрузка/кредиты + запись в ленту), новый создаётся на этапе «Новый лид».

import { getSupabase, dbToClient, clientToDb, addSavedCalcs, addCloseReason, addTags, addCustom, addPkbFields, findMissingOptionalColumn, normalizePhone } from '../../../lib/supabase'
import { emptyClient, uid } from '../../../lib/constants'
import { logAction } from '../../../lib/actionLog'

const num = v => {
  const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10)
  return isFinite(n) && n > 0 ? String(n) : ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key = process.env.PKB_API_KEY || process.env.WEBHOOK_SECRET
  if (!key || req.headers['x-api-key'] !== key) {
    return res.status(401).json({ error: 'Неверный API-ключ' })
  }

  try {
    const b = req.body || {}
    const fio   = String(b.fio || '').trim()
    const phone = String(b.phone || '').trim()
    const iinD  = String(b.iin || '').replace(/\D/g, '')
    const iin   = /^\d{12}$/.test(iinD) ? iinD : ''
    if (!fio && !phone && !iin) return res.status(400).json({ error: 'Пустой лид: нужен ФИО, телефон или ИИН' })

    const sb = getSupabase()
    const pkbUser = { name: b.manager ? `ПКБ · ${b.manager}` : 'ПКБ-приложение', id: 'pkb' }
    const noteBits = []
    if (b.goal)   noteBits.push('Цель: ' + b.goal)
    if (b.pkr)    noteBits.push('ПКР: ' + b.pkr)
    if (num(b.onhand)) noteBits.push('Нал. на руках: ' + num(b.onhand))
    const note = noteBits.join(' · ')
    const credits = Array.isArray(b.credits) ? b.credits.slice(0, 50) : undefined

    // ── Поиск существующего клиента (телефон → ИИН) ──
    let existing = null
    if (phone) {
      // Хвост из 10 цифр находит и старые ненормализованные записи (8707… / 707…)
      const tail = String(normalizePhone(phone)).replace(/\D/g, '').slice(-10)
      if (tail.length === 10) {
        const { data } = await sb.from('clients').select('*').ilike('phone', '%' + tail).limit(1)
        existing = (data && data[0]) || null
      }
    }
    if (!existing && iin) {
      const { data } = await sb.from('clients').select('*').eq('iin', iin).maybeSingle()
      existing = data || null
    }

    // ── Менеджер по имени (если передан и найден) ──
    let managerId = null
    if (b.manager) {
      const { data: mgrs } = await sb.from('managers').select('id, name')
      const m = (mgrs || []).find(x => (x.name || '').trim().toLowerCase() === String(b.manager).trim().toLowerCase())
      managerId = m?.id || null
    }

    const sysComment = text => ({ id: uid(), text, author: pkbUser.name, date: new Date().toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }), sys: true })

    if (existing) {
      // ── Обновление: свежие цифры из анкеты + запись в ленту ──
      const patch = {}
      if (num(b.srzp))   patch.official_income = num(b.srzp)
      if (num(b.load))   patch.monthly_load    = num(b.load)
      if (num(b.onhand)) patch.down_payment    = num(b.onhand)
      if (num(b.cash))   patch.deposit_amount  = num(b.cash)
      if (credits)       patch.credits         = credits
      patch.comments = [...(existing.comments || []), sysComment('📥 Обновление из ПКБ' + (note ? ' · ' + note : ''))]

      let { error } = await sb.from('clients').update(patch).eq('id', existing.id)
      for (let missing = findMissingOptionalColumn(error, patch); missing; missing = findMissingOptionalColumn(error, patch)) {
        delete patch[missing]
        ;({ error } = await sb.from('clients').update(patch).eq('id', existing.id))
      }
      if (error) return res.status(500).json({ error: 'DB error' })

      logAction({ action:'update', entity:'client', entityId:existing.id, entityName:existing.fio || fio, detail:'анкета ПКБ', user:pkbUser })
      return res.status(200).json({ ok: true, action: 'updated', id: existing.id })
    }

    // ── Создание нового лида ──
    const full = {
      ...emptyClient(managerId || ''),
      id: uid(),
      fio, iin, phone,
      source: 'other',
      stage: 'new_lead',
      tags: ['пкб'],
      officialIncome: num(b.srzp),
      monthlyLoad:    num(b.load),
      downPayment:    num(b.onhand),
      depositAmount:  num(b.cash),
      comments: note || credits ? [sysComment('📥 Лид из ПКБ' + (note ? ' · ' + note : ''))] : [],
    }
    if (credits) full.credits = credits

    const row = clientToDb(full)
    addSavedCalcs(row, full); addCloseReason(row, full); addTags(row, full); addCustom(row, full); addPkbFields(row, full)

    let { data, error } = await sb.from('clients').insert(row).select().single()
    for (let missing = findMissingOptionalColumn(error, row); missing; missing = findMissingOptionalColumn(error, row)) {
      delete row[missing]
      ;({ data, error } = await sb.from('clients').insert(row).select().single())
    }
    if (error) return res.status(500).json({ error: 'DB error' })

    logAction({ action:'create', entity:'client', entityId:data.id, entityName:fio || phone, detail:'анкета ПКБ', user:pkbUser })
    return res.status(201).json({ ok: true, action: 'created', id: data.id, client: dbToClient(data) })
  } catch (e) {
    console.error('[integration/pkb]', e.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
