import { getSupabaseClient } from './supabase'
import { callsService } from './callsService'
import { fetchAllRows } from './serviceUtils'
import { startOfDay, format } from 'date-fns'

const OUTREACH_SENT_STATUSES = ['sent', 'opened', 'replied', 'bounced', 'unsub']
const REPLY_REVIEW_TASK_NAME = 'Review detected email reply'
const REPLY_REVIEW_TASK_PATH = `/tasks?filter=pending&search=${encodeURIComponent(REPLY_REVIEW_TASK_NAME)}`
const UNPROMOTED_CAPTURES_PATH = '/customers?tab=captures&filter=unpromoted'
const REORDER_DUE_CUSTOMERS_PATH = '/customers?customerFilter=reorder_due'
const CLOSED_LEAD_STAGE_FILTER = '("won","lost")'
const REORDER_DUE_DAYS = 45

async function exactCount(query) {
    const { count, error } = await query
    if (error) throw error
    return count || 0
}

async function optionalExactCount(query) {
    try {
        return { count: await exactCount(query), ok: true, error: null }
    } catch (error) {
        return { count: 0, ok: false, error: error.message }
    }
}

async function optionalSingle(query) {
    try {
        const { data, error } = await query
        if (error) throw error
        return { data: data || null, ok: true, error: null }
    } catch (error) {
        return { data: null, ok: false, error: error.message }
    }
}

async function optionalPagedRows(buildQuery, pageSize = 1000) {
    try {
        return { data: await fetchAllRows(buildQuery, pageSize), ok: true, error: null }
    } catch (error) {
        return { data: [], ok: false, error: error.message }
    }
}

function daysUntil(dateString) {
    if (!dateString) return null
    const today = startOfDay(new Date())
    const target = startOfDay(new Date(`${dateString}T00:00:00`))
    return Math.round((target - today) / 86400000)
}

function daysSince(dateString) {
    if (!dateString) return null
    return Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000))
}

function freshnessItem({ label, at, warningDays, dangerDays, emptyDetail, path, error }) {
    if (error) {
        return {
            label,
            at: null,
            ageDays: null,
            severity: 'danger',
            detail: error,
            path
        }
    }

    const ageDays = daysSince(at)
    const severity = ageDays === null
        ? 'warning'
        : ageDays >= dangerDays
            ? 'danger'
            : ageDays >= warningDays
                ? 'warning'
                : 'good'

    return {
        label,
        at: at || null,
        ageDays,
        severity,
        detail: at
            ? ageDays === 0 ? 'Updated today' : `${ageDays} day${ageDays === 1 ? '' : 's'} ago`
            : emptyDetail,
        path
    }
}

function isActiveCustomerStatus(status) {
    return !status || status === 'active'
}

function isCustomerReorderDue(customer) {
    if (!isActiveCustomerStatus(customer.status) || Number(customer.order_count || 0) <= 0) return false
    const lastOrderAge = daysSince(customer.last_order_at)
    return lastOrderAge === null || lastOrderAge >= REORDER_DUE_DAYS
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)))
}

function ratePercent(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0
}

function buildSegmentHealth(segmentRows, outreachRows) {
    const bySegment = new Map()

    for (const segment of segmentRows) {
        bySegment.set(segment.id, {
            id: segment.id,
            name: segment.name || segment.slug || 'Segment',
            slug: segment.slug,
            audience: segment.audience || 'cold',
            active: segment.active !== false,
            hasCampaign: Boolean(segment.smartlead_campaign_id),
            queued: 0,
            personalized: 0,
            sent: 0,
            opened: 0,
            replied: 0,
            positive: 0,
            bounced: 0
        })
    }

    for (const row of outreachRows) {
        if (!row.segment_id || !bySegment.has(row.segment_id)) continue
        const segment = bySegment.get(row.segment_id)
        if (row.status === 'queued') segment.queued += 1
        if (row.status === 'personalized') segment.personalized += 1
        if (OUTREACH_SENT_STATUSES.includes(row.status)) segment.sent += 1
        if (row.opened) segment.opened += 1
        if (row.replied) segment.replied += 1
        if (row.positive_reply) segment.positive += 1
        if (row.bounced) segment.bounced += 1
    }

    return [...bySegment.values()]
        .map((segment) => {
            const openRate = ratePercent(segment.opened, segment.sent)
            const replyRate = ratePercent(segment.replied, segment.sent)
            const positiveRate = ratePercent(segment.positive, segment.sent)
            const ready = segment.queued + segment.personalized
            const status = !segment.active
                ? 'paused'
                : !segment.hasCampaign
                    ? 'blocked'
                    : ready > 0
                        ? 'ready'
                        : segment.sent > 0
                            ? 'measuring'
                            : 'idle'

            return {
                ...segment,
                ready,
                openRate,
                replyRate,
                positiveRate,
                status
            }
        })
        .sort((a, b) => {
            const statusRank = { blocked: 0, ready: 1, measuring: 2, idle: 3, paused: 4 }
            return (statusRank[a.status] ?? 5) - (statusRank[b.status] ?? 5)
                || b.ready - a.ready
                || b.sent - a.sent
                || a.name.localeCompare(b.name)
        })
}

