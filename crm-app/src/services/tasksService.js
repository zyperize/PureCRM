import { getSupabaseClient } from './supabase'
import { fetchAllRows, requireMutationRow, requireMutationRows } from './serviceUtils'

export const tasksService = {
    // Get all tasks for a lead
    async getTasks(leadId) {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('tasks')
                .select('*')
                .eq('lead_id', leadId)
                .order('display_order')
        ))
    },

    // Get open tasks with due dates for the follow-up queue
    async getFollowUpTasks() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('tasks')
                .select('*, lead:leads(id, business_name, phone, city, state)')
                .not('due_date', 'is', null)
                .eq('completed', false)
                .order('due_date', { ascending: true })
        ))
    },

    async getAllTasks() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('tasks')
                .select('*, lead:leads(id, business_name)')
                .order('completed', { ascending: true })
                .order('due_date', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false })
        ))
    },

    async getCalendarTasks(startDate, endDate) {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('tasks')
                .select('*, lead:leads(id, business_name)')
                .not('due_date', 'is', null)
                .gte('due_date', startDate)
                .lte('due_date', endDate)
                .eq('completed', false)
                .order('due_date')
        ))
    },

    // Get all task templates
    async getTaskTemplates() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('lead_task_templates')
                .select('*')
                .eq('active', true)
                .order('display_order')
        ))
    },

    // Create a new task for a lead (dueDate optional, 'yyyy-MM-dd')
    async createTask(leadId, taskName, displayOrder = 0, dueDate = null) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                lead_id: leadId,
                task_name: taskName,
                display_order: displayOrder,
                due_date: dueDate
            }])
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Task was not created. Check database permissions and try again.')
    },

    // Toggle task completion status
    async toggleTaskComplete(taskId, completed) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('tasks')
            .update({
                completed,
                completed_at: completed ? new Date().toISOString() : null
            })
            .eq('id', taskId)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Task not found or you do not have permission to update it.')
    },

    async getAllTaskTemplates() {
        const supabase = getSupabaseClient()
        return fetchAllRows(() => (
            supabase
                .from('lead_task_templates')
                .select('*')
                .order('display_order')
        ))
    },

    async createTaskTemplate(templateData, displayOrder) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('lead_task_templates')
            .insert([{ ...templateData, display_order: displayOrder }])
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Task template was not created. Check database permissions and try again.')
    },

    async updateTaskTemplate(id, updates) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('lead_task_templates')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Task template not found or you do not have permission to update it.')
    },

    async deactivateTaskTemplate(id) {
        return this.updateTaskTemplate(id, { active: false })
    },

    async deleteTaskTemplate(id) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('lead_task_templates')
            .delete()
            .eq('id', id)
            .select('id')
            .maybeSingle()

        if (error) throw error
        requireMutationRow(data, 'Task template not found or you do not have permission to delete it.')
    },

    async swapTaskTemplateOrder(firstTemplate, secondTemplate) {
        const supabase = getSupabaseClient()
        const { data: firstData, error: firstError } = await supabase
            .from('lead_task_templates')
            .update({ display_order: secondTemplate.display_order })
            .eq('id', firstTemplate.id)
            .select('id')
            .maybeSingle()

        if (firstError) throw firstError
        requireMutationRow(firstData, 'First task template not found or you do not have permission to reorder it.')

        const { data: secondData, error: secondError } = await supabase
            .from('lead_task_templates')
            .update({ display_order: firstTemplate.display_order })
            .eq('id', secondTemplate.id)
            .select('id')
            .maybeSingle()

        if (secondError) throw secondError
        requireMutationRow(secondData, 'Second task template not found or you do not have permission to reorder it.')
    },

    async completeTask(taskId) {
        return this.toggleTaskComplete(taskId, true)
    },

    async rescheduleTask(taskId, dueDate) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('tasks')
            .update({ due_date: dueDate })
            .eq('id', taskId)
            .select()
            .maybeSingle()

        if (error) throw error
        return requireMutationRow(data, 'Task not found or you do not have permission to reschedule it.')
    },

    // Initialize tasks for a new lead from templates
    async initializeLeadTasks(leadId) {
        const supabase = getSupabaseClient()
        const templates = await this.getTaskTemplates()

        const tasksToCreate = templates.map(template => ({
            lead_id: leadId,
            task_name: template.task_name,
            display_order: template.display_order
        }))

        if (tasksToCreate.length === 0) return []

        const { data, error } = await supabase
            .from('tasks')
            .insert(tasksToCreate)
            .select()

        if (error) throw error
        return requireMutationRows(data, tasksToCreate.length, 'Lead tasks were not fully created. Check database permissions and try again.')
    },

    // Delete a task
    async deleteTask(taskId) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId)
            .select('id')
            .maybeSingle()

        if (error) throw error
        requireMutationRow(data, 'Task not found or you do not have permission to delete it.')
    }
}
