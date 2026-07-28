import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { leadsService } from '../services/leadsService';
import toast from 'react-hot-toast';
import { track } from '../services/analytics';

function GroupCard({ group }) {
    const leads = group.leads || [];
    const [keeperId, setKeeperId] = useState(leads[0]?.id);
    const queryClient = useQueryClient();

    const mergeMutation = useMutation({
        mutationFn: () => leadsService.mergeLeads(keeperId, leads.filter((l) => l.id !== keeperId).map((l) => l.id)),
        onSuccess: (deleted) => {
            track('leads_merged', { deleted });
            toast.success(`Merged ${deleted} duplicate${deleted === 1 ? '' : 's'}`);
            queryClient.invalidateQueries({ queryKey: ['duplicateGroups'] });
        },
        onError: (err) => toast.error(err.message)
    });

    const handleMerge = () => {
        const losers = leads.filter((l) => l.id !== keeperId);
        if (!keeperId || !losers.length) return;
        const keptName = leads.find((l) => l.id === keeperId)?.business_name;
        if (!window.confirm(`Keep "${keptName}" and delete ${losers.length} duplicate${losers.length === 1 ? '' : 's'}? Their notes, tasks, and calls move to the kept lead. This cannot be undone.`)) return;
        mergeMutation.mutate();
    };

    return (
        <div className="bg-charcoal-800 border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-sm text-gray-400">
                    <span className="text-white font-semibold">{group.lead_count}</span> records · <span className="capitalize">{group.group_key}</span>
                </p>
                <button
                    onClick={handleMerge}
                    disabled={mergeMutation.isPending}
                    className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                    {mergeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Merge {leads.length - 1} into kept
                </button>
            </div>
            <div className="divide-y divide-white/5">
                {leads.map((l) => (
                    <label key={l.id} className="flex items-center gap-3 py-2 cursor-pointer">
                        <input
                            type="radio"
                            name={`keep-${group.group_key}`}
                            checked={keeperId === l.id}
                            onChange={() => setKeeperId(l.id)}
                            className="h-4 w-4 accent-amber-400 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-sm truncate">
                                {l.business_name}
                                {keeperId === l.id && <span className="ml-2 text-xs text-gold-300">(keep)</span>}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {[l.city, l.state].filter(Boolean).join(', ')}
                                {l.phone ? ` · ${l.phone}` : ''}
                                {l.lead_stage ? ` · ${l.lead_stage}` : ''}
                            </p>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}

export default function Duplicates() {
    const { data: groups, isLoading, error } = useQuery({
        queryKey: ['duplicateGroups'],
        queryFn: () => leadsService.getDuplicateGroups(100)
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Duplicate Leads</h1>
                <p className="text-sm md:text-base text-gray-400 mt-1">
                    Leads sharing the same business name and address. Pick which record to keep, then merge the rest into it.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>
            ) : error ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
                        <div>
                            <h2 className="text-sm font-semibold text-red-100">Could not load duplicates</h2>
                            <p className="mt-1 text-sm text-red-200/80">{error.message || 'Check Supabase access, RLS, or network connectivity.'}</p>
                        </div>
                    </div>
                </div>
            ) : (groups && groups.length) ? (
                <div className="space-y-4">
                    {groups.map((g) => <GroupCard key={g.group_key} group={g} />)}
                </div>
            ) : (
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={18} /> No duplicates found — every lead has a unique name + address.
                </div>
            )}
        </div>
    );
}
