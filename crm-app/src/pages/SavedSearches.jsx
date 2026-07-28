import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { savedSearchesService } from '../services/savedSearchesService'
import { AlertCircle, Plus, Search, Trash2, Play, X, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SavedSearches() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ search_name: '', category: '', state: '', city: '', lead_stage: '', min_rating: '', max_rating: '' })

  const { data: searches, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['savedSearches'],
    queryFn: () => savedSearchesService.getSavedSearches()
  })

  const parseRatingInput = (value) => {
    if (value === '') return null
    const rating = Number(value)
    return Number.isFinite(rating) ? rating : null
  }

  const createMutation = useMutation({
    mutationFn: (searchData) => savedSearchesService.createSavedSearch(searchData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] })
      resetForm()
      toast.success('Search saved')
    },
    onError: (error) => toast.error(error.message || 'Could not save search')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => savedSearchesService.deleteSavedSearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] })
      toast.success('Search deleted')
    },
    onError: (error) => toast.error(error.message || 'Could not delete search')
  })

  const handleSave = () => {
    if (!formData.search_name.trim()) { toast.error('Search name is required'); return }
    const minRating = parseRatingInput(formData.min_rating)
    const maxRating = parseRatingInput(formData.max_rating)

    if (formData.min_rating && minRating === null) { toast.error('Minimum rating must be a number'); return }
    if (formData.max_rating && maxRating === null) { toast.error('Maximum rating must be a number'); return }
    if ((minRating !== null && (minRating < 0 || minRating > 5)) || (maxRating !== null && (maxRating < 0 || maxRating > 5))) {
      toast.error('Ratings must be between 0 and 5')
      return
    }
    if (minRating !== null && maxRating !== null && minRating > maxRating) {
      toast.error('Minimum rating cannot be higher than maximum rating')
      return
    }

    const filters = {}
    if (formData.category) filters.category = formData.category
    if (formData.state) filters.state = formData.state
    if (formData.city) filters.city = formData.city
    if (formData.lead_stage) filters.lead_stage = formData.lead_stage
    if (minRating !== null) filters.min_rating = minRating
    if (maxRating !== null) filters.max_rating = maxRating
    if (Object.keys(filters).length === 0) { toast.error('At least one filter is required'); return }
    createMutation.mutate({ search_name: formData.search_name, search_filters: filters })
  }

  const handleRunSearch = (search) => {
    const f = search.search_filters
    const params = new URLSearchParams()

    if (f.category) params.append('category', f.category)
    if (f.state) params.append('state', f.state)
    if (f.city) params.append('city', f.city)
    if (f.lead_stage) params.append('stage', f.lead_stage)
    if (f.min_rating !== undefined && f.min_rating !== null) params.append('min_rating', f.min_rating)
    if (f.max_rating !== undefined && f.max_rating !== null) params.append('max_rating', f.max_rating)

    navigate(`/leads?${params.toString()}`)
    toast.success(`Running "${search.search_name}"`)
  }

  const resetForm = () => { setCreating(false); setFormData({ search_name: '', category: '', state: '', city: '', lead_stage: '', min_rating: '', max_rating: '' }) }

  const getFilterSummary = (filters) => {
    if (!filters) return ''
    const parts = []
    if (filters.category) parts.push(`Category: ${filters.category.replace('_', ' ')}`)
    if (filters.state) parts.push(`State: ${filters.state}`)
    if (filters.city) parts.push(`City: ${filters.city}`)
    if (filters.lead_stage) parts.push(`Stage: ${filters.lead_stage}`)
    if (filters.min_rating || filters.max_rating) parts.push(`Rating: ${filters.min_rating || '0'} - ${filters.max_rating || '5'}`)
    return parts.join(' • ')
  }

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold text-white">Saved Searches</h1>
          <p className="text-gray-400 mt-1">Save and quickly run your favorite lead search combinations</p>
        </div>
        <div className="rounded border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-100">Saved searches did not load</h2>
              <p className="mt-1 text-sm text-red-200/80">{error.message || 'Check Supabase access, RLS, or network connectivity.'}</p>
            </div>
            <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary text-sm disabled:opacity-50">
              {isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Saved Searches</h1>
          <p className="text-gray-400 mt-1">Save and quickly run your favorite lead search combinations</p>
        </div>
        {!creating && <button onClick={() => setCreating(true)} className="btn-primary"><Plus size={18} /> New Search</button>}
      </div>

      {creating && (
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">New Saved Search</h3>
            <button onClick={resetForm} className="p-1.5 hover:bg-white/10 rounded text-gray-400"><X size={18} /></button>
          </div>
          <div>
            <label className="label-text">Search Name *</label>
            <input type="text" className="input-field" value={formData.search_name} onChange={(e) => setFormData({ ...formData, search_name: e.target.value })} placeholder="e.g., Priority West Coast Leads" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Category</label>
              <select className="input-field" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                <option value="">All Categories</option>
                <option value="prospect">Prospects</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="partner">Partners</option>
                <option value="referral">Referrals</option>
                <option value="event">Events</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label-text">Lead Stage</label>
              <select className="input-field" value={formData.lead_stage} onChange={(e) => setFormData({ ...formData, lead_stage: e.target.value })}>
                <option value="">All Stages</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="samples_sent">Samples Sent</option>
                <option value="qualified">Qualified</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">State</label>
              <input type="text" className="input-field" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })} placeholder="e.g., CO" maxLength={2} />
            </div>
            <div>
              <label className="label-text">City</label>
              <input type="text" className="input-field" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="e.g., Denver" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Minimum Rating</label>
              <input type="number" min="0" max="5" step="0.1" className="input-field" value={formData.min_rating} onChange={(e) => setFormData({ ...formData, min_rating: e.target.value })} placeholder="e.g., 4.2" />
            </div>
            <div>
              <label className="label-text">Maximum Rating</label>
              <input type="number" min="0" max="5" step="0.1" className="input-field" value={formData.max_rating} onChange={(e) => setFormData({ ...formData, max_rating: e.target.value })} placeholder="e.g., 5" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createMutation.isPending} className="btn-primary"><Plus size={18} /> Save Search</button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {searches && searches.length > 0 ? (
        <div className="space-y-4">
          {searches.map((search) => (
            <div key={search.id} className="card group hover:border-gold-500/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <Search className="w-5 h-5 text-gold-400" /> {search.search_name}
                  </h3>
                  <p className="text-sm text-gray-400">{getFilterSummary(search.search_filters)}</p>
                  <p className="text-xs text-gray-500 mt-2">Created {new Date(search.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRunSearch(search)} className="btn-primary text-sm py-1.5 px-3"><Play size={14} /> Run</button>
                  <button onClick={() => { if (window.confirm('Delete this search?')) deleteMutation.mutate(search.id) }} className="p-2 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !creating && (
        <div className="card p-12 text-center">
          <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No saved searches yet</p>
          <button onClick={() => setCreating(true)} className="btn-primary">Create Your First Search</button>
        </div>
      )}
    </div>
  )
}
