import { getSupabaseClient } from './supabase'
import { fetchAllRows } from './serviceUtils'

/**
 * Reads the optional email automation tables in the same Supabase project.
 * Read-only — all writes happen server-side via the engine's service-role key.
 * Requires migration_outreach.sql + migration_outreach_rls.sql to be applied.
 */

const SENT_STATUSES = ['sent', 'opened', 'replied', 'bounced', 'unsub']

function isSentLifecycleRow(row) {
  return SENT_STATUSES.includes(row.status)
}

export const outreachService = {
  async getSegments() {
    const supabase = getSupabaseClient()
    return fetchAllRows(() => (
      supabase
        .from('segments')
        .select('*')
        .order('created_at', { ascending: true })
    ))
  },

  /** Top-line funnel counts across all outreach rows. */
  async getFunnel() {
    const supabase = getSupabaseClient()
    const rows = await fetchAllRows(() => (
      supabase
        .from('outreach')
        .select('id, status, opened, replied, positive_reply, bounced')
        .order('id', { ascending: true })
    ))
    const sentRows = rows.filter(isSentLifecycleRow)
    return {
      total: rows.length,
      personalized: rows.filter(r => r.status === 'personalized').length,
      queued: rows.filter(r => r.status === 'queued').length,
      sent: sentRows.length,
      opened: sentRows.filter(r => r.opened).length,
      replied: sentRows.filter(r => r.replied).length,
      positive: sentRows.filter(r => r.positive_reply).length,
      bounced: sentRows.filter(r => r.bounced).length,
    }
  },

  /** Per-segment funnel for the segment cards. */
  async getSegmentFunnels() {
    const supabase = getSupabaseClient()
    const [segs, rows] = await Promise.all([
      fetchAllRows(() => (
        supabase
          .from('segments')
          .select('id, name, slug, audience')
          .order('created_at', { ascending: true })
      )),
      fetchAllRows(() => (
        supabase
          .from('outreach')
          .select('id, segment_id, status, opened, replied, positive_reply')
          .order('id', { ascending: true })
      )),
    ])

    const bySeg = {}
    for (const r of rows) {
      const k = r.segment_id
      bySeg[k] = bySeg[k] || { sent: 0, opened: 0, replied: 0, positive: 0 }
      if (!isSentLifecycleRow(r)) continue
      bySeg[k].sent++
      if (r.opened) bySeg[k].opened++
      if (r.replied) bySeg[k].replied++
      if (r.positive_reply) bySeg[k].positive++
    }
    return segs.map(s => ({ ...s, ...(bySeg[s.id] || { sent: 0, opened: 0, replied: 0, positive: 0 }) }))
  },

  /** Active wave per segment with per-variant reply/open rates (the A/B tracker). */
  async getActiveWaves() {
    const supabase = getSupabaseClient()
    const [segs, waves, variants, rows] = await Promise.all([
      fetchAllRows(() => (
        supabase
          .from('segments')
          .select('id, name, slug')
          .order('created_at', { ascending: true })
      )),
      fetchAllRows(() => (
        supabase
          .from('waves')
          .select('*')
          .in('status', ['sending', 'measuring'])
          .order('wave_number', { ascending: false })
      )),
      fetchAllRows(() => (
        supabase
          .from('copy_variants')
          .select('id, name, hook_type, status')
          .order('created_at', { ascending: true })
      )),
      fetchAllRows(() => (
        supabase
          .from('outreach')
          .select('id, wave_id, variant_id, status, opened, replied, positive_reply')
          .not('wave_id', 'is', null)
          .not('variant_id', 'is', null)
          .order('id', { ascending: true })
      )),
    ])

    const segName = Object.fromEntries(segs.map(s => [s.id, s.name]))
    const vMeta = Object.fromEntries(variants.map(v => [v.id, v]))

    // pick the latest sending/measuring wave per segment
    const latestBySeg = {}
    for (const w of waves) {
      if (!latestBySeg[w.segment_id]) latestBySeg[w.segment_id] = w
    }

    return Object.values(latestBySeg).map(w => {
      const waveRows = rows.filter(r => r.wave_id === w.id && r.variant_id)
      const byVariant = {}
      for (const r of waveRows) {
        const m = byVariant[r.variant_id] || { sends: 0, opens: 0, replies: 0, positive: 0 }
        if (!isSentLifecycleRow(r)) {
          byVariant[r.variant_id] = m
          continue
        }
        m.sends++
        if (r.opened) m.opens++
        if (r.replied) m.replies++
        if (r.positive_reply) m.positive++
        byVariant[r.variant_id] = m
      }
      const variantsOut = Object.entries(byVariant)
        .filter(([, m]) => m.sends > 0)
        .map(([id, m]) => ({
          id,
          name: vMeta[id]?.name || id,
          hook: vMeta[id]?.hook_type || '',
          status: vMeta[id]?.status || 'active',
          ...m,
          openRate: m.opens / m.sends,
          replyRate: m.replies / m.sends,
        }))
      return {
        waveId: w.id,
        segment: segName[w.segment_id] || 'Segment',
        waveNumber: w.wave_number,
        dimension: w.test_dimension,
        status: w.status,
        variants: variantsOut.sort((a, b) => b.replyRate - a.replyRate),
      }
    })
  },

  /** Decided experiments (winner history). */
  async getExperiments(limit = 12) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('experiments')
      .select('*, segment:segment_id(name)')
      .order('decided_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  /** Recent replies for the live feed. */
  async getRecentReplies(limit = 12) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('outreach')
      .select(`
        id,
        email,
        subject,
        replied_at,
        positive_reply,
        lead_id,
        customer_id,
        segment:segment_id(name, audience),
        lead:lead_id(business_name, city, state),
        customer:customer_id(first_name, last_name, city, state, status)
      `)
      .eq('replied', true)
      .order('replied_at', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (error) throw error
    return (data || []).map((reply) => {
      const customerName = [reply.customer?.first_name, reply.customer?.last_name].filter(Boolean).join(' ')
      const leadLocation = [reply.lead?.city, reply.lead?.state].filter(Boolean).join(', ')
      const customerLocation = [reply.customer?.city, reply.customer?.state].filter(Boolean).join(', ')
      return {
        ...reply,
        audienceType: reply.customer_id ? 'warm customer' : 'cold lead',
        displayName: reply.lead?.business_name || customerName || reply.email,
        location: leadLocation || customerLocation,
        customerStatus: reply.customer?.status || null,
      }
    })
  },

  /** Sends this calendar month vs the monthly cap (gauge). */
  async getMonthlyUsage(cap = 2000) {
    const supabase = getSupabaseClient()
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const { count, error } = await supabase
      .from('outreach')
      .select('id', { count: 'exact', head: true })
      .in('status', SENT_STATUSES)
      .gte('sent_at', start.toISOString())
    if (error) throw error
    return { used: count || 0, cap }
  },

  /** Website "before you leave" captures over the last N days. */
  async getCapturesOverTime(days = 30) {
    const supabase = getSupabaseClient()
    const start = new Date()
    start.setDate(start.getDate() - days)
    const data = await fetchAllRows(() => (
      supabase
        .from('website_captures')
        .select('id, created_at, consented')
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true })
    ))
    const byDay = {}
    for (const r of data || []) {
      const d = (r.created_at || '').slice(0, 10)
      byDay[d] = (byDay[d] || 0) + 1
    }
    return Object.entries(byDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  },

  async getSuppressionCount() {
    const supabase = getSupabaseClient()
    const { count, error } = await supabase
      .from('suppression')
      .select('email', { count: 'exact', head: true })
    if (error) throw error
    return count || 0
  },
}
