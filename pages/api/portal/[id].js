// pages/api/portal/[id].js
// ПУБЛИЧНЫЙ статус заявки для клиента (без авторизации — доступ по ссылке с UUID).
// Отдаёт ТОЛЬКО безопасный минимум: имя, этап/прогресс, следующий шаг, контакт
// менеджера. НИКОГДА не отдаёт ИИН, доходы, комментарии, других клиентов.

import { getSupabase } from '../../../lib/supabase'
import { PIPELINE_DEFAULT } from '../../../lib/constants'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const { id } = req.query
  // Ожидаем UUID — грубая защита от перебора/мусора
  if (!id || !/^[0-9a-f-]{20,40}$/i.test(String(id))) {
    return res.status(404).json({ error: 'not found' })
  }

  const sb = getSupabase()
  const { data: c } = await sb
    .from('clients')
    .select('id, fio, stage, manager, contract_type')
    .eq('id', id)
    .maybeSingle()
  if (!c) return res.status(404).json({ error: 'not found' })

  // Этап и прогресс
  const idx  = Math.max(0, PIPELINE_DEFAULT.findIndex(p => p.id === c.stage))
  const total = PIPELINE_DEFAULT.length - 1  // без «Закрыто»
  const stageLabel = PIPELINE_DEFAULT.find(p => p.id === c.stage)?.l || 'В работе'
  const pct = c.stage === 'closed' ? 100 : Math.round((idx / total) * 100)

  // Что сейчас происходит — короткая подсказка клиенту по этапу
  const NEXT = {
    new_lead:      'Мы получили вашу заявку. Менеджер скоро свяжется с вами.',
    in_work:       'Менеджер работает с вашей заявкой и скоро задаст уточняющие вопросы.',
    analysis:      'Анализируем ваши доходы и кредитную историю, подбираем программу.',
    consultation:  'Готовим консультацию: расскажем про подходящие программы и условия.',
    contract:      'Оформляем договор на сопровождение. Ознакомьтесь с условиями.',
    accompaniment: 'Собираем документы и готовим заявку в банк. Присылайте документы менеджеру.',
    approval:      'Заявка на рассмотрении в банке. Ожидаем решение — сообщим сразу.',
    deal:          'Готовимся к сделке. Скоро согласуем дату и место подписания.',
    issuance:      'Финальный этап — выдача ипотеки. Поздравляем, вы почти у цели!',
    closed:        'Заявка завершена. Спасибо, что были с нами!',
  }

  // Контакт менеджера (только имя и телефон)
  let manager = null
  if (c.manager) {
    const { data: m } = await sb.from('managers').select('name, phone').eq('id', c.manager).maybeSingle()
    if (m) manager = { name: m.name || '', phone: m.phone || '' }
  }

  return res.status(200).json({
    firstName: String(c.fio || '').split(' ')[0] || 'Клиент',
    stage: stageLabel,
    stageId: c.stage,
    progress: pct,
    step: NEXT[c.stage] || 'Ваша заявка в работе.',
    stages: PIPELINE_DEFAULT.filter(p => p.id !== 'closed').map((p, i) => ({
      l: p.l, done: c.stage === 'closed' ? true : i < idx, current: i === idx,
    })),
    manager,
  })
}
