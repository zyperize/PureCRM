import { getSupabaseClient } from './supabase'

export const authService = {
    async getSession() {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        return data.session
    },

    onAuthStateChange(callback) {
        const supabase = getSupabaseClient()
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            callback(session)
        })
        return () => data.subscription.unsubscribe()
    },

    async signIn({ email, password }) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        return data.session
    },

    async signUp({ email, password }) {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        return data
    },

    async signOut() {
        const supabase = getSupabaseClient()
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }
}
