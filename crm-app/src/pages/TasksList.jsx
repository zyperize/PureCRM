import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar as CalendarIcon, Search, CheckCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { tasksService } from '../services/tasksService';
import { invalidateLeadWorkspace } from '../utils/queryInvalidation';
import { addDays, format, parseISO, isPast, isToday } from 'date-fns';
import toast from 'react-hot-toast';

const TASK_FILTERS = ['all', 'pending', 'next7', 'today', 'completed', 'high'];
const TASK_FILTER_LABELS = {
    all: 'All',
    pending: 'Pending',
    next7: '7d Work',
    today: 'Today',
    completed: 'Completed',
    high: 'Overdue'
};

export default function TasksList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = TASK_FILTERS.includes(searchParams.get('filter'))
        ? searchParams.get('filter')
        : 'all';
    const search = searchParams.get('search') || '';
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: tasks, isLoading, error, refetch } = useQuery({
        queryKey: ['allTasks'],
        queryFn: () => tasksService.getAllTasks()
    });

    const updateFilters = (updates) => {
        const nextParams = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                nextParams.set(key, value);
            } else {
                nextParams.delete(key);
            }
        });

        setSearchParams(nextParams, { replace: true });
    };

    const toggleMutation = useMutation({
        mutationFn: ({ taskId, completed }) => tasksService.toggleTaskComplete(taskId, completed),
        onSuccess: (task) => {
            invalidateLeadWorkspace(queryClient, task?.lead_id);
            toast.success('Task updated');
        },
        onError: (error) => toast.error(error.message || 'Could not update task')
    });

    const getPriority = (task) => {
        if (!task.due_date) return 'low';
        const date = parseISO(task.due_date);
        if (isPast(date) && !isToday(date)) return 'high';
        if (isToday(date)) return 'medium';
        return 'low';
    };

    const getDueLabel = (task) => {
        if (!task.due_date) return null;
        const date = parseISO(task.due_date);
        if (isPast(date) && !isToday(date)) return 'Overdue';
        if (isToday(date)) return 'Today';
        return format(date, 'MMM d');
    };

    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const nextSevenKey = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const isDueInWorkWindow = (task) => (
        !task.completed &&
        Boolean(task.due_date) &&
        task.due_date <= nextSevenKey
    );

    const stats = (tasks || []).reduce((acc, task) => {
        const priority = getPriority(task);
        if (!task.completed) acc.pending += 1;
        else acc.completed += 1;
        if (!task.completed && task.due_date === todayKey) acc.today += 1;
        if (!task.completed && priority === 'high') acc.overdue += 1;
        if (isDueInWorkWindow(task)) acc.next7 += 1;
        return acc;
    }, { pending: 0, next7: 0, today: 0, overdue: 0, completed: 0 });

    const filtered = (tasks || []).filter(task => {
        const taskName = task.task_name || '';
        const businessName = task.lead?.business_name || '';
        const normalizedSearch = search.toLowerCase();

        if (filter === 'pending' && task.completed) return false;
        if (filter === 'completed' && !task.completed) return false;
        if (filter === 'next7' && !isDueInWorkWindow(task)) return false;
        if (filter === 'today' && (task.completed || getDueLabel(task) !== 'Today')) return false;
        if (filter === 'high' && getPriority(task) !== 'high') return false;
        if (search && !taskName.toLowerCase().includes(normalizedSearch) &&
            !businessName.toLowerCase().includes(normalizedSearch)) return false;
        return true;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Tasks</h1>
                        <p className="text-gray-400 mt-1">Manage your to-do list and follow-ups.</p>
                    </div>
                    <Link to="/tasks/calendar" className="btn-secondary">
                        <CalendarIcon size={18} /> Calendar View
                    </Link>
                </div>

                <div className="rounded border border-red-500/30 bg-red-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
                        <div className="flex-1">
                            <h2 className="text-sm font-semibold text-red-100">Tasks did not load</h2>
                            <p className="mt-1 text-sm text-red-200/80">{error.message || 'Check Supabase access, RLS, or network connectivity.'}</p>
                        </div>
                        <button onClick={() => refetch()} className="btn-secondary text-sm">
                            <RefreshCw size={16} /> Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Tasks</h1>
                    <p className="text-gray-400 mt-1">Manage your to-do list and follow-ups.</p>
                </div>
                <Link to="/tasks/calendar" className="btn-secondary">
                    <CalendarIcon size={18} /> Calendar View
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                    { label: 'Pending', value: stats.pending },
                    { label: '7d Work', value: stats.next7 },
                    { label: 'Today', value: stats.today },
                    { label: 'Overdue', value: stats.overdue },
                    { label: 'Completed', value: stats.completed }
                ].map((item) => (
                    <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
                        <p className="mt-1 text-2xl font-bold text-white">{item.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        className="input-field pl-9 py-1.5 text-sm"
                        placeholder="Search tasks..."
                        value={search}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                    />
                </div>
                <div className="flex gap-2">
                    {TASK_FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => updateFilters({ filter: f === 'all' ? '' : f })}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors
                                ${filter === f ? 'bg-gold-500 text-charcoal-900 font-bold' : 'bg-charcoal-800 text-gray-400 hover:bg-charcoal-700'}`}
                        >
                            {TASK_FILTER_LABELS[f]}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card p-12 text-center">
                    <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No tasks found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(task => {
                        const priority = getPriority(task);
                        const dueLabel = getDueLabel(task);
                        return (
                            <div key={task.id} className="card p-4 flex items-center gap-4 hover:border-gold-500/30 transition-colors group">
                                <button
                                    onClick={() => toggleMutation.mutate({ taskId: task.id, completed: !task.completed })}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                        ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-gold-400'}`}
                                >
                                    {task.completed && <CheckCircle size={14} className="text-charcoal-900" strokeWidth={3} />}
                                </button>
                                <div className="flex-1">
                                    <h4 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                                        {task.task_name || 'Untitled task'}
                                    </h4>
                                    {task.lead && (
                                        <p className="text-sm text-gray-500">
                                            for <button onClick={() => navigate(`/leads/${task.lead.id}`)} className="text-gold-400 hover:underline">{task.lead.business_name}</button>
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-6">
                                    {dueLabel && (
                                        <div className={`flex items-center gap-2 text-sm ${dueLabel === 'Overdue' ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                                            <Clock size={14} /> {dueLabel}
                                        </div>
                                    )}
                                    <span className={`badge uppercase w-20 justify-center
                                        ${priority === 'high' ? 'bg-red-500/10 text-red-400' :
                                            priority === 'medium' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                                        {priority}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
