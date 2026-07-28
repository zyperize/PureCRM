import { AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CallHistory from '../components/calling/CallHistory';
import { callsService } from '../services/callsService';

export default function Calling() {
    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['callStats'],
        queryFn: () => callsService.getCallStats()
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Calling Center</h1>
                    <p className="text-gray-400 mt-1">Review call logs and manage sequences.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {isLoading ? (
                    <div className="col-span-4 flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gold-400" /></div>
                ) : error ? (
                    <div className="col-span-4 rounded border border-red-500/30 bg-red-500/10 p-5">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
                            <div className="flex-1">
                                <h2 className="text-sm font-semibold text-red-100">Call stats did not load</h2>
                                <p className="mt-1 text-sm text-red-200/80">{error.message || 'Check Supabase access, RLS, or network connectivity.'}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="card bg-charcoal-800 border-l-4 border-gold-500">
                            <p className="text-sm text-gray-400">Calls Today</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.today || 0}</p>
                        </div>
                        <div className="card bg-charcoal-800 border-l-4 border-green-500">
                            <p className="text-sm text-gray-400">This Week</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.thisWeek || 0}</p>
                        </div>
                        <div className="card bg-charcoal-800 border-l-4 border-blue-500">
                            <p className="text-sm text-gray-400">This Month</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.thisMonth || 0}</p>
                        </div>
                        <div className="card bg-charcoal-800 border-l-4 border-purple-500">
                            <p className="text-sm text-gray-400">Last Month</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.lastMonth || 0}</p>
                        </div>
                    </>
                )}
            </div>

            <CallHistory />
        </div>
    );
}
