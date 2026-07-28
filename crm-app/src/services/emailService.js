import { getSupabaseClient } from './supabase';
import { fetchAllRows, requireMutationRow } from './serviceUtils';

export const emailService = {
    /**
     * Get all email templates
     */
    async getTemplates() {
        const supabase = getSupabaseClient();
        return fetchAllRows(() => (
            supabase
                .from('email_templates')
                .select('*')
                .order('created_at', { ascending: false })
        ));
    },

    /**
     * Get single template by ID
     */
    async getTemplate(id) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Email template not found.');
        return data;
    },

    /**
     * Create new email template
     */
    async createTemplate({ name, subject, body }) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('email_templates')
            .insert([{ name, subject, body }])
            .select()
            .maybeSingle();

        if (error) throw error;
        return requireMutationRow(data, 'Email template was not created. Check database permissions and try again.');
    },

    /**
     * Update existing template
     */
    async updateTemplate(id, { name, subject, body }) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('email_templates')
            .update({ name, subject, body, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;
        return requireMutationRow(data, 'Email template not found or you do not have permission to update it.');
    },

    /**
     * Delete template
     */
    async deleteTemplate(id) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('email_templates')
            .delete()
            .eq('id', id)
            .select('id')
            .maybeSingle();

        if (error) throw error;
        requireMutationRow(data, 'Email template not found or you do not have permission to delete it.');
    },

    /**
     * Fill template placeholders with lead data
     * Supported placeholders:
     * - [BUSINESS_NAME]
     * - [MANAGER_NAME]
     * - [PHONE]
     * - [EMAIL]
     * - [CITY]
     * - [STATE]
     * - [WEBSITE]
     */
    fillTemplate(templateText, lead) {
        if (!templateText || !lead) return templateText;

        return templateText
            .replace(/\[BUSINESS_NAME\]/g, lead.business_name || '[Business Name]')
            .replace(/\[MANAGER_NAME\]/g, lead.manager_name || '[Manager Name]')
            .replace(/\[PHONE\]/g, lead.phone || lead.phone_formatted || '[Phone]')
            .replace(/\[EMAIL\]/g, lead.email || '[Email]')
            .replace(/\[CITY\]/g, lead.city || '[City]')
            .replace(/\[STATE\]/g, lead.state || '[State]')
            .replace(/\[WEBSITE\]/g, lead.website || '[Website]');
    },

    /**
     * Open email client with pre-filled content
     * Uses mailto: URL to open default email client (Gmail, Outlook, etc.)
     */
    openEmailClient({ to, subject, body }) {
        // Encode email components for mailto: URL
        const mailtoUrl = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;

        // Open in new window/tab
        window.open(mailtoUrl, '_blank');
    },

    /**
     * Send email using template
     * Fills template with lead data and opens email client
     */
    async sendWithTemplate(templateId, lead) {
        const template = await this.getTemplate(templateId);

        const filledSubject = this.fillTemplate(template.subject, lead);
        const filledBody = this.fillTemplate(template.body, lead);

        this.openEmailClient({
            to: lead.email || lead.manager_email || '',
            subject: filledSubject,
            body: filledBody
        });

        return {
            template: template.name,
            subject: filledSubject,
            body: filledBody
        };
    }
};
