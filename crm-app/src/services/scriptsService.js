import { getSupabaseClient } from './supabase'
import { fetchAllRows, requireMutationRow } from './serviceUtils'

export const scriptsService = {
    // Get all scripts
    async getScripts() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('calling_scripts')
                .select('*')
                .order('created_at', { ascending: false })
        ))
    },

    // Get active scripts only
    async getActiveScripts() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('calling_scripts')
                .select('*')
                .eq('active', true)
                .order('script_type')
        ))
    },

    // Get a single script by ID
    async getScript(id) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('calling_scripts')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        if (error) throw error
        if (!data) throw new Error('Calling script not found.')
        return data
    },

    // Create a new script
    async createScript(scriptName, scriptType, scriptContent) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('calling_scripts')
            .insert([{
                script_name: scriptName,
                script_type: scriptType,
                script_content: scriptContent
            }])
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Calling script was not created. Check database permissions and try again.')
    },

    // Update a script
    async updateScript(id, updates) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('calling_scripts')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Calling script not found or you do not have permission to update it.')
    },

    // Delete a script
    async deleteScript(id) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('calling_scripts')
            .delete()
            .eq('id', id)
            .select('id')
            .maybeSingle()

        if (error) throw error
        requireMutationRow(data, 'Calling script not found or you do not have permission to delete it.')
    },

    // Replace placeholders in script content
    replacePlaceholders(scriptContent, lead, userName = 'User') {
        if (!scriptContent || !lead) return scriptContent

        return scriptContent
            .replace(/\[YOUR_NAME\]/g, userName)
            .replace(/\[BUSINESS_NAME\]/g, lead.business_name || '')
            .replace(/\[MANAGER_NAME\]/g, lead.manager_name || '')
            .replace(/\[CITY\]/g, lead.city || '')
            .replace(/\[STATE\]/g, lead.state || '')
            .replace(/\[PHONE\]/g, lead.phone || '')
    }
}
