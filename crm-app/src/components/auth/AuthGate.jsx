import { useEffect, useState } from 'react'
import { Loader2, LockKeyhole, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { authService } from '../../services/authService'
import { getWorkspaceConfig, isLocalWorkspace } from '../../services/workspaceConfig'

const SESSION_LOAD_TIMEOUT_MS = 4000

function getSessionWithTimeout() {
    return Promise.race([
        authService.getSession(),
        new Promise((resolve) => {
            window.setTimeout(() => resolve(null), SESSION_LOAD_TIMEOUT_MS)
        })
    ])
}

function LoginScreen({ onSignedIn }) {
    const workspace = getWorkspaceConfig()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mode, setMode] = useState('sign-in')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        setIsSubmitting(true)

        try {
            if (mode === 'create') {
                const result = await authService.signUp({ email: email.trim(), password })
                if (result.session) {
                    onSignedIn(result.session)
                    toast.success('Account created')
                } else {
                    setMode('sign-in')
                    toast.success('Account created. Confirm your email, then sign in.')
                }
            } else {
                const session = await authService.signIn({ email: email.trim(), password })
                onSignedIn(session)
                toast.success('Signed in')
            }
        } catch (error) {
            toast.error(error.message || `Could not ${mode === 'create' ? 'create the account' : 'sign in'}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4 text-gray-300 font-sans">
            <form onSubmit={handleSubmit} className="w-full max-w-md border border-white/10 bg-charcoal-800 rounded-lg p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-md bg-gold-400 text-charcoal-950 flex items-center justify-center font-black">
                        {workspace.businessName[0]?.toUpperCase() || 'C'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{workspace.businessName} CRM</h1>
                        <p className="text-sm text-gray-500">
                            {mode === 'create' ? 'Create the first workspace account.' : 'Sign in to your workspace.'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block">
                        <span className="label-text">Email</span>
                        <div className="relative">
                            <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete="email"
                                required
                                className="input-field pl-10"
                                placeholder="you@company.com"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="label-text">Password</span>
                        <div className="relative">
                            <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                                minLength={8}
                                required
                                className="input-field pl-10"
                                placeholder="Your Supabase user password"
                            />
                        </div>
                    </label>

                    <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />}
                        {mode === 'create' ? 'Create Account' : 'Sign In'}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => setMode((current) => current === 'create' ? 'sign-in' : 'create')}
                    className="mt-5 w-full text-center text-sm font-medium text-gold-300 hover:text-gold-200"
                >
                    {mode === 'create' ? 'Already have an account? Sign in' : 'First time here? Create an account'}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-gray-500">
                    Accounts are managed by your Supabase project. Use at least 8 characters.
                </p>
            </form>
        </div>
    )
}

export default function AuthGate({ children }) {
    const localWorkspace = isLocalWorkspace()
    const [session, setSession] = useState(null)
    const [isLoading, setIsLoading] = useState(!localWorkspace)

    useEffect(() => {
        if (localWorkspace) return undefined

        let mounted = true

        getSessionWithTimeout()
            .then((currentSession) => {
                if (mounted) setSession(currentSession)
            })
            .catch((error) => {
                toast.error(error.message || 'Could not load session')
            })
            .finally(() => {
                if (mounted) setIsLoading(false)
            })

        const unsubscribe = authService.onAuthStateChange((nextSession) => {
            setSession(nextSession)
            setIsLoading(false)
        })

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [localWorkspace])

    if (localWorkspace) return children

    if (isLoading) {
        return (
            <div className="min-h-screen bg-charcoal-950 flex items-center justify-center text-gold-300">
                <Loader2 size={30} className="animate-spin" />
            </div>
        )
    }

    if (!session) {
        return <LoginScreen onSignedIn={setSession} />
    }

    return children
}
