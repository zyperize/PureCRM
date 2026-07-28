import { createClient } from '@supabase/supabase-js'
import { localClient } from './localClient'
import {
  getWorkspaceConfig,
  isLocalWorkspace,
  validateSupabaseClientConfig,
} from './workspaceConfig'

const workspaceConfig = getWorkspaceConfig()
const connection = validateSupabaseClientConfig(
  workspaceConfig.supabaseUrl,
  workspaceConfig.supabaseKey
)

export const isConfigValid = isLocalWorkspace(workspaceConfig) || connection.valid

if (!isConfigValid && !isLocalWorkspace(workspaceConfig)) {
  console.warn('Supabase public client configuration is missing or invalid.')
}

export const supabase = !isLocalWorkspace(workspaceConfig) && connection.valid
  ? createClient(connection.url, connection.key)
  : null

export function getSupabaseClient() {
  if (isLocalWorkspace()) return localClient

  if (!supabase) {
    throw new Error('Team sync is not connected. Open Workspace Setup to add the Supabase Project URL and publishable key.')
  }

  return supabase
}
