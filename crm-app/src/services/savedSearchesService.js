import { getSupabaseClient } from './supabase'
import { requireMutationRow } from './serviceUtils'

export const savedSearchesService = {
  async getSavedSearches() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createSavedSearch(searchData) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('saved_searches')
      .insert([searchData])
      .select()
      .maybeSingle()

    if (error) throw error
    return requireMutationRow(data, 'Saved search was not created. Check database permissions and try again.')
  },

  async deleteSavedSearch(id) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    requireMutationRow(data, 'Saved search not found or you do not have permission to delete it.')
  }
}
