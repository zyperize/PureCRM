import { getSupabaseClient } from './supabase'
import { requireMutationRow } from './serviceUtils'

export const settingsService = {
    // Get a setting value by key
    async getSetting(key) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('user_settings')
            .select('setting_value')
            .eq('setting_key', key)
            .maybeSingle()

        if (error) throw error
        return data?.setting_value
    },

    // Set a setting value (upsert)
    async setSetting(key, value) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('user_settings')
            .upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' })
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Setting was not saved. Check database permissions and try again.')
    },

    // Get user name (convenience method)
    async getUserName() {
        const name = await this.getSetting('user_name')
        return name || 'User'
    },

    // Set user name (convenience method)
    async setUserName(name) {
        return await this.setSetting('user_name', name?.trim() || 'User')
    }
}
