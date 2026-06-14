#!/usr/bin/env node
// scripts/gen-seed-hashes.js
// Запустить: node scripts/gen-seed-hashes.js
// Генерирует bcrypt-хеши для seed-пользователей и выводит готовый SQL INSERT.
//
// ИСПОЛЬЗОВАНИЕ:
//   1. node scripts/gen-seed-hashes.js              — с паролями по умолчанию
//   2. node scripts/gen-seed-hashes.js --interactive — ввести свои пароли

const bcrypt = require('bcryptjs')
const readline = require('readline')

const ROUNDS = 12

const DEFAULT_USERS = [
  { id: 'u0', name: 'Техник',        login: 'admin',   role: 'admin',   managerId: null, pwd: 'admin123' },
  { id: 'u1', name: 'Руководитель',  login: 'head',    role: 'head',    managerId: null, pwd: 'head123'  },
  { id: 'u2', name: 'Айгерим Б.',   login: 'aigerim', role: 'manager', managerId: 'm1', pwd: 'a123'     },
  { id: 'u3', name: 'Данияр С.',    login: 'daniyar', role: 'manager', managerId: 'm2', pwd: 'd123'     },
  { id: 'u4', name: 'Мадина К.',    login: 'madina',  role: 'manager', managerId: 'm3', pwd: 'm123'     },
  { id: 'u5', name: 'Руслан Т.',    login: 'ruslan',  role: 'manager', managerId: 'm4', pwd: 'r123'     },
]

async function generateHashes(users) {
  console.log('\n⏳ Генерация bcrypt хешей (rounds=12, может занять ~10 сек)...\n')
  const rows = []
  for (const u of users) {
    process.stdout.write(`  ${u.login} ... `)
    const hash = await bcrypt.hash(u.pwd, ROUNDS)
    rows.push({ ...u, hash })
    console.log('✅')
  }

  console.log('\n─── Готовый SQL INSERT (вставьте в schema.sql) ───────────────────────────\n')
  console.log(`insert into users (id,name,login,pwd_hash,role,manager_id) values`)
  rows.forEach((u, i) => {
    const mid = u.managerId ? `'${u.managerId}'` : 'null'
    const comma = i < rows.length - 1 ? ',' : ''
    console.log(`  ('${u.id}','${u.name}','${u.login}','${u.hash}','${u.role}',${mid})${comma}`)
  })
  console.log(`on conflict (id) do update set`)
  console.log(`  pwd_hash = excluded.pwd_hash;`)
  console.log('\n─────────────────────────────────────────────────────────────────────────\n')
  console.log('⚠️  В production используйте надёжные уникальные пароли для каждого пользователя!')
}

async function interactiveMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise(r => rl.question(q, r))

  console.log('\n📝 Интерактивный режим — введите пароль для каждого пользователя')
  console.log('   (Enter = оставить пароль по умолчанию)\n')

  const users = []
  for (const u of DEFAULT_USERS) {
    const input = await ask(`  ${u.login} (${u.role}) [${u.pwd}]: `)
    users.push({ ...u, pwd: input.trim() || u.pwd })
  }
  rl.close()
  await generateHashes(users)
}

const isInteractive = process.argv.includes('--interactive') || process.argv.includes('-i')
if (isInteractive) {
  interactiveMode().catch(console.error)
} else {
  generateHashes(DEFAULT_USERS).catch(console.error)
}
