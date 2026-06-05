// lib/supabase.js
// Серверный клиент Supabase — используется только в API routes (бэкенд)
// SERVICE_KEY имеет полный доступ к БД без RLS

import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL не задан')
if (!process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY не задан')

// Singleton клиент
let client = null

export function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: { persistSession: false },
        db:   { schema: 'public' },
      }
    )
  }
  return client
}

// ─── Helpers ────────────────────────────────────────────────────

// Клиент из БД → объект приложения
export function dbToClient(r) {
  if (!r) return null
  return {
    id:                  r.id,
    fio:                 r.fio                  || '',
    iin:                 r.iin                  || '',
    phone:               r.phone                || '',
    city:                r.city                 || 'Алматы',
    manager:             r.manager              || '',
    dateIn:              r.date_in              || '',
    source:              r.source               || 'other',
    stage:               r.stage                || 'new_lead',
    isWhatsApp:          r.is_whatsapp          || false,
    waMsgPreview:        r.wa_msg_preview        || '',
    contactStatus:       r.contact_status       || '',
    maritalStatus:       r.marital_status       || '',
    children:            r.children             || '',
    officialIncome:      r.official_income      || '',
    extraIncome:         r.extra_income         || '',
    extraIncomeConfirmed:r.extra_income_confirmed|| false,
    pensionContributions:r.pension_contributions|| '',
    workExperience:      r.work_experience      || '',
    workType:            r.work_type            || 'official',
    downPayment:         r.down_payment         || '',
    downPaymentType:     r.down_payment_type    || 'cash',
    depositBank:         r.deposit_bank         || '',
    depositAmount:       r.deposit_amount       || '',
    depositTerm:         r.deposit_term         || '',
    otbasyDeposit:       r.otbasy_deposit       || false,
    otbasyReward:        r.otbasy_reward        || '',
    otbasyQueue:         r.otbasy_queue         || '',
    otbasyQueueYear:     r.otbasy_queue_year    || '',
    otbasyQueueCity:     r.otbasy_queue_city    || '',
    creditStatus:        r.credit_status        || 'good',
    hasOverdue:          r.has_overdue          || false,
    creditsCount:        r.credits_count        || '',
    monthlyLoad:         r.monthly_load         || '',
    hadBankRefusal:      r.had_bank_refusal     || false,
    hasRefinancing:      r.has_refinancing      || false,
    problematicCredits:  r.problematic_credits  || false,
    courtRestrictions:   r.court_restrictions   || false,
    isReassignment:      r.is_reassignment      || false,
    reassignmentComplex: r.reassignment_complex || '',
    reassignmentDeveloper:r.reassignment_developer|| '',
    reassignmentAmount:  r.reassignment_amount  || '',
    mortgageBalance:     r.mortgage_balance     || '',
    reassignmentBank:    r.reassignment_bank    || '',
    hasDebt:             r.has_debt             || false,
    urgentSale:          r.urgent_sale          || false,
    contractType:        r.contract_type        || '',
    contractAmount:      r.contract_amount      || 0,
    payments:            r.payments             || [],
    responsibleManager:  r.responsible_manager  || '',
    mortgageSpecialist:  r.mortgage_specialist  || '',
    accompStageIndex:    r.accomp_stage_index   || 0,
    accompStages:        r.accomp_stages        || {},
    miroLink:            r.miro_link            || '',
    roadmapLink:         r.roadmap_link         || '',
    driveLink:           r.drive_link           || '',
    driveFolderName:     r.drive_folder_name    || '',
    comments:            r.comments             || [],
    tasks:               r.tasks                || [],
    contracts5y:         r.contracts5y          || {},
    contracts5yPlus:     r.contracts5y_plus     || {},
    createdAt:           r.created_at           || new Date().toISOString(),
  }
}

// Объект приложения → строка БД
export function clientToDb(c) {
  return {
    id:                    c.id,
    fio:                   c.fio                   || '',
    iin:                   c.iin                   || '',
    phone:                 c.phone                 || '',
    city:                  c.city                  || 'Алматы',
    manager:               c.manager               || null,
    date_in:               c.dateIn                || '',
    source:                c.source                || 'other',
    stage:                 c.stage                 || 'new_lead',
    is_whatsapp:           c.isWhatsApp            || false,
    wa_msg_preview:        c.waMsgPreview          || '',
    contact_status:        c.contactStatus         || '',
    marital_status:        c.maritalStatus         || '',
    children:              c.children              || '',
    official_income:       c.officialIncome        || '',
    extra_income:          c.extraIncome           || '',
    extra_income_confirmed:c.extraIncomeConfirmed  || false,
    pension_contributions: c.pensionContributions  || '',
    work_experience:       c.workExperience        || '',
    work_type:             c.workType              || 'official',
    down_payment:          c.downPayment           || '',
    down_payment_type:     c.downPaymentType       || 'cash',
    deposit_bank:          c.depositBank           || '',
    deposit_amount:        c.depositAmount         || '',
    deposit_term:          c.depositTerm           || '',
    otbasy_deposit:        c.otbasyDeposit         || false,
    otbasy_reward:         c.otbasyReward          || '',
    otbasy_queue:          c.otbasyQueue           || '',
    otbasy_queue_year:     c.otbasyQueueYear       || '',
    otbasy_queue_city:     c.otbasyQueueCity       || '',
    credit_status:         c.creditStatus          || 'good',
    has_overdue:           c.hasOverdue            || false,
    credits_count:         c.creditsCount          || '',
    monthly_load:          c.monthlyLoad           || '',
    had_bank_refusal:      c.hadBankRefusal        || false,
    has_refinancing:       c.hasRefinancing        || false,
    problematic_credits:   c.problematicCredits    || false,
    court_restrictions:    c.courtRestrictions     || false,
    is_reassignment:       c.isReassignment        || false,
    reassignment_complex:  c.reassignmentComplex   || '',
    reassignment_developer:c.reassignmentDeveloper || '',
    reassignment_amount:   c.reassignmentAmount    || '',
    mortgage_balance:      c.mortgageBalance       || '',
    reassignment_bank:     c.reassignmentBank      || '',
    has_debt:              c.hasDebt               || false,
    urgent_sale:           c.urgentSale            || false,
    contract_type:         c.contractType          || '',
    contract_amount:       c.contractAmount        || 0,
    payments:              c.payments              || [],
    responsible_manager:   c.responsibleManager    || null,
    mortgage_specialist:   c.mortgageSpecialist    || '',
    accomp_stage_index:    c.accompStageIndex      || 0,
    accomp_stages:         c.accompStages          || {},
    miro_link:             c.miroLink              || '',
    roadmap_link:          c.roadmapLink           || '',
    drive_link:            c.driveLink             || '',
    drive_folder_name:     c.driveFolderName       || '',
    comments:              c.comments              || [],
    tasks:                 c.tasks                 || [],
    contracts5y:           c.contracts5y           || {},
    contracts5y_plus:      c.contracts5yPlus       || {},
  }
}
