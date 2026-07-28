import { getSupabaseClient } from './supabase'
import { fetchAllRows, requireMutationRow, requireMutationRows } from './serviceUtils'

const LEAD_SORT_FIELDS = new Set([
  'business_name',
  'city',
  'state',
  'lead_stage',
  'lead_source',
  'next_follow_up_date',
  'created_at',
  'updated_at',
  'rating',
  'reviews_count'
])

const EXPORT_PAGE_SIZE = 1000
const LEAD_STAGE_ALIASES = {
  closed_won: 'won',
  closed_lost: 'lost',
  not_interested: 'lost',
  negotiating: 'qualified'
}
const HOT_LEAD_STAGES = ['interested', 'qualified', 'samples_sent']

function escapePostgrestPattern(value) {
  return String(value)
    .replace(/[\\%_]/g, match => `\\${match}`)
    .replace(/[(),]/g, ' ')
    .trim()
}

function parseRatingFilter(value) {
  if (value === undefined || value === null || value === '') return null
  const rating = Number(value)
  return Number.isFinite(rating) ? Math.min(Math.max(rating, 0), 5) : null
}

function normalizeLeadPayload(lead) {
  return Object.fromEntries(
    Object.entries(lead).map(([key, value]) => {
      if (typeof value !== 'string') return [key, value]
      const trimmed = value.trim()
      if (trimmed === '') return [key, null]
      if (key === 'lead_stage') return [key, LEAD_STAGE_ALIASES[trimmed] || trimmed]
      return [key, trimmed]
    })
  )
}