function leadPriorityScore(lead) {
    const stageScore = {
        won: 100,
        qualified: 85,
        samples_sent: 78,
        interested: 72,
        contacted: 48,
        new: 30,
        lost: 0
    }[lead.lead_stage || 'new'] || 25
    const followupDays = daysUntil(lead.next_follow_up_date)
    const followupScore = followupDays === null ? -12 : followupDays < 0 ? 35 : followupDays === 0 ? 28 : Math.max(0, 14 - followupDays)
    const contactScore = lead.email || lead.phone ? 8 : -25
    const ratingScore = Number(lead.rating || 0) >= 4.5 ? 8 : 0
    const reviewScore = Number(lead.reviews_count || 0) >= 100 ? 5 : 0
    return Math.max(0, stageScore + followupScore + contactScore + ratingScore + reviewScore)
}

export const dashboardService = {
    // Get call statistics for stat cards
    async getCallStats() {
        return callsService.getCallStats()
    },

    // Get upcoming follow-up tasks
    async getNextFollowUps(limit = 10) {
        const supabase = getSupabaseClient()
        const today = startOfDay(new Date())

        const { data, error } = await supabase
            .from('leads')
            .select('id, business_name, city, state, next_follow_up_date, next_follow_up_task')
            .not('next_follow_up_date', 'is', null)
            .gte('next_follow_up_date', today.toISOString().split('T')[0])
            .not('lead_stage', 'in', CLOSED_LEAD_STAGE_FILTER)
            .order('next_follow_up_date', { ascending: true })
            .limit(limit)

        if (error) throw error

        // Add status (overdue, today, upcoming)
        const todayStr = format(today, 'yyyy-MM-dd')

        return data.map(lead => ({
            ...lead,
            status: lead.next_follow_up_date < todayStr ? 'overdue'
                : lead.next_follow_up_date === todayStr ? 'today'
                    : 'upcoming'
        }))
    },

    // Get overdue follow-ups
    async getOverdueFollowUps(limit = 10) {
        const supabase = getSupabaseClient()
        const today = startOfDay(new Date())

        const { data, error } = await supabase
            .from('leads')
            .select('id, business_name, city, state, next_follow_up_date, next_follow_up_task')
            .not('next_follow_up_date', 'is', null)
            .lt('next_follow_up_date', today.toISOString().split('T')[0])
            .not('lead_stage', 'in', CLOSED_LEAD_STAGE_FILTER)
            .order('next_follow_up_date', { ascending: true })
            .limit(limit)

        if (error) throw error

        return data.map(lead => ({
            ...lead,
            status: 'overdue'
        }))
    },

    // Get recent activity (notes and calls)
    async getRecentActivity(limit = 10) {
        const supabase = getSupabaseClient()
        // Get recent notes
        const { data: notes, error: notesError } = await supabase
            .from('notes')
            .select(`
        id,
        note_text,
        note_type,
        created_at,
        lead_id,
        leads:lead_id (business_name)
      `)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (notesError) throw notesError

        // Get recent calls
        const { data: calls, error: callsError } = await supabase
            .from('call_logs')
            .select(`
        id,
        call_outcome,
        call_notes,
        created_at,
        lead_id,
        leads:lead_id (business_name)
      `)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (callsError) throw callsError

        // Combine and sort by date
        const activities = [
            ...notes.map(n => ({
                id: n.id,
                type: 'note',
                content: n.note_text,
                subType: n.note_type,
                created_at: n.created_at,
                lead_id: n.lead_id,
                business_name: n.leads?.business_name || 'Unknown'
            })),
            ...calls.map(c => ({
                id: c.id,
                type: 'call',
                content: c.call_notes || `Call - ${c.call_outcome}`,
                subType: c.call_outcome,
                created_at: c.created_at,
                lead_id: c.lead_id,
                business_name: c.leads?.business_name || 'Unknown'
            }))
        ]

        // Sort by date and limit
        return activities
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit)
    },

    // Get lead stage distribution
    async getLeadStageStats() {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.rpc('lead_stage_counts')
        if (error) throw error

        return (data || []).map(({ name, count }) => ({
            name,
            count: Number(count)
        }))
    },

    // Get leads by state for charts
    async getLeadsByState() {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.rpc('lead_state_counts')
        if (error) throw error

        return (data || [])
            .map(({ name, count }) => ({ name, count: Number(count) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10) // Top 10 states
    },

    // Get dashboard summary stats
    async getDashboardStats() {
        const supabase = getSupabaseClient()
        // Get total leads count
        const { count: leadsCount, error: leadsError } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })

        if (leadsError) throw leadsError

        // Get total tasks count (incomplete tasks)
        const { count: tasksCount, error: tasksError} = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('completed', false)

        if (tasksError) throw tasksError

        // Get call stats
        const callStats = await callsService.getCallStats()

        return {
            totalLeads: leadsCount || 0,
            callsToday: callStats.today || 0,
            callsThisMonth: callStats.thisMonth || 0,
            openTasks: tasksCount || 0
        }
    },

    async getCommandCenter() {
        const supabase = getSupabaseClient()
        const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 7)
        const nextSevenDays = new Date()
        nextSevenDays.setDate(nextSevenDays.getDate() + 7)
        const nextSevenDaysStr = format(startOfDay(nextSevenDays), 'yyyy-MM-dd')

        // One RPC returns all 7 full-table lead counts in a single pass, instead
        // of 7 separate exact-count scans over 163k rows. Shared across the
        // Promise.all entries below so only one request fires.
        const leadCounts = supabase
            .rpc('dashboard_lead_counts', { p_today: today, p_next7: nextSevenDaysStr })
            .then(({ data, error }) => {
                if (error) throw error
                return data?.[0] || {}
            })

        const [
            totalLeads,
            hotLeads,
            noFollowUp,
            overdueFollowups,
            todayFollowups,
            upcomingFollowups7d,
            openTasks,
            overdueTasks,
            todayTasks,
            tasksNext7d,
            missingContact,
            captures,
            unpromotedCaptures,
            queuedOutreach,
            personalizedOutreach,
            sentThisWeek,
            repliesThisWeek,
            missingCampaigns,
            suppressionCount,
            replyReviewTasks,
            customerRows,
            segmentRows,
            outreachRows,
            latestLead,
            latestLeadUpdate,
            latestOutreachSend,
            latestReply,
            latestCapture
        ] = await Promise.all([
            leadCounts.then(c => c.total_leads || 0),
            leadCounts.then(c => c.hot_leads || 0),
            leadCounts.then(c => c.no_follow_up || 0),
            leadCounts.then(c => c.overdue_followups || 0),
            leadCounts.then(c => c.today_followups || 0),
            leadCounts.then(c => c.upcoming_7d || 0),
            exactCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('completed', false)),
            exactCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('completed', false).lt('due_date', today)),
            exactCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('completed', false).eq('due_date', today)),
            exactCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('completed', false).gt('due_date', today).lte('due_date', nextSevenDaysStr)),
            leadCounts.then(c => c.missing_contact || 0),
            optionalExactCount(supabase.from('website_captures').select('id', { count: 'exact', head: true })),
            optionalExactCount(supabase.from('website_captures').select('id', { count: 'exact', head: true }).eq('promoted', false).eq('consented', true)),
            optionalExactCount(supabase.from('outreach').select('id', { count: 'exact', head: true }).eq('status', 'queued')),
            optionalExactCount(supabase.from('outreach').select('id', { count: 'exact', head: true }).eq('status', 'personalized')),
            optionalExactCount(
                supabase
                    .from('outreach')
                    .select('id', { count: 'exact', head: true })
                    .in('status', OUTREACH_SENT_STATUSES)
                    .gte('sent_at', weekStart.toISOString())
            ),
            optionalExactCount(
                supabase
                    .from('outreach')
                    .select('id', { count: 'exact', head: true })
                    .in('status', OUTREACH_SENT_STATUSES)
                    .eq('replied', true)
                    .gte('replied_at', weekStart.toISOString())
            ),
            optionalExactCount(supabase.from('segments').select('id', { count: 'exact', head: true }).eq('active', true).is('smartlead_campaign_id', null)),
            optionalExactCount(supabase.from('suppression').select('email', { count: 'exact', head: true })),
            exactCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('completed', false).eq('task_name', REPLY_REVIEW_TASK_NAME)),
            optionalPagedRows(() => (
                supabase
                    .from('customers')
                    .select('id, email, first_name, last_name, order_count, total_spent, last_order_at, status')
                    .order('id', { ascending: true })
            )),
            optionalPagedRows(() => (
                supabase
                    .from('segments')
                    .select('id, name, slug, audience, active, smartlead_campaign_id')
                    .order('created_at', { ascending: true })
            )),
            optionalPagedRows(() => (
                supabase
                    .from('outreach')
                    .select('id, segment_id, status, opened, replied, positive_reply, bounced')
                    .order('id', { ascending: true })
            )),
            optionalSingle(supabase.from('leads').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()),
            optionalSingle(supabase.from('leads').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()),
            optionalSingle(
                supabase
                    .from('outreach')
                    .select('sent_at')
                    .in('status', OUTREACH_SENT_STATUSES)
                    .not('sent_at', 'is', null)
                    .order('sent_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
            ),
            optionalSingle(
                supabase
                    .from('outreach')
                    .select('replied_at')
                    .eq('replied', true)
                    .not('replied_at', 'is', null)
                    .order('replied_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
            ),
            optionalSingle(supabase.from('website_captures').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle())
        ])

        const outreachChecks = [
            queuedOutreach,
            personalizedOutreach,
            sentThisWeek,
            repliesThisWeek,
            missingCampaigns,
            suppressionCount
        ]
        const outreachFailures = outreachChecks.filter((check) => !check.ok)
        const outreachAvailable = outreachFailures.length === 0
        const segmentHealthAvailable = segmentRows.ok && outreachRows.ok
        const customerData = customerRows.data || []
        const activeCustomerRows = customerData.filter((customer) => isActiveCustomerStatus(customer.status))
        const reorderDueRows = activeCustomerRows.filter(isCustomerReorderDue)
        const totalCustomerRevenue = activeCustomerRows.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0)
        const repeatCustomers = activeCustomerRows.filter((customer) => Number(customer.order_count || 0) >= 2).length
        const topCustomers = activeCustomerRows
            .filter((customer) => Number(customer.total_spent || 0) > 0)
            .sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0))
            .slice(0, 5)
            .map((customer) => ({
                id: customer.id,
                name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email,
                email: customer.email,
                totalSpent: Number(customer.total_spent || 0),
                orderCount: Number(customer.order_count || 0),
                lastOrderAt: customer.last_order_at
            }))
        const commerceAvailable = customerRows.ok
        const segmentHealthRows = segmentHealthAvailable
            ? buildSegmentHealth(segmentRows.data || [], outreachRows.data || [])
            : []
        const freshness = [
            freshnessItem({
                label: 'Newest lead import',
                at: latestLead.data?.created_at,
                warningDays: 14,
                dangerDays: 30,
                emptyDetail: 'No leads imported yet',
                path: '/upload-data',
                error: latestLead.error
            }),
            freshnessItem({
                label: 'Latest CRM update',
                at: latestLeadUpdate.data?.updated_at,
                warningDays: 7,
                dangerDays: 21,
                emptyDetail: 'No lead updates found',
                path: '/leads',
                error: latestLeadUpdate.error
            }),
            freshnessItem({
                label: 'Latest outreach send',
                at: latestOutreachSend.data?.sent_at,
                warningDays: 7,
                dangerDays: 14,
                emptyDetail: 'No sent outreach found',
                path: '/outreach',
                error: latestOutreachSend.error
            }),
            freshnessItem({
                label: 'Latest reply',
                at: latestReply.data?.replied_at,
                warningDays: 14,
                dangerDays: 30,
                emptyDetail: 'No replies logged yet',
                path: '/outreach',
                error: latestReply.error
            }),
            freshnessItem({
                label: 'Latest website capture',
                at: latestCapture.data?.created_at,
                warningDays: 14,
                dangerDays: 30,
                emptyDetail: 'No website captures found',
                path: '/customers?tab=captures',
                error: latestCapture.error
            })
        ]

        const health = [
            {
                label: 'Missing contact info',
                value: missingContact,
                severity: missingContact > 0 ? 'warning' : 'good',
                path: '/leads?contact=missing'
            },
            {
                label: 'Leads without follow-up',
                value: noFollowUp,
                severity: noFollowUp > 0 ? 'warning' : 'good',
                path: '/leads?followup=none'
            },
            {
                label: 'Campaign IDs missing',
                value: missingCampaigns.count,
                severity: !missingCampaigns.ok || missingCampaigns.count > 0 ? 'danger' : 'good',
                path: '/outreach'
            },
            {
                label: 'Unpromoted consent captures',
                value: unpromotedCaptures.count,
                severity: !unpromotedCaptures.ok ? 'danger' : unpromotedCaptures.count > 0 ? 'warning' : 'good',
                path: UNPROMOTED_CAPTURES_PATH,
                detail: unpromotedCaptures.ok ? null : unpromotedCaptures.error
            },
            {
                label: 'Customers due for reorder',
                value: reorderDueRows.length,
                severity: !commerceAvailable ? 'danger' : reorderDueRows.length > 0 ? 'warning' : 'good',
                path: REORDER_DUE_CUSTOMERS_PATH,
                detail: !commerceAvailable ? customerRows.error : `${REORDER_DUE_DAYS}+ days since last order`
            },
            {
                label: 'Replies needing review',
                value: replyReviewTasks,
                severity: replyReviewTasks > 0 ? 'warning' : 'good',
                path: REPLY_REVIEW_TASK_PATH,
                detail: replyReviewTasks > 0 ? 'Smartlead detected replies that need inbox review' : 'No detected replies waiting'
            },
            {
                label: outreachAvailable ? 'Outreach metrics online' : 'Outreach metrics unavailable',
                value: outreachFailures.length,
                severity: outreachAvailable ? 'good' : 'danger',
                path: '/outreach',
                detail: outreachAvailable
                    ? 'Automation tables are readable'
                    : outreachFailures.map((failure) => failure.error).filter(Boolean).join('; ')
            }
        ]

        const topActions = [
            {
                label: 'Detected replies to review',
                value: replyReviewTasks,
                path: REPLY_REVIEW_TASK_PATH,
                tone: replyReviewTasks > 0 ? 'danger' : 'good'
            },
            {
                label: 'Overdue follow-ups',
                value: overdueFollowups,
                path: '/leads?followup=overdue',
                tone: overdueFollowups > 0 ? 'danger' : 'good'
            },
            {
                label: 'Tasks due today',
                value: todayTasks,
                path: '/tasks?filter=today',
                tone: todayTasks > 0 ? 'warning' : 'good'
            },
            {
                label: 'Warm captures to promote',
                value: unpromotedCaptures.count,
                path: UNPROMOTED_CAPTURES_PATH,
                tone: unpromotedCaptures.count > 0 ? 'warning' : 'good'
            },
            {
                label: 'Customers due for reorder',
                value: reorderDueRows.length,
                path: REORDER_DUE_CUSTOMERS_PATH,
                tone: reorderDueRows.length > 0 ? 'warning' : 'good'
            },
            {
                label: 'Personalized emails ready',
                value: personalizedOutreach.count,
                path: '/outreach',
                tone: personalizedOutreach.count > 0 ? 'good' : 'neutral'
            }
        ]

        const launchChecklist = [
            {
                label: 'CRM database connected',
                detail: `${totalLeads.toLocaleString()} leads loaded`,
                value: totalLeads,
                status: 'ready',
                path: '/leads'
            },
            {
                label: 'Campaign IDs mapped',
                detail: missingCampaigns.count > 0
                    ? `${missingCampaigns.count.toLocaleString()} active segments need Smartlead IDs`
                    : 'Active segments are ready for routing',
                value: missingCampaigns.count,
                status: !missingCampaigns.ok || missingCampaigns.count > 0 ? 'blocked' : 'ready',
                path: '/outreach'
            },
            {
                label: 'Capture follow-through',
                detail: unpromotedCaptures.count > 0
                    ? `${unpromotedCaptures.count.toLocaleString()} warm consent captures need promotion`
                    : 'No warm captures waiting',
                value: unpromotedCaptures.count,
                status: !unpromotedCaptures.ok ? 'blocked' : unpromotedCaptures.count > 0 ? 'attention' : 'ready',
                path: UNPROMOTED_CAPTURES_PATH
            },
            {
                label: 'Contact data hygiene',
                detail: missingContact > 0
                    ? `${missingContact.toLocaleString()} leads are missing email or phone`
                    : 'Lead contact fields look complete',
                value: missingContact,
                status: missingContact > 0 ? 'attention' : 'ready',
                path: '/leads?contact=missing'
            },
            {
                label: 'Follow-up coverage',
                detail: noFollowUp > 0
                    ? `${noFollowUp.toLocaleString()} open leads need a next step`
                    : 'Every lead has a next follow-up',
                value: noFollowUp,
                status: noFollowUp > 0 ? 'attention' : 'ready',
                path: '/leads?followup=none'
            },
            {
                label: 'Outreach queue ready',
                detail: personalizedOutreach.count > 0
                    ? `${personalizedOutreach.count.toLocaleString()} personalized emails ready`
                    : `${queuedOutreach.count.toLocaleString()} queued outreach rows`,
                value: personalizedOutreach.count + queuedOutreach.count,
                status: personalizedOutreach.count > 0 || queuedOutreach.count > 0 ? 'ready' : 'attention',
                path: '/outreach'
            }
        ]

        const dailyPlan = [
            {
                rank: 1,
                label: replyReviewTasks > 0 ? 'Review detected replies' : 'Reply review queue is clear',
                detail: replyReviewTasks > 0
                    ? `${replyReviewTasks.toLocaleString()} Smartlead-detected replies need human classification before the next move.`
                    : 'No detected replies are waiting for inbox review.',
                value: replyReviewTasks,
                status: replyReviewTasks > 0 ? 'attention' : 'ready',
                path: REPLY_REVIEW_TASK_PATH,
                priority: replyReviewTasks > 0 ? 110 : 9
            },
            {
                rank: 2,
                label: missingCampaigns.count > 0 ? 'Unblock campaign routing' : 'Campaign routing is ready',
                detail: missingCampaigns.count > 0
                    ? `${missingCampaigns.count.toLocaleString()} active segments are missing Smartlead campaign IDs. Fix this before scaling outbound.`
                    : 'Active segments have campaign IDs, so outreach can route correctly.',
                value: missingCampaigns.count,
                status: missingCampaigns.count > 0 ? 'blocked' : 'ready',
                path: '/outreach',
                priority: missingCampaigns.count > 0 ? 100 : 10
            },
            {
                rank: 3,
                label: overdueFollowups > 0 ? 'Clear overdue follow-ups' : 'No overdue follow-ups',
                detail: overdueFollowups > 0
                    ? `${overdueFollowups.toLocaleString()} leads are past due. Start here before new prospecting.`
                    : 'No past-due follow-up queue is blocking today.',
                value: overdueFollowups,
                status: overdueFollowups > 0 ? 'attention' : 'ready',
                path: '/leads?followup=overdue',
                priority: overdueFollowups > 0 ? 90 : 8
            },
            {
                rank: 4,
                label: todayTasks > 0 ? 'Finish today tasks' : 'No tasks due today',
                detail: todayTasks > 0
                    ? `${todayTasks.toLocaleString()} open tasks are due today. Knock these out while they are warm.`
                    : 'No due-today task pile waiting.',
                value: todayTasks,
                status: todayTasks > 0 ? 'attention' : 'ready',
                path: '/tasks?filter=today',
                priority: todayTasks > 0 ? 80 : 6
            },
            {
                rank: 5,
                label: reorderDueRows.length > 0 ? 'Nudge reorder customers' : 'Reorder queue is clear',
                detail: reorderDueRows.length > 0
                    ? `${reorderDueRows.length.toLocaleString()} active customer${reorderDueRows.length === 1 ? '' : 's'} have not ordered in ${REORDER_DUE_DAYS}+ days.`
                    : 'No active customers are overdue for a reorder touch.',
                value: reorderDueRows.length,
                status: reorderDueRows.length > 0 ? 'attention' : 'ready',
                path: REORDER_DUE_CUSTOMERS_PATH,
                priority: reorderDueRows.length > 0 ? 75 : 5
            },
            {
                rank: 6,
                label: unpromotedCaptures.count > 0 ? 'Promote warm captures' : 'Capture queue is clean',
                detail: unpromotedCaptures.count > 0
                    ? `${unpromotedCaptures.count.toLocaleString()} consented captures can become customers or outreach rows.`
                    : 'No consented captures are waiting for follow-through.',
                value: unpromotedCaptures.count,
                status: unpromotedCaptures.count > 0 ? 'attention' : 'ready',
                path: UNPROMOTED_CAPTURES_PATH,
                priority: unpromotedCaptures.count > 0 ? 70 : 5
            },
            {
                rank: 7,
                label: personalizedOutreach.count > 0 ? 'Send ready outreach' : 'Build the outreach queue',
                detail: personalizedOutreach.count > 0
                    ? `${personalizedOutreach.count.toLocaleString()} personalized emails are ready for dispatch.`
                    : `${queuedOutreach.count.toLocaleString()} queued rows and no personalized emails ready yet.`,
                value: personalizedOutreach.count,
                status: personalizedOutreach.count > 0 ? 'ready' : 'attention',
                path: '/outreach',
                priority: personalizedOutreach.count > 0 ? 60 : 35
            },
            {
                rank: 8,
                label: noFollowUp > 0 ? 'Assign next steps' : 'Follow-up coverage is clean',
                detail: noFollowUp > 0
                    ? `${noFollowUp.toLocaleString()} open leads need a next follow-up date.`
                    : 'Every open lead has a next step.',
                value: noFollowUp,
                status: noFollowUp > 0 ? 'attention' : 'ready',
                path: '/leads?followup=none',
                priority: noFollowUp > 0 ? 50 : 4
            }
        ]
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 5)
            .map((item, index) => ({ ...item, rank: index + 1 }))

        const readyChecklistItems = launchChecklist.filter((item) => item.status === 'ready').length
        const blockedChecklistItems = launchChecklist.filter((item) => item.status === 'blocked').length
        const contactCompletenessRate = totalLeads
            ? clampPercent(((totalLeads - missingContact) / totalLeads) * 100)
            : 0
        const launchReadinessRate = launchChecklist.length
            ? clampPercent((readyChecklistItems / launchChecklist.length) * 100)
            : 0
        const outreachReplyRate7d = sentThisWeek.count > 0
            ? repliesThisWeek.count / sentThisWeek.count
            : 0
        const taskLoad = overdueFollowups + overdueTasks + replyReviewTasks
        const estimatedReorderOpportunity = reorderDueRows.length * (
            activeCustomerRows.length ? totalCustomerRevenue / activeCustomerRows.length : 0
        )
        const next7WorkItems = overdueFollowups + todayFollowups + upcomingFollowups7d + overdueTasks + todayTasks + tasksNext7d + replyReviewTasks
        const readyOutreach7d = personalizedOutreach.count + queuedOutreach.count
        const growthForecast = {
            windowDays: 7,
            workItems: next7WorkItems,
            overdueWorkItems: overdueFollowups + overdueTasks,
            followups: {
                overdue: overdueFollowups,
                today: todayFollowups,
                upcoming: upcomingFollowups7d,
                total: overdueFollowups + todayFollowups + upcomingFollowups7d
            },
            tasks: {
                overdue: overdueTasks,
                today: todayTasks,
                upcoming: tasksNext7d,
                total: overdueTasks + todayTasks + tasksNext7d
            },
            readyOutreach: readyOutreach7d,
            hotLeadCount: hotLeads,
            reorderOpportunity: estimatedReorderOpportunity,
            reorderCustomers: reorderDueRows.length,
            expectedTouchpoints: next7WorkItems + readyOutreach7d + reorderDueRows.length,
            status: missingCampaigns.count > 0 || blockedChecklistItems > 0
                ? 'blocked'
                : next7WorkItems > 25
                    ? 'busy'
                    : readyOutreach7d > 0 || reorderDueRows.length > 0 || hotLeads > 0
                        ? 'opportunity'
                        : 'steady'
        }
        const operatingScore = clampPercent(
            100
            - (blockedChecklistItems * 18)
            - Math.min(30, taskLoad * 3)
            - (missingCampaigns.count > 0 ? 15 : 0)
            - (missingContact > 0 ? Math.min(15, Math.ceil((missingContact / Math.max(totalLeads, 1)) * 100)) : 0)
            + (personalizedOutreach.count > 0 ? 4 : 0)
            + (repliesThisWeek.count > 0 ? 4 : 0)
        )
        const operatingStatus = operatingScore >= 85
            ? 'healthy'
            : operatingScore >= 65
                ? 'watch'
                : 'needs-attention'
        const scoreDrivers = [
            blockedChecklistItems > 0 && `${blockedChecklistItems} launch blocker${blockedChecklistItems === 1 ? '' : 's'}`,
            taskLoad > 0 && `${taskLoad.toLocaleString()} urgent item${taskLoad === 1 ? '' : 's'}`,
            missingContact > 0 && `${missingContact.toLocaleString()} incomplete contact record${missingContact === 1 ? '' : 's'}`,
            reorderDueRows.length > 0 && `${reorderDueRows.length.toLocaleString()} reorder touch${reorderDueRows.length === 1 ? '' : 'es'} due`,
            repliesThisWeek.count > 0 && `${repliesThisWeek.count.toLocaleString()} repl${repliesThisWeek.count === 1 ? 'y' : 'ies'} this week`
        ].filter(Boolean)

        return {
            asOf: new Date().toISOString(),
            kpis: {
                totalLeads,
                hotLeads,
                customers: activeCustomerRows.length,
                captures: captures.count
            },
            queue: {
                overdueFollowups,
                todayFollowups,
                upcomingFollowups7d,
                openTasks,
                overdueTasks,
                todayTasks,
                tasksNext7d,
                noFollowUp
            },
            marketing: {
                queuedOutreach: queuedOutreach.count,
                personalizedOutreach: personalizedOutreach.count,
                sentThisWeek: sentThisWeek.count,
                repliesThisWeek: repliesThisWeek.count,
                replyReviewTasks,
                suppressionCount: suppressionCount.count,
                missingCampaigns: missingCampaigns.count,
                outreachAvailable,
                outreachErrorCount: outreachFailures.length
            },
            commerce: {
                available: commerceAvailable,
                error: commerceAvailable ? null : customerRows.error,
                totalRevenue: totalCustomerRevenue,
                repeatCustomers,
                reorderDue: reorderDueRows.length,
                reorderDueDays: REORDER_DUE_DAYS,
                averageRevenuePerActiveCustomer: activeCustomerRows.length ? totalCustomerRevenue / activeCustomerRows.length : 0,
                topCustomers
            },
            segmentHealth: {
                available: segmentHealthAvailable,
                error: segmentHealthAvailable ? null : segmentRows.error || outreachRows.error,
                segments: segmentHealthRows,
                blocked: segmentHealthRows.filter((segment) => segment.status === 'blocked').length,
                ready: segmentHealthRows.filter((segment) => segment.status === 'ready').length,
                measuring: segmentHealthRows.filter((segment) => segment.status === 'measuring').length
            },
            scorecard: {
                operatingScore,
                operatingStatus,
                launchReadinessRate,
                contactCompletenessRate,
                outreachReplyRate7d,
                estimatedReorderOpportunity,
                urgentWorkItems: taskLoad,
                blockedChecklistItems,
                readyChecklistItems,
                totalChecklistItems: launchChecklist.length,
                scoreDrivers
            },
            growthForecast,
            health,
            freshness,
            topActions,
            launchChecklist,
            dailyPlan
        }
    },

    async getPriorityWorklist(limit = 12) {
        const supabase = getSupabaseClient()
        const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
        const leadFields = 'id, business_name, city, state, lead_stage, next_follow_up_date, next_follow_up_task, email, phone, rating, reviews_count, created_at'

        const [overdueResult, todayResult, hotResult, taskResult] = await Promise.all([
            supabase
                .from('leads')
                .select(leadFields)
                .not('next_follow_up_date', 'is', null)
                .lt('next_follow_up_date', today)
                .not('lead_stage', 'in', CLOSED_LEAD_STAGE_FILTER)
                .order('next_follow_up_date', { ascending: true })
                .limit(25),
            supabase
                .from('leads')
                .select(leadFields)
                .eq('next_follow_up_date', today)
                .not('lead_stage', 'in', CLOSED_LEAD_STAGE_FILTER)
                .order('created_at', { ascending: false })
                .limit(25),
            supabase
                .from('leads')
                .select(leadFields)
                .in('lead_stage', ['interested', 'qualified', 'samples_sent'])
                .order('updated_at', { ascending: false })
                .limit(25),
            supabase
                .from('tasks')
                .select(`
                    id,
                    task_name,
                    due_date,
                    lead_id,
                    leads:lead_id (${leadFields})
                `)
                .eq('completed', false)
                .lte('due_date', today)
                .order('due_date', { ascending: true })
                .limit(25)
        ])

        if (overdueResult.error) throw overdueResult.error
        if (todayResult.error) throw todayResult.error
        if (hotResult.error) throw hotResult.error
        if (taskResult.error) throw taskResult.error

        const byLead = new Map()
        const upsertLeadItem = (lead, reason, action, scoreBoost = 0) => {
            if (!lead?.id) return
            const existing = byLead.get(lead.id)
            const score = leadPriorityScore(lead) + scoreBoost
            const item = existing || {
                id: lead.id,
                leadId: lead.id,
                businessName: lead.business_name || 'Unnamed lead',
                location: [lead.city, lead.state].filter(Boolean).join(', '),
                stage: lead.lead_stage || 'new',
                followupDate: lead.next_follow_up_date,
                action,
                reasons: [],
                score: 0,
                hasContact: Boolean(lead.email || lead.phone),
                phone: lead.phone || null,
                path: `/leads/${lead.id}`
            }
            item.score = Math.max(item.score, score)
            if (!item.reasons.includes(reason)) item.reasons.push(reason)
            if (score >= item.score) item.action = action
            byLead.set(lead.id, item)
        }

        for (const lead of overdueResult.data || []) {
            upsertLeadItem(lead, 'Overdue follow-up', lead.next_follow_up_task || 'Follow up now', 40)
        }
        for (const lead of todayResult.data || []) {
            upsertLeadItem(lead, 'Due today', lead.next_follow_up_task || 'Follow up today', 30)
        }
        for (const lead of hotResult.data || []) {
            upsertLeadItem(lead, 'Hot stage', 'Move deal forward', 18)
        }
        for (const task of taskResult.data || []) {
            upsertLeadItem(task.leads, task.due_date < today ? 'Task overdue' : 'Task due today', task.task_name || 'Complete task', 45)
        }

        return [...byLead.values()]
            .sort((a, b) => b.score - a.score || (a.followupDate || '').localeCompare(b.followupDate || ''))
            .slice(0, limit)
    },

    // Get calls over time (last N days)
    async getCallsOverTime(days = 30) {
        const supabase = getSupabaseClient()
        const startDate = startOfDay(new Date())
        startDate.setDate(startDate.getDate() - days)

        const data = await fetchAllRows(() => (
            supabase
                .from('call_logs')
                .select('id, created_at')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })
        ))

        // Group by date
        const callsByDate = {}
        data.forEach(call => {
            const date = format(new Date(call.created_at), 'yyyy-MM-dd')
            callsByDate[date] = (callsByDate[date] || 0) + 1
        })

        // Fill in missing dates with 0
        const result = []
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = format(date, 'yyyy-MM-dd')
            result.push({
                date: dateStr,
                count: callsByDate[dateStr] || 0
            })
        }

        return result
    }
}
