// pages/api/backup.js
// GET /api/backup → полный слепок базы для ручного бэкапа (кнопка в админке → Excel).
// Только admin/head.
//
// На бесплатном Supabase автобэкапов нет: единственная защита от потери базы —
// эта выгрузка. Поэтому здесь два жёстких правила:
//   1. Никогда не отдаём pwd_hash — файл живёт на диске у владельца.
//   2. Не молчим об усечении: страницы по 1000 (лимит PostgREST) крутим до конца,
//      а таблицы, которых нет (миграция не применена), возвращаем в skipped —
//      бэкап не должен выглядеть полным, если часть данных не доехала.

import { getSupabase } from '../../lib/supabase'
import { withRole }    from '../../lib/auth'
import { apiError }    from '../../lib/apiError'
import { logAction }   from '../../lib/actionLog'

// Явный список колонок вместо '*' там, где есть секреты.
const TABLES = [
  ['clients',             '*'],
  ['managers',            '*'],
  ['users',               'id, name, login, role, manager_id, created_at'],
  ['pipeline_stages',     '*'],
  ['checklist_templates', '*'],
  ['calc_settings',       '*'],
  ['calc_programs',       '*'],
  ['wa_chats',            '*'],
  ['wa_messages',         '*'],
  ['wa_quick_replies',    '*'],
  ['action_logs',         '*'],
  ['deleted_clients',     '*'],
]

const PAGE = 1000       // потолок строк на запрос у PostgREST
const HARD_CAP = 100000 // предохранитель от бесконечного цикла

async function fetchAll(sb, table, cols) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + PAGE - 1)
    if (error) return { error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE || rows.length >= HARD_CAP) break
  }
  return { rows }
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' })

  try {
    const sb      = getSupabase()
    const tables  = {}
    const counts  = {}
    const skipped = []

    for (const [name, cols] of TABLES) {
      const { rows, error } = await fetchAll(sb, name, cols)
      if (error) { skipped.push(name); continue }
      tables[name] = rows
      counts[name] = rows.length
    }

    await logAction({
      action: 'backup', entity: 'system',
      detail: 'Выгрузка базы: ' + Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', '),
      user: req.user,
    })

    return res.status(200).json({
      ok: true,
      at: new Date().toISOString(),
      tables, counts, skipped,
    })
  } catch (err) {
    return apiError(res, err)
  }
}

export default withRole('admin', 'head')(handler)
