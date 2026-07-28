import Dexie from 'dexie'

const db = new Dexie('cleancrm')
db.version(1).stores({
  records: '[table+id], table, id',
})

const RELATIONS = {
  lead: { table: 'leads', foreignKey: 'lead_id' },
  leads: { table: 'leads', foreignKey: 'lead_id' },
  segment: { table: 'segments', foreignKey: 'segment_id' },
  customer: { table: 'customers', foreignKey: 'customer_id' },
  customers: { table: 'customers', foreignKey: 'customer_id' },
  variant: { table: 'copy_variants', foreignKey: 'variant_id' },
  wave: { table: 'waves', foreignKey: 'wave_id' },
}

function newId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeRecord(table, input, existing = null) {
  const now = new Date().toISOString()
  const value = {
    ...(existing || {}),
    ...input,
    id: input.id || existing?.id || newId(),
    created_at: input.created_at || existing?.created_at || now,
    updated_at: input.updated_at || now,
  }

  if (table === 'leads') {
    value.business_name = value.business_name
      || value.contact_name
      || value.email
      || value.phone
      || 'Unnamed lead'
    value.lead_stage ||= 'new'
    value.lead_source ||= 'manual'
    value.category ||= 'prospect'
    value.tags ||= []
  }

  return value
}

async function tableRows(table) {
  const wrappers = await db.records.where('table').equals(table).toArray()
  return wrappers.map((wrapper) => wrapper.value)
}

async function putRows(table, rows) {
  if (!rows.length) return
  await db.records.bulkPut(rows.map((value) => ({
    table,
    id: value.id,
    value,
  })))
}

function compareValues(left, right) {
  if (left === right) return 0
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function parseList(value) {
  if (Array.isArray(value)) return value
  return String(value || '')
    .replace(/^\(|\)$/g, '')
    .replace(/^"|"$/g, '')
    .split(',')
    .map((item) => item.replace(/^"|"$/g, '').trim())
    .filter(Boolean)
}

function matchesCondition(row, field, operator, rawValue) {
  const value = row[field]
  const target = rawValue === 'null' ? null : rawValue

  switch (operator) {
  case 'eq':
    return target === '' ? value === '' || value === null || value === undefined : String(value) === String(target)
  case 'neq':
    return String(value) !== String(target)
  case 'is':
    return target === null ? value === null || value === undefined : value === target
  case 'in':
    return parseList(target).map(String).includes(String(value))
  case 'ilike': {
    const needle = String(target).replace(/^%|%$/g, '').replace(/\\([%_])/g, '$1').toLowerCase()
    return String(value || '').toLowerCase().includes(needle)
  }
  case 'gt':
    return value > target
  case 'gte':
    return value >= target
  case 'lt':
    return value < target
  case 'lte':
    return value <= target
  default:
    return true
  }
}

function splitOrConditions(expression) {
  return String(expression)
    .split(',')
    .map((part) => {
      const [field, operator, ...valueParts] = part.split('.')
      return { field, operator, value: valueParts.join('.') }
    })
    .filter(({ field, operator }) => field && operator)
}

async function addRelations(rows, columns) {
  if (!columns || columns === '*') return rows
  const text = String(columns)
  const relationMatches = [...text.matchAll(/(\w+):(\w+)\s*\(([^)]*)\)/g)]
  for (const match of text.matchAll(/(?:^|,)\s*(leads|customers|segments)\s*\(([^)]*)\)/g)) {
    relationMatches.push([match[0], match[1], match[1], match[2]])
  }
  if (!relationMatches.length) return rows

  let result = rows
  for (const [, alias, relationToken] of relationMatches) {
    const relation = RELATIONS[alias] || (
      relationToken === 'leads'
        ? { table: 'leads', foreignKey: 'lead_id' }
        : { table: `${alias}s`, foreignKey: relationToken }
    )
    const related = await tableRows(relation.table)
    const relatedById = new Map(related.map((item) => [item.id, item]))
    result = result.map((row) => ({
      ...row,
      [alias]: relatedById.get(row[relation.foreignKey]) || null,
    }))
  }
  return result
}

class LocalQuery {
  constructor(table) {
    this.table = table
    this.action = 'select'
    this.payload = null
    this.columns = '*'
    this.selectOptions = {}
    this.filters = []
    this.orFilters = []
    this.orders = []
    this.rangeValue = null
    this.limitValue = null
    this.singleMode = null
    this.upsertOptions = {}
  }

  select(columns = '*', options = {}) {
    this.columns = columns
    this.selectOptions = options
    return this
  }

  insert(payload) {
    this.action = 'insert'
    this.payload = Array.isArray(payload) ? payload : [payload]
    return this
  }

