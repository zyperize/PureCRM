import posthog from 'posthog-js'

// Product analytics via PostHog. Fully optional: if VITE_POSTHOG_KEY is unset,
// every function here is a no-op, so the app runs the same with or without it.
const key = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com'
let enabled = false

export function initAnalytics() {
    if (enabled || !key) return
    posthog.init(key, {
        api_host: host,
        capture_pageview: false, // we capture SPA pageviews manually on route change
        autocapture: true,
    })
    enabled = true
}

export function trackPageview(path) {
    if (!enabled) return
    posthog.capture('$pageview', { $current_url: window.location.href, path })
}

export function track(event, props = {}) {
    if (!enabled) return
    posthog.capture(event, props)
}
