import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { tasksService } from '../services/tasksService'
import { Calendar, CheckCircle, Clock, AlertCircle, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, isPast, isToday, parseISO } from 'date-fns'

export default function FollowUpTasks() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rescheduleDraft, setRescheduleDraft] = useState({ task: null, date: '' })
  const filterParam = searchParams.get('filter')
  const filter = ['all', 'pending', 'overdue', 'today', 'upcoming'].includes(filterParam) ? filterParam : 'all'
  const search = searchParams.get('search') || ''

  const { data: tasks, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['followUpTasks'],
    queryFn: () => tasksService.getFollowUpTasks()
  })

  const refreshTaskSurfaces = () => {
    queryClient.invalidateQueries({ queryKey: ['followUpTasks'] })
    queryClient.invalidateQueries({ queryKey: ['allTasks'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-command-center'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-priority-worklist'] })
  }

  const completeTaskMutation = useMutation({
    mutationFn: (taskId) => tasksService.completeTask(taskId),
    onSuccess: () => {
      refreshTaskSurfaces()
      toast.success('Task completed')
    },
    onError: (error) => toast.error(error.message || 'Could not complete task')
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({ taskId, newDate }) => tasksService.rescheduleTask(taskId, newDate),
    onSuccess: () => {
      refreshTaskSurfaces()
      setRescheduleDraft({ task: null, date: '' })
      toast.success('Task rescheduled')
    },
    onError: (error) => toast.error(error.message || 'Could not reschedule task')
  })

  const handleReschedule = (task) => {
    setRescheduleDraft({ task, date: task.due_date || '' })
  }

  const handleRescheduleSubmit = (event) => {
    event.preventDefault()
    if (!rescheduleDraft.task || !rescheduleDraft.date) {
      toast.error('Choose a new due date')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rescheduleDraft.date)) {
      toast.error('Use YYYY-MM-DD format')
      return
    }
    rescheduleMutation.mutate({
      taskId: rescheduleDraft.task.id,
      newDate: rescheduleDraft.date
    })
  }

  const updateFilter = (nextFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextFilter === 'all') nextParams.delete('filter')
    else nextParams.set('filter', nextFilter)
    setSearchParams(nextParams, { replace: true })
  }

  const updateSearch = (nextSearch) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextSearch.trim()) nextParams.set('search', nextSearch)
    else nextParams.delete('search')
    setSearchParams(nextParams, { replace: true })
  }

  const clearFilters = () => {
    setSearchParams({}, { replace: true })
  }

  const getTaskStatus = (dueDate) => {
    const date = parseISO(dueDate)
    if (isPast(date) && !isToday(date)) return 'overdue'
    if (isToday(date)) return 'today'
    return 'upcoming'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'overdue': return 'bg-red-500/10 border-red-500/30 text-red-400'
      case 'today': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      case 'upcoming': return 'bg-green-500/10 border-green-500/30 text-green-400'
      default: return 'bg-charcoal-800 border-white/10 text-gray-400'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'overdue': return <AlertCircle className="w-5 h-5" />
      case 'today': return <Clock className="w-5 h-5" />
      default: return <Calendar className="w-5 h-5" />
    }
  }

  const matchesSearch = (task) => {
    if (!search.trim()) return true
    const needle = search.trim().toLowerCase()
    return [
      task.task_name,
      task.task_description,
      task.lead?.business_name,
      task.lead?.city,
      task.lead?.state
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
  }

  const filteredTasks = tasks?.filter(task => {
    if (!matchesSearch(task)) return false
    if (filter === 'all' || filter === 'pending') return true
    return getTaskStatus(task.due_date) === filter
  }) || []

  const taskCounts = {
    all: tasks?.length || 0,
    pending: tasks?.length || 0,
    overdue: tasks?.filter(t => getTaskStatus(t.due_date) === 'overdue').length || 0,
    today: tasks?.filter(t => getTaskStatus(t.due_date) === 'today').length || 0,
    upcoming: tasks?.filter(t => getTaskStatus(t.due_date) === 'upcoming').length || 0
  }
  const hasActiveFilters = filter !== 'all' || Boolean(search.trim())

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold text-white">Follow-up Tasks</h1>
          <p className="text-gray-400 mt-1">Manage and track all your upcoming follow-up tasks</p>
        </div>

        <div className="rounded border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-100">Follow-up tasks did not load</h2>
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
      {rescheduleDraft.task && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form onSubmit={handleRescheduleSubmit} className="w-full max-w-md rounded-lg border border-white/10 bg-charcoal-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gold-300">Reschedule Task</p>
                <h2 className="mt-1 text-xl font-black text-white">{rescheduleDraft.task.task_name}</h2>
                {rescheduleDraft.task.lead && (
                  <p className="mt-1 text-sm text-gray-400">{rescheduleDraft.task.lead.business_name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRescheduleDraft({ task: null, date: '' })}
                disabled={rescheduleMutation.isPending}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-bold text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">New Due Date</span>
              <input
                type="date"
                value={rescheduleDraft.date}
                onChange={(event) => setRescheduleDraft((draft) => ({ ...draft, date: event.target.value }))}
                className="input-field"
                autoFocus
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRescheduleDraft({ task: null, date: '' })}
                disabled={rescheduleMutation.isPending}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rescheduleMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-black text-charcoal-950 hover:bg-gold-400 disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                Reschedule
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-white">Follow-up Tasks</h1>
        <p className="text-gray-400 mt-1">Manage and track all your upcoming follow-up tasks</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: `All (${taskCounts.all})` },
          { key: 'pending', label: `Pending (${taskCounts.pending})` },
          { key: 'overdue', label: `Overdue (${taskCounts.overdue})` },
          { key: 'today', label: `Today (${taskCounts.today})` },
          { key: 'upcoming', label: `Upcoming (${taskCounts.upcoming})` }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => updateFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
              ${filter === f.key ? 'bg-gold-500 text-charcoal-900 font-bold' : 'bg-charcoal-800 text-gray-400 hover:bg-charcoal-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-charcoal-900/60 p-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-charcoal-950 px-3 focus-within:border-gold-400/50">
          <Search size={16} className="text-gray-500" />
          <input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-gray-600"
            placeholder="Search tasks, lead names, city, or state..."
          />
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-secondary justify-center text-sm">
            <X size={16} /> Clear
          </button>
        )}
      </div>

      {/* Tasks List */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const status = getTaskStatus(task.due_date)
            return (
              <div key={task.id} className={`rounded-xl border-2 p-4 ${getStatusColor(status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(status)}
                      <h3 className="font-semibold text-lg text-white">{task.task_name}</h3>
                    </div>
                    {task.lead && (
                      <div className="mb-2">
                        <button onClick={() => navigate(`/leads/${task.lead.id}`)} className="text-sm font-medium text-gold-400 hover:underline flex items-center gap-1">
                          {task.lead.business_name} <ExternalLink className="w-3 h-3" />
                        </button>
                        {(task.lead.city || task.lead.state) && <p className="text-sm text-gray-500">{task.lead.city}, {task.lead.state}</p>}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="font-medium">Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
                      {task.task_description && <span className="opacity-75">{task.task_description}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => completeTaskMutation.mutate(task.id)} disabled={completeTaskMutation.isPending} className="btn-secondary text-sm py-1.5 px-3">
                      <CheckCircle className="w-4 h-4" /> Complete
                    </button>
                    <button onClick={() => handleReschedule(task)} disabled={rescheduleMutation.isPending} className="btn-secondary text-sm py-1.5 px-3">
                      <Calendar className="w-4 h-4" /> Reschedule
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">{hasActiveFilters ? 'No tasks match this view' : 'No follow-up tasks'}</p>
          <p className="text-sm text-gray-500">
            {hasActiveFilters ? 'Try clearing the search or switching filters.' : 'Tasks with due dates will appear here'}
          </p>
        </div>
      )}

      {/* Summary Stats */}
      {tasks && tasks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card border-l-4 border-red-500">
            <div className="flex items-center gap-2 text-red-400 mb-1"><AlertCircle className="w-4 h-4" /><span className="text-sm font-medium">Overdue</span></div>
            <p className="text-2xl font-bold text-white">{taskCounts.overdue}</p>
          </div>
          <div className="card border-l-4 border-yellow-500">
            <div className="flex items-center gap-2 text-yellow-400 mb-1"><Clock className="w-4 h-4" /><span className="text-sm font-medium">Due Today</span></div>
            <p className="text-2xl font-bold text-white">{taskCounts.today}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <div className="flex items-center gap-2 text-green-400 mb-1"><Calendar className="w-4 h-4" /><span className="text-sm font-medium">Upcoming</span></div>
            <p className="text-2xl font-bold text-white">{taskCounts.upcoming}</p>
          </div>
        </div>
      )}
    </div>
  )
}
