// Simple input sanitization to prevent XSS attacks
// Escapes HTML characters and trims whitespace

export const sanitize = {
    // Sanitize a single text input
    text(input) {
        if (typeof input !== 'string') return input;
        return input
            .trim()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    // Sanitize an object's text fields
    object(obj, fields) {
        const sanitized = { ...obj };
        fields.forEach(field => {
            if (sanitized[field] && typeof sanitized[field] === 'string') {
                sanitized[field] = this.text(sanitized[field]);
            }
        });
        return sanitized;
    },

    // Sanitize all string values in an object (recursive)
    deep(obj) {
        if (typeof obj === 'string') return this.text(obj);
        if (Array.isArray(obj)) return obj.map(item => this.deep(item));
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.deep(value);
            }
            return sanitized;
        }
        return obj;
    }
};
