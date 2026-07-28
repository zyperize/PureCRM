import { getSupabaseClient } from './supabase'
import { fetchAllRows, requireMutationRow } from './serviceUtils'
import {
    startOfDay, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, subDays, subMonths
} from 'date-fns'

export const callsService = {
    // Log a new call
    async logCall(leadId, { direction = 'outbound', duration, outcome, notes, transcript, summary }) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('call_logs')
            .insert([{
                lead_id: leadId,
                call_direction: direction,
                call_duration: duration,
                call_outcome: outcome,
                call_notes: notes,
                transcript: transcript || null,
                summary: summary || null
            }])
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Call log was not created. Check database permissions and try again.')
    },

    // Get call logs for a lead
    async getCallLogs(leadId) {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('call_logs')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
        ))
    },

    // Get recent calls across all leads (for CallHistory component)
    async getRecentCalls(limit = 50) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('call_logs')
            .select(`
                *,
                leads (
                    business_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return data
    },

    // Get call statistics for dashboard
    async getCallStats() {
        const supabase = getSupabaseClient()
        const now = new Date()
        const today = startOfDay(now)
        const yesterday = startOfDay(subDays(now, 1))
        const weekStart = startOfWeek(now, { weekStartsOn: 1 })
        const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
        const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 })
        const monthStart = startOfMonth(now)
        const lastMonthStart = startOfMonth(subMonths(now, 1))
        const lastMonthEnd = endOfMonth(subMonths(now, 1))
        const sixtyDaysAgo = subDays(now, 60)
        const oneEightyDaysAgo = subDays(now, 180)

        // Get all calls in the last 180 days
        const calls = await fetchAllRows(() => (
            supabase
                .from('call_logs')
                .select('id, created_at')
                .gte('created_at', oneEightyDaysAgo.toISOString())
                .order('id', { ascending: true })
        ))

        // Calculate stats
        const stats = {
            today: 0,
            yesterday: 0,
            thisWeek: 0,
            lastWeek: 0,
            thisMonth: 0,
            lastMonth: 0,
            last60Days: 0,
            last180Days: 0
        }

        calls.forEach(call => {
            const callDate = new Date(call.created_at)

            if (callDate >= today) stats.today++
            if (callDate >= yesterday && callDate < today) stats.yesterday++
            if (callDate >= weekStart) stats.thisWeek++
            if (callDate >= lastWeekStart && callDate <= lastWeekEnd) stats.lastWeek++
            if (callDate >= monthStart) stats.thisMonth++
            if (callDate >= lastMonthStart && callDate <= lastMonthEnd) stats.lastMonth++
            if (callDate >= sixtyDaysAgo) stats.last60Days++
            stats.last180Days++ // All calls are within 180 days due to query filter
        })

        return stats
    },

    // Save AI transcript and summary (called after transcription)
    async saveTranscript(callId, transcript, summary) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('call_logs')
            .update({ transcript, summary })
            .eq('id', callId)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Call log not found or you do not have permission to update it.')
    }
}
