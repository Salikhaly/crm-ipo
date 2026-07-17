// pages/api/users/index.js
// GET  /api/users  → все пользователи (только admin)
// POST /api/users  → создать пользователя (только admin)

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import bcrypt          from 'bcryptjs'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role } = req.user

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Только для администратора' })
  }

  if (req.method === 'GET') {
    const { data, error } = await sb.from('users').select('id, name, login, role, manager_id, created_at').order('created_at')
    if (error) return apiError(res, error)
    return res.status(200).json({ users: data })
  }

  if (req.method === 'POST') {
    const u = req.body
    if (!u.login || !u.pwd) {
      return res.status(400).json({ error: 'login и pwd обязательны' })
    }

    // Проверка уникальности логина
    // maybeSingle() возвращает null если не найдено (не бросает PGRST116)
    const { data: exists, error: lookupErr } = await sb
      .from('users')
      .select('id')
      .eq('login', u.login)
      .maybeSingle()

    if (lookupErr) return res.status(500).json({ error: lookupErr.message })
    if (exists) return res.status(400).json({ error: 'Логин уже занят' })

    const pwd_hash = await bcrypt.hash(u.pwd, 12)
    const row = {
      id:         u.id,
      name:       u.name       || '',
      login:      u.login.trim().toLowerCase(),
      pwd_hash,                          // bcrypt hash, не plaintext
      role:       u.role       || 'manager',
      manager_id: u.mid        || null,
    }

    let { data, error } = await sb.from('users').insert(row).select().single()

    // Прод-таблица users хранит legacy-колонку `pwd` (NOT NULL, без default):
    // миграция 003 (rename pwd→pwd_hash) на проде НЕ выполнялась, вместо неё
    // pwd_hash добавили отдельно. Auth работает через pwd_hash, но INSERT без
    // pwd падал 500 «not-null constraint» — создать нового сотрудника было НЕЛЬЗЯ.
    // Дозаполняем pwd маской (реальный пароль — только в bcrypt-хеше) и повторяем.
    // Миграция 021 убирает колонку насовсем (это ещё и дыра: plaintext в базе).
    if (error && /column "pwd"/.test(error.message || '')) {
      ;({ data, error } = await sb.from('users').insert({ ...row, pwd: '***' }).select().single())
    }

    if (error) return apiError(res, error)
    const { pwd_hash: _, ...safeUser } = data  // не возвращаем хеш клиенту
    return res.status(201).json({ user: safeUser })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
