import { getSupabaseClient } from './supabase'
import { fetchAllRows, requireMutationRow } from './serviceUtils'

export const qualificationService = {
    // Get all active qualification questions
    async getQuestions() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('qualification_questions')
                .select('*')
                .eq('active', true)
                .order('display_order')
        ))
    },

    async getAllQuestions() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('qualification_questions')
                .select('*')
                .order('display_order')
        ))
    },

    // Get answers for a specific lead
    async getAnswers(leadId) {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('qualification_answers')
                .select('*')
                .eq('lead_id', leadId)
                .order('display_order')
        ))
    },

    // Save or update an answer (upsert)
    async saveAnswer(leadId, question, answer, displayOrder = 0) {
        const supabase = getSupabaseClient()
        // Check if answer exists
        const { data: existing, error: existingError } = await supabase
            .from('qualification_answers')
            .select('id')
            .eq('lead_id', leadId)
            .eq('question', question)
            .maybeSingle()

        if (existingError) throw existingError

        if (existing) {
            // Update existing answer
            const { data, error } = await supabase
                .from('qualification_answers')
                .update({ answer })
                .eq('id', existing.id)
                .select()
                .maybeSingle()

            if (error) throw error
            return requireMutationRow(data, 'Qualification answer not found or you do not have permission to update it.')
        } else {
            // Create new answer
            const { data, error } = await supabase
                .from('qualification_answers')
                .insert([{
                    lead_id: leadId,
                    question,
                    answer,
                    display_order: displayOrder
                }])
                .select()
                .maybeSingle()

            if (error) throw error
            return requireMutationRow(data, 'Qualification answer was not created. Check database permissions and try again.')
        }
    },

    // Create a new question template
    async createQuestion(questionText, displayOrder = 0) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('qualification_questions')
            .insert([{
                question: questionText,
                display_order: displayOrder
            }])
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Qualification question was not created. Check database permissions and try again.')
    },

    async createQuestionTemplate(questionData, displayOrder = 0) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('qualification_questions')
            .insert([{ ...questionData, display_order: displayOrder }])
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Qualification question was not created. Check database permissions and try again.')
    },

    // Update a question
    async updateQuestion(id, updates) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('qualification_questions')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Qualification question not found or you do not have permission to update it.')
    },

    // Delete a question (soft delete - set inactive)
    async deleteQuestion(id) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('qualification_questions')
            .update({ active: false })
            .eq('id', id)
            .select('id')
            .maybeSingle()

        if (error) throw error
        requireMutationRow(data, 'Qualification question not found or you do not have permission to deactivate it.')
    },

    async hardDeleteQuestion(id) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('qualification_questions')
            .delete()
            .eq('id', id)
            .select('id')
            .maybeSingle()

        if (error) throw error
        requireMutationRow(data, 'Qualification question not found or you do not have permission to delete it.')
    },

    async swapQuestionOrder(firstQuestion, secondQuestion) {
        const supabase = getSupabaseClient()
        const { data: firstData, error: firstError } = await supabase
            .from('qualification_questions')
            .update({ display_order: secondQuestion.display_order })
            .eq('id', firstQuestion.id)
            .select('id')
            .maybeSingle()

        if (firstError) throw firstError
        requireMutationRow(firstData, 'First qualification question not found or you do not have permission to reorder it.')

        const { data: secondData, error: secondError } = await supabase
            .from('qualification_questions')
            .update({ display_order: firstQuestion.display_order })
            .eq('id', secondQuestion.id)
            .select('id')
            .maybeSingle()

        if (secondError) throw secondError
        requireMutationRow(secondData, 'Second qualification question not found or you do not have permission to reorder it.')
    }
}
