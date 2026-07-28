import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, FileSpreadsheet, HardDrive, Loader2, Palette } from 'lucide-react'
import { getWorkspaceConfig, saveWorkspaceConfig } from '../../services/workspaceConfig'
import { applyWorkspaceTheme } from '../../services/themeService'

const ACCENTS = [
  { id: 'gold', label: 'Gold', color: '#d4af37' },
  { id: 'blue', label: 'Blue', color: '#3b82f6' },
  { id: 'emerald', label: 'Green', color: '#10b981' },
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
]

export default function SetupWizard() {
  const [existing] = useState(() => getWorkspaceConfig())
  const [form, setForm] = useState({ ...existing, storageMode: 'local' })
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const { appearance, accent } = form

  useEffect(() => {
    applyWorkspaceTheme({ appearance, accent })
  }, [appearance, accent])

  useEffect(() => () => applyWorkspaceTheme(existing), [existing])

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      saveWorkspaceConfig({ ...form, storageMode: 'local' })
      if ('__TAURI_INTERNALS__' in window) {
        window.location.hash = '/upload-data'
        window.location.reload()
      } else {
        window.location.assign('/upload-data')
      }
    } catch (saveError) {
      setError(saveError.message)
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-charcoal-950 px-4 py-10 text-gray-300">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-300">Two-minute setup</p>
          <h1 className="mt-2 text-4xl font-bold text-white">Make PureCRM yours</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-400">
            No account, database, or coding required. Name your workspace, choose a look, and import your leads.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-xl border border-white/10 bg-charcoal-900 p-6">
            <h2 className="text-lg font-semibold">How it works</h2>
            <div className="mt-5 space-y-5">
              <div className="flex gap-3">
                <span className="setup-icon"><HardDrive size={18} /></span>
                <div>
                  <p className="font-semibold text-white">Works on this device</p>
                  <p className="mt-1 text-sm text-gray-500">Your CRM saves automatically in this browser or desktop app.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="setup-icon"><FileSpreadsheet size={18} /></span>
                <div>
                  <p className="font-semibold text-white">Bring any lead sheet</p>
                  <p className="mt-1 text-sm text-gray-500">Import Excel or CSV. Only a name, email, or phone is needed.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="setup-icon"><CheckCircle2 size={18} /></span>
                <div>
                  <p className="font-semibold text-white">Cloud sync is optional</p>
                  <p className="mt-1 text-sm text-gray-500">Connect a team database later in Settings only if shared access is needed.</p>
                </div>
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-charcoal-900 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label-text">Business or workspace name</span>
                <div className="relative">
                  <Building2 size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={form.businessName}
                    onChange={(event) => update('businessName', event.target.value)}
                    className="input-field pl-10"
                    placeholder="Acme Services"
                    autoFocus
                    required
                  />
                </div>
              </label>

              <label>
                <span className="label-text">Owner or team <span className="text-gray-600">(optional)</span></span>
                <input
                  value={form.ownerName}
                  onChange={(event) => update('ownerName', event.target.value)}
                  className="input-field"
                  placeholder="Sales team"
                />
              </label>

              <label>
                <span className="label-text">Industry <span className="text-gray-600">(optional)</span></span>
                <input
                  value={form.industry}
                  onChange={(event) => update('industry', event.target.value)}
                  className="input-field"
                  placeholder="Professional services"
                />
              </label>

              <fieldset className="sm:col-span-2">
                <legend className="label-text flex items-center gap-2"><Palette size={15} /> Appearance</legend>
                <div className="grid grid-cols-3 gap-2">
                  {['system', 'light', 'dark'].map((appearance) => (
                    <button
                      key={appearance}
                      type="button"
                      onClick={() => update('appearance', appearance)}
                      aria-pressed={form.appearance === appearance}
                      className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                        form.appearance === appearance
                          ? 'selection-accent'
                          : 'border-white/10 text-gray-400 hover:border-white/25'
                      }`}
                    >
                      {appearance}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="sm:col-span-2">
                <legend className="label-text">Accent color</legend>
                <div className="flex flex-wrap gap-3">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      onClick={() => update('accent', accent.id)}
                      aria-label={accent.label}
                      aria-pressed={form.accent === accent.id}
                      className={`h-10 w-10 rounded-full border-2 transition ${
                        form.accent === accent.id ? 'scale-110 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: accent.color }}
                      title={accent.label}
                    />
                  ))}
                </div>
              </fieldset>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSaving} className="btn-primary mt-6 w-full disabled:opacity-50">
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Create PureCRM
            </button>

            <p className="mt-4 text-center text-xs text-gray-600">
              Nothing is uploaded anywhere in local mode. You can export a backup at any time.
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
