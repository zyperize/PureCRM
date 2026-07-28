import { useQuery } from '@tanstack/react-query';
import { callsService } from '../../services/callsService';
import { Phone, Clock, FileText, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export default function CallHistory() {
    const { data: calls, isLoading, error } = useQuery({
        queryKey: ['recent-calls'],
        queryFn: () => callsService.getRecentCalls(50)
    });

    const formatCallDate = (dateString) => {
        const date = new Date(dateString);
        if (isToday(date)) {
            return `Today, ${format(date, 'h:mm a')}`;
        } else if (isYesterday(date)) {
            return `Yesterday, ${format(date, 'h:mm a')}`;
        }
        return format(date, 'MMM d, h:mm a');
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const handleDownloadCsv = () => {
        if (!calls?.length) {
            toast.error('No calls to export');
            return;
        }

        const rows = calls.map((call) => ({
            direction: call.call_direction || '',
            business_name: call.leads?.business_name || '',
            outcome: call.call_outcome || '',
            duration_seconds: call.call_duration || '',
            date: call.created_at || '',
            notes: call.call_notes || '',
            summary: call.summary || ''
        }));
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `crm_call_history_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Call history exported');
    };

    if (isLoading) {
        return (
            <div className="card flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <p className="text-red-400">Error loading call history: {error.message}</p>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Recent Calls</h3>
                <button onClick={handleDownloadCsv} className="btn-secondary text-sm">Download CSV</button>
            </div>

            {!calls || calls.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No call history yet</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-xs text-gray-500 uppercase border-b border-white/5">
                            <tr>
                                <th className="pb-3 pl-2">Type</th>
                                <th className="pb-3">Business</th>
                                <th className="pb-3">Outcome</th>
                                <th className="pb-3">Duration</th>
                                <th className="pb-3">Date</th>
                                <th className="pb-3">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {calls.map((call) => (
                                <tr key={call.id} className="group hover:bg-white/[0.02]">
                                    <td className="py-4 pl-2">
                                        <span className={`flex items-center gap-2 ${call.call_direction === 'outbound' ? 'text-blue-400' : 'text-green-400'}`}>
                                            {call.call_direction === 'outbound' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                            <span className="capitalize">{call.call_direction}</span>
                                        </span>
                                    </td>
                                    <td className="py-4 font-medium text-white">{call.leads?.business_name || 'Unknown'}</td>
                                    <td className="py-4">
                                        <span className={`badge ${call.call_outcome === 'connected' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                            {call.call_outcome || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="py-4 font-mono text-gray-400">{formatDuration(call.call_duration)}</td>
                                    <td className="py-4 text-gray-400">{formatCallDate(call.created_at)}</td>
                                    <td className="py-4 text-gray-500 max-w-xs truncate">{call.call_notes || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
