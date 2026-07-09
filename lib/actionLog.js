// lib/actionLog.js
// Серверный журнал действий. Fire-and-forget: НИКОГДА не бросает и не блокирует
// основной запрос — если таблицы action_logs нет (миграция 014 не применена)
// или БД недоступна, просто молча пропускаем. Смотреть: вкладка «Журнал» в админке.

import { getSupabase } from './supabase'

// entry: { action, entity, entityId, entityName, detail, user }
// user — req.user из withAuth ({ name, id })
export async function logAction(entry) {
  try {
    const sb = getSupabase()
    await sb.from('action_logs').insert({
      action:      String(entry.action || '').slice(0, 40),
      entity:      String(entry.entity || '').slice(0, 40),
      entity_id:   entry.entityId != null ? String(entry.entityId).slice(0, 80) : null,
      entity_name: entry.entityName ? String(entry.entityName).slice(0, 200) : null,
      detail:      entry.detail ? String(entry.detail).slice(0, 500) : null,
      user_name:   entry.user?.name ? String(entry.user.name).slice(0, 100) : null,
      user_id:     entry.user?.id  != null ? String(entry.user.id).slice(0, 80) : null,
    })
  } catch (e) {
    // Журнал не должен ронять основную операцию
  }
}
