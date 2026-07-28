import { getSupabaseClient } from './supabase'
import { sanitize } from './sanitize'
import { fetchAllRows, requireMutationRow } from './serviceUtils'

export const notesService = {
    // Get all notes for a lead
    async getNotes(leadId) {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('notes')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
        ))
    },

    // Create a new note
    async createNote(leadId, noteText, noteType = 'general') {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('notes')
            .insert([{
                lead_id: leadId,
                note_text: sanitize.text(noteText),
                note_type: noteType
            }])
            .select()
            .maybeSingle()

        if (error) throw error

        return requireMutationRow(data, 'Note was not created. Check database permissions and try again.')
    },

    // Update a note
    async updateNote(noteId, noteText) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('notes')
            .update({ note_text: sanitize.text(noteText) })
            .eq('id', noteId)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Note not found or you do not have permission to update it.')
    },

    // Delete a note
    async deleteNote(noteId) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteId)
            .select('id')
            .maybeSingle()

        if (error) throw error
        requireMutationRow(data, 'Note not found or you do not have permission to delete it.')
    }
}
