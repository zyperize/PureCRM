import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { leadsService } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';

export default function FollowUpCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const navigate = useNavigate();

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    // Fetch tasks with due dates in this month range
    const { data: tasks, isLoading, error } = useQuery({
        queryKey: ['calendarTasks', format(monthStart, 'yyyy-MM')],
        queryFn: () => tasksService.getCalendarTasks(format(calStart, 'yyyy-MM-dd'), format(calEnd, 'yyyy-MM-dd'))
    });

    // Also fetch leads with follow-up dates
    const { data: followUps } = useQuery({
        queryKey: ['calendarFollowUps', format(monthStart, 'yyyy-MM')],
        queryFn: () => leadsService.getCalendarFollowUps(format(calStart, 'yyyy-MM-dd'), format(calEnd, 'yyyy-MM-dd'))
    });

    const getEventsForDay = (day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayTasks = (tasks || []).filter(t => t.due_date === dateStr).map(t => ({
            id: t.id, label: t.task_name, leadId: t.lead?.id, color: 'blue'
        }));
        const dayFollowUps = (followUps || []).filter(f => f.next_follow_up_date === dateStr).map(f => ({
            id: f.id, label: f.next_follow_up_task || `Follow up: ${f.business_name}`, leadId: f.id, color: 'orange'
        }));
        return [...dayTasks, ...dayFollowUps];
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link to="/tasks" className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-3xl font-bold text-white">Calendar</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-charcoal-800 rounded-lg border border-white/5">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/5"><ChevronLeft size={18} /></button>
                        <span className="px-4 font-medium text-white">{format(currentMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/5"><ChevronRight size={18} /></button>
                    </div>
                    <button onClick={() => setCurrentMonth(new Date())} className="btn-secondary">Today</button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>
            ) : error ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
                        <div className="flex-1">
                            <h2 className="text-sm font-semibold text-red-100">Tasks did not load</h2>
                            <p className="mt-1 text-sm text-red-200/80">{error.message || 'Check Supabase access, RLS, or network connectivity.'}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card p-0 flex-1 flex flex-col overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-white/5 bg-charcoal-900">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                        {days.map(day => {
                            const events = getEventsForDay(day);
                            const inMonth = isSameMonth(day, currentMonth);
                            return (
                                <div key={day.toISOString()} className={`border-r border-b border-white/5 p-2 min-h-[100px] relative group hover:bg-white/[0.02] transition-colors
                                    ${isToday(day) ? 'bg-gold-500/5' : ''} ${!inMonth ? 'opacity-30' : ''}`}>
                                    <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                                        ${isToday(day) ? 'bg-gold-500 text-charcoal-900' : 'text-gray-400'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    <div className="mt-1 space-y-1">
                                        {events.slice(0, 3).map(event => (
                                            <button
                                                key={`${event.color}-${event.id}`}
                                                onClick={() => event.leadId && navigate(`/leads/${event.leadId}`)}
                                                className={`text-[10px] p-1 rounded truncate w-full text-left cursor-pointer
                                                    ${event.color === 'blue' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30' :
                                                        'bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30'}`}
                                            >
                                                {event.label}
                                            </button>
                                        ))}
                                        {events.length > 3 && <p className="text-[10px] text-gray-500">+{events.length - 3} more</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
