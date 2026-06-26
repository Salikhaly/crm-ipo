// pages/api/users/[id].js
// PUT    /api/users/:id  → обновить (только admin)
// DELETE /api/users/:id  → удалить (только admin)

import { getSupabase } from '../../../lib/supabase'
import { withAuth, invalidateUserCache } from '../../../lib/auth'
import bcrypt          from 'bcryptjs'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { id } = req.query
  const { role } = req.user

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Только для администратора' })
  }

  if (req.method === 'PUT') {
    const u = req.body

    if (!u.login) return res.status(400).json({ error: 'login обязателен' })

    const upd = {
      name:       u.name  || '',
      login:      u.login.trim().toLowerCase(),
      role:       u.role  || 'manager',
      manager_id: u.mid   || null,
    }

    // Обновляем пароль только если передан новый
    if (u.pwd) {
      upd.pwd_hash = await bcrypt.hash(u.pwd, 12)
    }

    const { data, error } = await sb
      .from('users')
      .update(upd)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    invalidateUserCache(id)  // новая роль/manager_id действуют сразу, не через 60 сек кэша
    const { pwd_hash: _, ...safeUser } = data  // не возвращаем хеш клиенту
    return res.status(200).json({ user: safeUser })
  }

  if (req.method === 'DELETE') {
    // Нельзя удалить собственный аккаунт
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' })
    }

    // Нельзя удалить последнего администратора
    const { data: targetUser } = await sb.from('users').select('role').eq('id', id).maybeSingle()
    if (targetUser?.role === 'admin') {
      const { count } = await sb
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
      if (count <= 1) {
        return res.status(400).json({ error: 'Нельзя удалить единственного администратора системы' })
      }
    }

    const { error } = await sb.from('users').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    invalidateUserCache(id)  // удалённый юзер сразу теряет доступ, не через 60 сек кэша
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
