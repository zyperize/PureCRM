const STORAGE_KEY = 'cleancrm.workspace.v1'

const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || ''

const DEFAULT_CONFIG = {
  businessName: '',
  ownerName: '',
  industry: '',
  storageMode: 'local',
  supabaseUrl: envUrl,
  supabaseKey: envKey,
  appearance: 'system',
  accent: 'gold',
}

function storageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readStoredConfig() {
  if (!storageAvailable()) return {}

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function getWorkspaceConfig() {
  const stored = readStoredConfig()
  const legacyStorageMode = !stored.storageMode && stored.supabaseUrl && stored.supabaseKey
    ? 'supabase'
    : undefined
  return { ...DEFAULT_CONFIG, ...stored, ...(legacyStorageMode ? { storageMode: legacyStorageMode } : {}) }
}

function decodeJwtPayload(key) {
  try {
    const payload = key.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(normalized))
  } catch {
    return null
  }
}

export function validateSupabaseClientConfig(url, key) {
  const cleanUrl = url.trim().replace(/\/+$/, '')
  const cleanKey = key.trim()

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)
    && !/^https?:\/\/localhost(?::\d+)?$/i.test(cleanUrl)) {
    return { valid: false, message: 'Enter the Project URL from Supabase → Connect.' }
  }

  if (!cleanKey) {
    return { valid: false, message: 'Enter a Supabase publishable key.' }
  }

  if (cleanKey.startsWith('sb_secret_') || decodeJwtPayload(cleanKey)?.role === 'service_role') {
    return {
      valid: false,
      message: 'That is a secret/service-role key. Use the publishable or legacy anon key instead.',
    }
  }

  return { valid: true, url: cleanUrl, key: cleanKey }
}

export function isWorkspaceConfigured(config = getWorkspaceConfig()) {
  if (!config.businessName?.trim()) return false
  if (config.storageMode !== 'supabase') return true
  return validateSupabaseClientConfig(config.supabaseUrl, config.supabaseKey).valid
}

export function saveWorkspaceConfig(nextConfig) {
  if (!storageAvailable()) throw new Error('Browser storage is unavailable.')

  const storageMode = nextConfig.storageMode === 'supabase' ? 'supabase' : 'local'
  const connection = storageMode === 'supabase'
    ? validateSupabaseClientConfig(nextConfig.supabaseUrl, nextConfig.supabaseKey)
    : { valid: true, url: '', key: '' }
  if (!connection.valid) throw new Error(connection.message)

  const config = {
    businessName: nextConfig.businessName.trim(),
    ownerName: nextConfig.ownerName?.trim() || '',
    industry: nextConfig.industry?.trim() || '',
    storageMode,
    supabaseUrl: storageMode === 'supabase'
      ? connection.url
      : nextConfig.supabaseUrl?.trim().replace(/\/+$/, '') || '',
    supabaseKey: storageMode === 'supabase'
      ? connection.key
      : nextConfig.supabaseKey?.trim() || '',
    appearance: ['light', 'dark', 'system'].includes(nextConfig.appearance)
      ? nextConfig.appearance
      : 'system',
    accent: ['gold', 'blue', 'emerald', 'violet', 'rose'].includes(nextConfig.accent)
      ? nextConfig.accent
      : 'gold',
  }

  if (!config.businessName) {
    throw new Error('Business name is required.')
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  return config
}

export function clearWorkspaceConfig() {
  if (!storageAvailable()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export const workspaceStorageKey = STORAGE_KEY

export function isLocalWorkspace(config = getWorkspaceConfig()) {
  return config.storageMode !== 'supabase'
}
