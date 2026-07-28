import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scriptsService } from '../services/scriptsService'
import { Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const SCRIPT_TYPES = [
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'manager_script', label: 'Manager Script' },
  { value: 'pricing_info', label: 'Pricing Info' },
  { value: 'follow_up', label: 'Follow Up' }
]

function invalidateScriptQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['callingScripts'] })
  queryClient.invalidateQueries({ queryKey: ['calling-scripts'] })
  queryClient.invalidateQueries({ queryKey: ['scripts'] })
}

export default function CallingScripts() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ script_name: '', script_type: 'cold_call', script_content: '' })

  const { data: scripts, isLoading } = useQuery({
    queryKey: ['callingScripts'],
    queryFn: () => scriptsService.getScripts()
  })

  const createMutation = useMutation({
    mutationFn: (scriptData) => scriptsService.createScript(
      scriptData.script_name,
      scriptData.script_type,
      scriptData.script_content
    ),
    onSuccess: () => {
      invalidateScriptQueries(queryClient)
      resetForm()
      toast.success('Script created')
    },
    onError: (error) => toast.error(error.message || 'Could not create script')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => scriptsService.updateScript(id, updates),
    onSuccess: () => {
      invalidateScriptQueries(queryClient)
      setEditing(null)
      setCreating(false)
      toast.success('Script updated')
    },
    onError: (error) => toast.error(error.message || 'Could not update script')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => scriptsService.deleteScript(id),
    onSuccess: () => {
      invalidateScriptQueries(queryClient)
      toast.success('Script deleted')
    },
    onError: (error) => toast.error(error.message || 'Could not delete script')
  })

  const handleSave = () => {
    if (!formData.script_name.trim() || !formData.script_content.trim()) { toast.error('Name and content are required'); return }
    if (editing) { updateMutation.mutate({ id: editing.id, updates: formData }) }
    else { createMutation.mutate(formData) }
  }

  const handleEdit = (script) => {
    setEditing(script); setCreating(true)
    setFormData({ script_name: script.script_name, script_type: script.script_type, script_content: script.script_content })
  }

  const resetForm = () => { setEditing(null); setCreating(false); setFormData({ script_name: '', script_type: 'cold_call', script_content: '' }) }

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Calling Scripts</h1>
          <p className="text-gray-400 mt-1">Manage scripts with placeholders like [BUSINESS_NAME], [MANAGER_NAME], [YOUR_NAME]</p>
        </div>
        {!creating && <button onClick={() => setCreating(true)} className="btn-primary"><Plus size={18} /> New Script</button>}
      </div>

      {/* Create/Edit Form */}
      {creating && (
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">{editing ? 'Edit Script' : 'New Script'}</h3>
            <button onClick={resetForm} className="p-1.5 hover:bg-white/10 rounded text-gray-400"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Script Name *</label>
              <input type="text" className="input-field" value={formData.script_name} onChange={(e) => setFormData({ ...formData, script_name: e.target.value })} placeholder="e.g., Cold Call Script" />
            </div>
            <div>
              <label className="label-text">Script Type</label>
              <select className="input-field" value={formData.script_type} onChange={(e) => setFormData({ ...formData, script_type: e.target.value })}>
                {SCRIPT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-text">Script Content *</label>
            <textarea className="input-field font-mono text-sm" value={formData.script_content} onChange={(e) => setFormData({ ...formData, script_content: e.target.value })} rows={12} placeholder="Hello, this is [YOUR_NAME] calling from [COMPANY]..." />
          </div>
          <p className="text-xs text-gray-500">Placeholders: [YOUR_NAME] [BUSINESS_NAME] [MANAGER_NAME] [CITY] [STATE] [PHONE]</p>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary"><Save size={18} /> {editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="btn-secondary"><X size={18} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Scripts List */}
      {scripts && scripts.length > 0 ? (
        <div className="space-y-4">
          {scripts.map((script) => (
            <div key={script.id} className="card group hover:border-gold-500/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{script.script_name}</h3>
                  <span className="text-xs text-gray-500 uppercase tracking-wide bg-charcoal-900 px-2 py-0.5 rounded border border-white/5">
                    {SCRIPT_TYPES.find(t => t.value === script.script_type)?.label}
                  </span>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(script)} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white"><Edit2 size={16} /></button>
                  <button onClick={() => { if (window.confirm('Delete this script?')) deleteMutation.mutate(script.id) }} className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="bg-charcoal-900/50 p-4 rounded border border-white/5">
                <pre className="whitespace-pre-wrap text-sm text-gray-400 font-mono">
                  {script.script_content.substring(0, 300)}{script.script_content.length > 300 && '...'}
                </pre>
              </div>
            </div>
          ))}
        </div>
      ) : !creating && (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-4">No scripts created yet</p>
          <button onClick={() => setCreating(true)} className="btn-primary">Create Your First Script</button>
        </div>
      )}
    </div>
  )
}