function buildLeadsQuery(client, filters = {}, selectOptions = {}) {
  let query = client
    .from('leads')
    .select('*', selectOptions)

  // Apply filters
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.state) {
    query = query.eq('state', filters.state)
  }
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`)
  }
  if (filters.stage) {
    query = filters.stage === 'hot'
      ? query.in('lead_stage', HOT_LEAD_STAGES)
      : query.eq('lead_stage', filters.stage)
  }
  if (filters.source) {
    query = query.eq('lead_source', filters.source)
  }
  const minRating = parseRatingFilter(filters.min_rating)
  if (minRating !== null) {
    query = query.gte('rating', minRating)
  }
  const maxRating = parseRatingFilter(filters.max_rating)
  if (maxRating !== null) {
    query = query.lte('rating', maxRating)
  }
  if (filters.contact === 'missing') {
    query = query.or('email.is.null,email.eq.,phone.is.null,phone.eq.')
  }
  if (filters.search) {
    const search = escapePostgrestPattern(filters.search)
    if (search) {
      query = query.or(`business_name.ilike.%${search}%,city.ilike.%${search}%,phone.ilike.%${search}%`)
    }
  }
  if (filters.tag) {
    query = query.contains('tags', [filters.tag])
  }

  // Follow up date filter
  if (filters.followup) {
    const todayStr = new Date().toISOString().split('T')[0]
    const nextSeven = new Date()
    nextSeven.setDate(nextSeven.getDate() + 7)
    const nextSevenStr = nextSeven.toISOString().split('T')[0]
    if (filters.followup === 'today') {
      query = query.eq('next_follow_up_date', todayStr)
    } else if (filters.followup === 'overdue') {
      query = query.lt('next_follow_up_date', todayStr).not('next_follow_up_date', 'is', null).not('lead_stage', 'in', '("won","lost")')
    } else if (filters.followup === 'next7') {
      query = query.not('next_follow_up_date', 'is', null).lte('next_follow_up_date', nextSevenStr).not('lead_stage', 'in', '("won","lost")')
    } else if (filters.followup === 'upcoming') {
      query = query.gt('next_follow_up_date', todayStr)
    } else if (filters.followup === 'none') {
      query = query.is('next_follow_up_date', null).not('lead_stage', 'in', '("won","lost")')
    }
  }

  // Apply sorting
  const sortBy = LEAD_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : 'created_at'
  const sortAscending = filters.sortOrder === 'asc'
  return query.order(sortBy, { ascending: sortAscending })
}

export const leadsService = {
  // Get all leads with optional filters, sorting, and pagination
  async getLeads(filters = {}) {
    const supabase = getSupabaseClient()
    const isPaginated = filters.page !== undefined

    // Apply pagination if requested
    if (isPaginated) {
      let query = buildLeadsQuery(supabase, filters, { count: 'exact' })
      const page = Math.max(parseInt(filters.page) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(filters.pageSize) || 25, 1), 500);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    } else {
      return fetchAllRows(() => buildLeadsQuery(supabase, filters))
    }
  },

  async getAllLeadsForExport(onProgress) {
    const supabase = getSupabaseClient()
    const allLeads = []
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + EXPORT_PAGE_SIZE - 1)

      if (error) throw error
      if (!data?.length) break

      allLeads.push(...data)
      if (onProgress) onProgress(allLeads.length)

      if (data.length < EXPORT_PAGE_SIZE) break
      from += EXPORT_PAGE_SIZE
    }

    return allLeads
  },

  async getMapLeads() {
    const supabase = getSupabaseClient()
    return fetchAllRows(() => (
      supabase
        .from('leads')
        .select('id, business_name, city, state, latitude, longitude, lead_stage, phone, category')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('id', { ascending: true })
    ))
  },

  async getCalendarFollowUps(startDate, endDate) {
    const supabase = getSupabaseClient()
    return fetchAllRows(() => (
      supabase
        .from('leads')
        .select('id, business_name, next_follow_up_date, next_follow_up_task')
        .not('next_follow_up_date', 'is', null)
        .gte('next_follow_up_date', startDate)
        .lte('next_follow_up_date', endDate)
        .order('next_follow_up_date')
    ))
  },

  // Get single lead with related data
  async getLead(id) {
    const supabase = getSupabaseClient()
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (leadError) throw leadError
    if (!lead) throw new Error('Lead not found or you do not have permission to view it.')

    // Get related data in parallel
    const [notes, tasks, qualificationAnswers, callLogs] = await Promise.all([
      fetchAllRows(() => (
        supabase
          .from('notes')
          .select('*')
          .eq('lead_id', id)
          .order('created_at', { ascending: false })
      )),
      fetchAllRows(() => (
        supabase
          .from('tasks')
          .select('*')
          .eq('lead_id', id)
          .order('display_order')
      )),
      fetchAllRows(() => (
        supabase
          .from('qualification_answers')
          .select('*')
          .eq('lead_id', id)
          .order('display_order')
      )),
      fetchAllRows(() => (
        supabase
          .from('call_logs')
          .select('*')
          .eq('lead_id', id)
          .order('created_at', { ascending: false })
      ))
    ])

    return {
      ...lead,
      notes,
      tasks,
      qualificationAnswers,
      callLogs
    }
  },

  // Create new lead
  async createLead(leadData) {
    const supabase = getSupabaseClient()
    const normalizedLead = normalizeLeadPayload(leadData)
    const { data, error } = await supabase
      .from('leads')
      .insert([normalizedLead])
      .select()
      .maybeSingle()

    if (error) throw error
    return requireMutationRow(data, 'Lead was not created. Check database permissions and try again.')
  },

  // Update lead
  async updateLead(id, updates) {
    const supabase = getSupabaseClient()
    const normalizedUpdates = normalizeLeadPayload(updates)
    const { data, error } = await supabase
      .from('leads')
      .update(normalizedUpdates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    return requireMutationRow(data, 'Lead not found or you do not have permission to update it.')
  },

  async bulkUpdateStage(ids, stage) {
    if (!ids.length) return 0
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .update({ lead_stage: stage })
      .in('id', ids)
      .select('id')
    if (error) throw error
    return (data || []).length
  },

  async bulkAddTag(ids, tag) {
    if (!ids.length || !tag) return 0
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('bulk_add_lead_tag', { p_ids: ids, p_tag: tag })
    if (error) throw error
    return Number(data) || 0
  },

  // Duplicate groups: leads sharing the same business_name + street address.
  async getDuplicateGroups(limit = 100) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('find_duplicate_lead_groups', { p_limit: limit })
    if (error) throw error
    return data || []
  },

  // Merge losers into the keeper: child records move to the keeper, losers deleted.
  async mergeLeads(keepId, loserIds) {
    if (!keepId || !loserIds.length) return 0
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('merge_leads', { p_keep: keepId, p_losers: loserIds })
    if (error) throw error
    return Number(data) || 0
  },

  async bulkUpdateFollowUp(ids, date) {
    if (!ids.length) return 0
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .update({ next_follow_up_date: date || null })
      .in('id', ids)
      .select('id')
    if (error) throw error
    return (data || []).length
  },

  // Delete lead
  async deleteLead(id) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    requireMutationRow(data, 'Lead not found or you do not have permission to delete it.')
  },

  // Bulk import leads (chunked for large datasets)
  async bulkImportLeads(leadsArray, onProgress) {
    const supabase = getSupabaseClient()
    const CHUNK_SIZE = 500;
    const chunks = [];

    // Split into chunks
    for (let i = 0; i < leadsArray.length; i += CHUNK_SIZE) {
      chunks.push(leadsArray.slice(i, i + CHUNK_SIZE));
    }

    const allInserted = [];

    // Process chunks sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const normalizedChunk = chunk.map(normalizeLeadPayload);
      const { data, error } = await supabase
        .from('leads')
        .insert(normalizedChunk)
        .select();

      if (error) throw error;
      const inserted = requireMutationRows(
        data,
        normalizedChunk.length,
        `Lead import chunk ${i + 1} was not fully created. Check database permissions and try again.`
      );
      allInserted.push(...inserted);

      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          current: Math.min((i + 1) * CHUNK_SIZE, leadsArray.length),
          total: leadsArray.length,
          chunk: i + 1,
          totalChunks: chunks.length
        });
      }
    }

    return allInserted;
  },

  // Find duplicate leads before import (server-side batch RPC)
  // Checks by phone OR (business_name + city)
  async findDuplicates(leadsToImport) {
    if (!leadsToImport.length) return [];

    const supabase = getSupabaseClient()
    const candidates = leadsToImport.map((lead, i) => ({
      i,
      business_name: lead.business_name,
      phone: lead.phone,
      city: lead.city
    }))

    const { data, error } = await supabase.rpc('find_lead_duplicates', { candidates })
    if (error) throw error

    return (data || []).map(row => {
      const newLead = leadsToImport[row.candidate_idx]
      return {
        newLead: {
          business_name: newLead.business_name,
          phone: newLead.phone,
          city: newLead.city
        },
        existingLead: {
          id: row.id,
          business_name: row.business_name,
          phone: row.phone,
          phone_formatted: row.phone_formatted,
          city: row.city,
          state: row.state
        },
        matchReason: row.matched_by === 'phone' ? 'Same phone number' : 'Same business name and city'
      }
    });
  }
}
