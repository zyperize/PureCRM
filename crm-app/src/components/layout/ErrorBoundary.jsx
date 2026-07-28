import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Page error caught by ErrorBoundary:', error, errorInfo);
    }

    render() {
        const { error } = this.state;

        if (!error) {
            return this.props.children;
        }

        return (
            <div className="min-h-[50vh] bg-charcoal-950 flex items-center justify-center p-6">
                <div className="w-full max-w-xl bg-charcoal-800 border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500" />

                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-400/10 text-amber-400 mb-5">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-white">Something went wrong on this screen</h1>
                    <p className="mt-2 text-sm text-gray-400">Try reloading the page or return to the dashboard.</p>

                    <pre className="mt-5 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-black/30 p-4 font-mono text-sm text-amber-300">
                        {error.message || String(error)}
                    </pre>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-amber-300"
                        >
                            Reload
                        </button>
                        <button
                            type="button"
                            onClick={() => { window.location.href = '/'; }}
                            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10"
                        >
                            Back to dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
