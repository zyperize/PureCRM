import { useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Cloud,
  Download,
  HardDrive,
  Palette,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  clearWorkspaceConfig,
  getWorkspaceConfig,
  saveWorkspaceConfig,
} from '../services/workspaceConfig'
import {
  clearLocalDatabase,
  exportLocalDatabase,
  importLocalDatabase,
} from '../services/localClient'
import { accentOptions, applyWorkspaceTheme } from '../services/themeService'

export default function WorkspaceSettings() {
  const [form, setForm] = useState(() => getWorkspaceConfig())
  const restoreInput = useRef(null)
  const update = (field, value) => {
    const next = { ...form, [field]: value }
    setForm(next)
    if (field === 'appearance' || field === 'accent') applyWorkspaceTheme(next)
  }

  const handleSave = (event) => {
    event.preventDefault()
    try {
      saveWorkspaceConfig(form)
      toast.success('Workspace updated')
      window.setTimeout(() => window.location.reload(), 350)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleBackup = async () => {
    try {
      const backup = await exportLocalDatabase()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `purecrm-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(href)
      toast.success('Backup downloaded')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleRestore = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!window.confirm('Replace all local CRM records with this backup?')) {
      event.target.value = ''
      return
    }
    try {
      await importLocalDatabase(JSON.parse(await file.text()))
      toast.success('Backup restored')
      window.setTimeout(() => window.location.assign('/'), 400)
    } catch (error) {
      toast.error(error.message)
    } finally {
      event.target.value = ''
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Delete every local CRM record and reset setup on this device? This cannot be undone without a backup.')) return
    await clearLocalDatabase()
    clearWorkspaceConfig()
    window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE')
    window.location.assign('/')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft size={16} /> Settings
      </Link>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="card space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Workspace</h1>
            <p className="mt-1 text-sm text-gray-400">Brand the CRM for this business. Only the workspace name is required.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label-text">Business or workspace name</span>
              <input className="input-field" value={form.businessName} onChange={(event) => update('businessName', event.target.value)} required />
            </label>
            <label>
              <span className="label-text">Owner or team <span className="text-gray-600">(optional)</span></span>
              <input className="input-field" value={form.ownerName} onChange={(event) => update('ownerName', event.target.value)} />
            </label>
            <label>
              <span className="label-text">Industry <span className="text-gray-600">(optional)</span></span>
              <input className="input-field" value={form.industry} onChange={(event) => update('industry', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="card space-y-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Palette size={19} /> Appearance</h2>
            <p className="mt-1 text-sm text-gray-400">Changes preview immediately and apply throughout the app.</p>
          </div>
          <div>
            <span className="label-text">Brightness</span>
            <div className="grid grid-cols-3 gap-2">
              {['system', 'light', 'dark'].map((appearance) => (
                <button
                  key={appearance}
                  type="button"
                  onClick={() => update('appearance', appearance)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                    form.appearance === appearance
                      ? 'border-gold-400 bg-gold-400/10 text-gold-300'
                      : 'border-white/10 text-gray-400'
                  }`}
                >
                  {appearance}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label-text">Accent color</span>
            <div className="flex flex-wrap gap-3">
              {accentOptions.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  onClick={() => update('accent', accent.id)}
                  aria-label={accent.label}
                  aria-pressed={form.accent === accent.id}
                  title={accent.label}
                  className={`h-11 w-11 rounded-full border-2 ${
                    form.accent === accent.id ? 'scale-110 border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: accent.color }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {form.storageMode === 'supabase' ? <Cloud size={19} /> : <HardDrive size={19} />}
              Data storage
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Local mode needs no account. Team sync is optional for sharing one database across devices.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => update('storageMode', 'local')}
              className={`rounded-xl border p-4 text-left ${form.storageMode !== 'supabase' ? 'border-gold-400 bg-gold-400/10' : 'border-white/10'}`}
            >
              <HardDrive size={21} />
              <strong className="mt-2 block">Local on this device</strong>
              <span className="mt-1 block text-xs text-gray-400">No login, server, or monthly service.</span>
            </button>
            <button
              type="button"
              onClick={() => update('storageMode', 'supabase')}
              className={`rounded-xl border p-4 text-left ${form.storageMode === 'supabase' ? 'border-gold-400 bg-gold-400/10' : 'border-white/10'}`}
            >
              <Cloud size={21} />
              <strong className="mt-2 block">Team sync</strong>
              <span className="mt-1 block text-xs text-gray-400">Optional Supabase connection for multiple users.</span>
            </button>
          </div>

          {form.storageMode === 'supabase' && (
            <div className="grid gap-4 rounded-xl border border-white/10 p-4">
              <p className="text-sm text-gray-400">
                Switching storage does not copy local records automatically. Export a backup first.
              </p>
              <label>
                <span className="label-text">Supabase Project URL</span>
                <input className="input-field" value={form.supabaseUrl} onChange={(event) => update('supabaseUrl', event.target.value)} required />
              </label>
              <label>
                <span className="label-text">Publishable key</span>
                <textarea className="input-field min-h-24 font-mono text-xs" value={form.supabaseKey} onChange={(event) => update('supabaseKey', event.target.value)} required />
              </label>
            </div>
          )}
        </section>

        <button type="submit" className="btn-primary"><Save size={17} /> Save workspace</button>
      </form>

      <section className="card">
        <h2 className="text-lg font-semibold">Local backup</h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Local records stay on this device. Download a backup regularly or before clearing browser data.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={handleBackup} className="btn-secondary"><Download size={16} /> Download backup</button>
          <button type="button" onClick={() => restoreInput.current?.click()} className="btn-secondary"><Upload size={16} /> Restore backup</button>
          <input ref={restoreInput} type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
        </div>
      </section>

      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-red-200">
          <RotateCcw size={18} /> Reset this device
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Deletes all local CRM records and setup from this device. Download a backup first if the data matters.
        </p>
        <button type="button" onClick={handleReset} className="btn-danger mt-4">
          <RotateCcw size={16} /> Delete local data and start over
        </button>
      </section>
    </div>
  )
}