  upsert(payload, options = {}) {
    this.action = 'upsert'
    this.payload = Array.isArray(payload) ? payload : [payload]
    this.upsertOptions = options
    return this
  }

  update(payload) {
    this.action = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'eq', value))
    return this
  }

  neq(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'neq', value))
    return this
  }

  is(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'is', value))
    return this
  }

  not(field, operator, value) {
    this.filters.push((row) => !matchesCondition(row, field, operator, value))
    return this
  }

  in(field, values) {
    this.filters.push((row) => matchesCondition(row, field, 'in', values))
    return this
  }

  contains(field, values) {
    this.filters.push((row) => (
      Array.isArray(row[field]) && values.every((value) => row[field].includes(value))
    ))
    return this
  }

  ilike(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'ilike', value))
    return this
  }

  or(expression) {
    const conditions = splitOrConditions(expression)
    this.orFilters.push((row) => conditions.some(({ field, operator, value }) => (
      matchesCondition(row, field, operator, value)
    )))
    return this
  }

  gt(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'gt', value))
    return this
  }

  gte(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'gte', value))
    return this
  }

  lt(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'lt', value))
    return this
  }

  lte(field, value) {
    this.filters.push((row) => matchesCondition(row, field, 'lte', value))
    return this
  }

  order(field, options = {}) {
    this.orders.push({ field, ascending: options.ascending !== false, nullsFirst: options.nullsFirst })
    return this
  }

  range(from, to) {
    this.rangeValue = [from, to]
    return this
  }

  limit(value) {
    this.limitValue = value
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject)
  }

  async execute() {
    try {
      const allRows = await tableRows(this.table)
      const matches = (row) => (
        this.filters.every((filter) => filter(row))
        && this.orFilters.every((filter) => filter(row))
      )
      let rows = allRows.filter(matches)

      if (this.action === 'insert') {
        rows = this.payload.map((item) => normalizeRecord(this.table, item))
        await putRows(this.table, rows)
      } else if (this.action === 'upsert') {
        const conflictFields = String(this.upsertOptions.onConflict || 'id').split(',')
        rows = this.payload.map((item) => {
          const existing = allRows.find((candidate) => (
            conflictFields.every((field) => candidate[field] === item[field])
          ))
          return normalizeRecord(this.table, item, existing)
        })
        await putRows(this.table, rows)
      } else if (this.action === 'update') {
        rows = rows.map((item) => normalizeRecord(this.table, this.payload, item))
        await putRows(this.table, rows)
      } else if (this.action === 'delete') {
        await db.records.bulkDelete(rows.map((row) => [this.table, row.id]))
      }

      for (let index = this.orders.length - 1; index >= 0; index -= 1) {
        const order = this.orders[index]
        rows.sort((left, right) => {
          const comparison = compareValues(left[order.field], right[order.field])
          return order.ascending ? comparison : -comparison
        })
      }

      const count = rows.length
      if (this.rangeValue) {
        rows = rows.slice(this.rangeValue[0], this.rangeValue[1] + 1)
      }
      if (this.limitValue !== null) rows = rows.slice(0, this.limitValue)
      rows = await addRelations(rows, this.columns)

      const data = this.selectOptions.head
        ? null
        : this.singleMode === 'maybe'
          ? rows[0] || null
          : rows

      return {
        data,
        count: this.selectOptions.count ? count : null,
        error: null,
      }
    } catch (error) {
      return { data: null, count: null, error }
    }
  }
}

function normalizedPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10)
}

function normalizedText(value) {
  return String(value || '').trim().toLowerCase()
}

function duplicateReason(candidate, existing) {
  const phone = normalizedPhone(candidate.phone)
  if (phone && phone === normalizedPhone(existing.phone)) return 'Same phone number'
  const name = normalizedText(candidate.business_name)
  const city = normalizedText(candidate.city)
  if (name && city && name === normalizedText(existing.business_name) && city === normalizedText(existing.city)) {
    return 'Same business name and city'
  }
  const email = normalizedText(candidate.email)
  if (email && email === normalizedText(existing.email)) return 'Same email address'
  return null
}

async function localRpc(name, params = {}) {
  try {
    const leads = await tableRows('leads')

    if (name === 'bulk_add_lead_tag') {
      const ids = new Set(params.p_ids || [])
      const changed = leads.filter((lead) => ids.has(lead.id)).map((lead) => normalizeRecord('leads', {
        tags: [...new Set([...(lead.tags || []), params.p_tag])],
      }, lead))
      await putRows('leads', changed)
      return { data: changed.length, error: null }
    }

    if (name === 'find_lead_duplicates') {
      const duplicates = []
      for (const [candidateIndex, candidate] of (params.candidates || []).entries()) {
        const existing = leads.find((lead) => duplicateReason(candidate, lead))
        if (existing) {
          const reason = duplicateReason(candidate, existing)
          duplicates.push({
            candidate_idx: candidate.i ?? candidateIndex,
            id: existing.id,
            business_name: existing.business_name,
            phone: existing.phone,
            phone_formatted: existing.phone_formatted,
            city: existing.city,
            state: existing.state,
            matched_by: reason === 'Same phone number' ? 'phone' : 'name_city',
          })
        }
      }
      return { data: duplicates, error: null }
    }

    if (name === 'find_duplicate_lead_groups') {
      const groups = []
      const seen = new Set()
      for (const lead of leads) {
        if (seen.has(lead.id)) continue
        const matches = leads.filter((candidate) => (
          candidate.id !== lead.id && duplicateReason(lead, candidate)
        ))
        if (matches.length) {
          const members = [lead, ...matches]
          members.forEach((member) => seen.add(member.id))
          groups.push({
            group_key: normalizedPhone(lead.phone)
              ? `phone-${normalizedPhone(lead.phone)}`
              : `name-${normalizedText(lead.business_name)}-${normalizedText(lead.city)}`,
            lead_count: members.length,
            leads: members,
          })
        }
        if (groups.length >= (params.p_limit || 100)) break
      }
      return { data: groups, error: null }
    }

    if (name === 'merge_leads') {
      const keep = leads.find((lead) => lead.id === params.p_keep)
      if (!keep) throw new Error('Lead to keep was not found.')
      const losers = leads.filter((lead) => (params.p_losers || []).includes(lead.id))
      const merged = normalizeRecord('leads', {
        ...Object.fromEntries(
          Object.keys(keep).map((key) => [key, keep[key] || losers.find((lead) => lead[key])?.[key]])
        ),
        tags: [...new Set([...(keep.tags || []), ...losers.flatMap((lead) => lead.tags || [])])],
      }, keep)
      await putRows('leads', [merged])
      for (const table of ['notes', 'tasks', 'call_logs', 'qualification_answers']) {
        const related = (await tableRows(table))
          .filter((row) => losers.some((lead) => lead.id === row.lead_id))
          .map((row) => normalizeRecord(table, { lead_id: keep.id }, row))
        await putRows(table, related)
      }
      await db.records.bulkDelete(losers.map((lead) => ['leads', lead.id]))
      return { data: losers.length, error: null }
    }

    if (name === 'lead_stage_counts' || name === 'lead_state_counts') {
      const field = name === 'lead_stage_counts' ? 'lead_stage' : 'state'
      const counts = leads.reduce((result, lead) => {
        const value = lead[field] || 'Unknown'
        result[value] = (result[value] || 0) + 1
        return result
      }, {})
      return {
        data: Object.entries(counts).map(([value, count]) => ({ name: value, count })),
        error: null,
      }
    }

    if (name === 'dashboard_lead_counts') {
      const open = (lead) => !['won', 'lost'].includes(lead.lead_stage)
      return {
        data: [{
          total: leads.length,
          new: leads.filter((lead) => lead.lead_stage === 'new').length,
          contacted: leads.filter((lead) => lead.lead_stage === 'contacted').length,
          interested: leads.filter((lead) => lead.lead_stage === 'interested').length,
          qualified: leads.filter((lead) => lead.lead_stage === 'qualified').length,
          won: leads.filter((lead) => lead.lead_stage === 'won').length,
          lost: leads.filter((lead) => lead.lead_stage === 'lost').length,
          overdue: leads.filter((lead) => open(lead) && lead.next_follow_up_date && lead.next_follow_up_date < params.p_today).length,
          due_today: leads.filter((lead) => open(lead) && lead.next_follow_up_date === params.p_today).length,
          due_next_7_days: leads.filter((lead) => open(lead) && lead.next_follow_up_date > params.p_today && lead.next_follow_up_date <= params.p_next7).length,
        }],
        error: null,
      }
    }

    return { data: null, error: new Error(`Local mode does not support ${name}.`) }
  } catch (error) {
    return { data: null, error }
  }
}

export const localClient = {
  from(table) {
    return new LocalQuery(table)
  },
  rpc: localRpc,
}

export async function exportLocalDatabase() {
  const wrappers = await db.records.toArray()
  return {
    format: 'purecrm-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    records: wrappers,
  }
}

export async function importLocalDatabase(backup) {
  if (!['purecrm-backup', 'cleancrm-backup'].includes(backup?.format) || !Array.isArray(backup.records)) {
    throw new Error('This is not a valid PureCRM backup file.')
  }
  await db.transaction('rw', db.records, async () => {
    await db.records.clear()
    await db.records.bulkPut(backup.records)
  })
}

export async function clearLocalDatabase() {
  await db.records.clear()
}

export async function countLocalRecords() {
  return db.records.count()
}
