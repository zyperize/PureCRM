import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Plus, Filter, MoreHorizontal, Loader2, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import { leadsService } from '../../services/leadsService';
import toast from 'react-hot-toast';
import { track } from '../../services/analytics';
import AddLeadModal from './AddLeadModal';

const LEAD_STAGES = [
    { value: 'new', label: 'New', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
    { value: 'interested', label: 'Interested', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
    { value: 'samples_sent', label: 'Samples Sent', color: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' },
    { value: 'qualified', label: 'Qualified', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
    { value: 'won', label: 'Won', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
    { value: 'lost', label: 'Lost', color: 'bg-gray-500/10 text-gray-400 border border-white/10' }
];

const STAGE_FILTER_OPTIONS = [
    { value: 'hot', label: 'Hot Pipeline' },
    ...LEAD_STAGES
];

const CATEGORIES = [
    { value: 'prospect', label: 'Prospects' },
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
    { value: 'partner', label: 'Partners' },
    { value: 'referral', label: 'Referrals' },
    { value: 'event', label: 'Events' },
    { value: 'other', label: 'Other' }
];

const SOURCES = [
    { value: 'manual', label: 'Manual' },
    { value: 'csv_import', label: 'CSV Import' },
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'event', label: 'Event' },
    { value: 'partner', label: 'Partner' }
];

const TAGS = [
    { value: 'hot', label: 'Hot Lead' },
    { value: 'do_not_email', label: 'Do Not Email' },
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'proposal_sent', label: 'Proposal Sent' },
    { value: 'priority', label: 'Priority' }
];

const URL_FILTER_KEYS = ['search', 'category', 'state', 'city', 'stage', 'source', 'tag', 'followup', 'contact', 'min_rating', 'max_rating'];
const URL_STATE_KEYS = [...URL_FILTER_KEYS, 'page', 'pageSize', 'sortBy', 'sortOrder'];
const DEFAULT_FILTERS = {
    search: '',
    category: '',
    state: '',
    city: '',
    stage: '',
    source: '',
    tag: '',
    followup: '',
    contact: '',
    min_rating: '',
    max_rating: '',
    page: 1,
    pageSize: 25,
    sortBy: 'created_at',
    sortOrder: 'desc'
};

function getInitialFilters(searchParams) {
    const initial = { ...DEFAULT_FILTERS };

    URL_STATE_KEYS.forEach((key) => {
        const value = searchParams.get(key);
        if (!value) return;

        if (key === 'page') {
            initial.page = Math.max(parseInt(value, 10) || DEFAULT_FILTERS.page, 1);
            return;
        }

        if (key === 'pageSize') {
            const pageSize = parseInt(value, 10) || DEFAULT_FILTERS.pageSize;
            initial.pageSize = [10, 25, 50, 100].includes(pageSize) ? pageSize : DEFAULT_FILTERS.pageSize;
            return;
        }

        initial[key] = key === 'state' ? value.toUpperCase() : value;
    });

    return initial;
}

export default function LeadsList() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isAddModalOpen, setIsAddModalOpen] = useState(() => searchParams.get('new') === '1');
    const [showFilters, setShowFilters] = useState(() => URL_FILTER_KEYS.some((key) => searchParams.has(key)));
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [chosenStage, setChosenStage] = useState('');
    const [chosenFollowUp, setChosenFollowUp] = useState('');
    const [chosenTag, setChosenTag] = useState('');
    const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
    const filters = getInitialFilters(searchParams);

    useEffect(() => setSelectedIds(new Set()), [searchParams]);

    // keep the search box in sync when the URL search changes elsewhere (clear filters, nav)
    useEffect(() => { setSearchInput(filters.search); }, [filters.search]);

    // debounce pushing the typed search into the URL filter (avoids a query per keystroke)
    useEffect(() => {
        if (searchInput === filters.search) return undefined;
        const t = setTimeout(() => handleFilterChange('search', searchInput), 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    // Fetch leads count + page from Supabase
    const { data: response, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['leads', filters],
        queryFn: () => leadsService.getLeads(filters)
    });

    const leads = response?.data || [];
    const totalCount = response?.count || 0;
    const totalPages = Math.ceil(totalCount / filters.pageSize) || 1;

    const updateUrlFilters = (updates) => {
        const nextParams = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined || value === DEFAULT_FILTERS[key]) {
                nextParams.delete(key);
            } else {
                nextParams.set(key, String(value));
            }
        });

        setSearchParams(nextParams, { replace: true });
    };

    const handleSort = (field) => {
        const isSameField = filters.sortBy === field;
        const nextOrder = isSameField && filters.sortOrder === 'desc' ? 'asc' : 'desc';

        updateUrlFilters({
            sortBy: field,
            sortOrder: nextOrder,
            page: 1
        });
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateUrlFilters({ page: newPage });
        }
    };

    const handleFilterChange = (key, value) => {
        updateUrlFilters({
            [key]: value,
            page: 1
        });
    };

    const clearAllFilters = () => {
        setSearchParams({});
        toast.success('Filters cleared');
    };

    const handleBulkStageUpdate = async () => {
        if (!window.confirm(`Set stage for ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'}?`)) return;
        try {
            const updatedCount = await leadsService.bulkUpdateStage([...selectedIds], chosenStage);
            track('bulk_stage_update', { count: updatedCount });
            toast.success(`${updatedCount} lead${updatedCount === 1 ? '' : 's'} updated`);
            setSelectedIds(new Set());
            setChosenStage('');
            setChosenFollowUp('');
            refetch();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleBulkAddTag = async () => {
        if (!window.confirm(`Add tag to ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'}?`)) return;
        try {
            const updatedCount = await leadsService.bulkAddTag([...selectedIds], chosenTag);
            track('bulk_tag', { count: updatedCount });
            toast.success(`Tagged ${updatedCount} lead${updatedCount === 1 ? '' : 's'}`);
            setSelectedIds(new Set());
            setChosenTag('');
            refetch();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleBulkFollowUpUpdate = async () => {
        if (!window.confirm(`Set follow-up date for ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'}?`)) return;
        try {
            const updatedCount = await leadsService.bulkUpdateFollowUp([...selectedIds], chosenFollowUp);
            track('bulk_followup', { count: updatedCount });
            toast.success(`${updatedCount} lead${updatedCount === 1 ? '' : 's'} updated`);
            setSelectedIds(new Set());
            setChosenFollowUp('');
            refetch();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        if (searchParams.get('new') === '1') {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('new');
            setSearchParams(nextParams, { replace: true });
        }
    };

    const getStageBadge = (stage) => {
        const stageObj = LEAD_STAGES.find(s => s.value === stage);
        const colorClass = stageObj?.color || 'bg-gray-500/10 text-gray-400 border border-white/10';
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${colorClass}`}>
                {stageObj?.label || (stage ? stage.replace('_', ' ') : 'New')}
            </span>
        );
    };

    const renderSortableHeader = (field, label) => {
        const isSorted = filters.sortBy === field;
        const isAsc = filters.sortOrder === 'asc';
        return (
            <th
                className="p-4 font-semibold text-gray-400 select-none cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort(field)}
            >
                <div className="flex items-center gap-1">
                    {label}
                    {isSorted ? (
                        isAsc ? <span className="text-gold-400 text-xs">▲</span> : <span className="text-gold-400 text-xs">▼</span>
                    ) : (
                        <span className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">↕</span>
                    )}
                </div>
            </th>
        );
    };

    // Calculate item ranges for footer display
    const startIdx = (filters.page - 1) * filters.pageSize + 1;
    const endIdx = Math.min(startIdx + leads.length - 1, totalCount);

    // Error state
    if (error) {
        return (
            <div className="card p-8 text-center bg-charcoal-800 border border-white/10 rounded-2xl">
                <p className="text-red-400 mb-4 font-medium">Failed to load leads: {error.message}</p>
                <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary disabled:opacity-50">
                    {isFetching ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Retrying
                        </>
                    ) : (
                        'Retry'
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AddLeadModal isOpen={isAddModalOpen || searchParams.get('new') === '1'} onClose={closeAddModal} />

            {/* Action Bar */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    {/* Search & Toggle Filters Button */}
                    <div className="flex flex-col sm:flex-row flex-1 gap-3 w-full md:w-auto min-w-0">
                        <div className="relative flex-1 w-full sm:max-w-md min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                placeholder="Search business name, phone, city..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="input-field pl-10 bg-charcoal-800 border-white/10 text-white rounded-xl focus:border-gold-400/50"
                            />
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`btn-secondary px-4 py-2 flex items-center justify-center gap-2 rounded-xl transition ${
                                showFilters ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-gray-300 border-white/5'
                            }`}
                        >
                            <Filter size={16} />
                            <span>Filters</span>
                            {(filters.category || filters.state || filters.city || filters.stage || filters.source || filters.tag || filters.followup || filters.contact || filters.min_rating || filters.max_rating) && (
                                <span className="w-2 h-2 rounded-full bg-gold-400"></span>
                            )}
                        </button>

                        {(filters.category || filters.state || filters.city || filters.stage || filters.source || filters.tag || filters.followup || filters.contact || filters.min_rating || filters.max_rating || filters.search) && (
                            <button
                                onClick={clearAllFilters}
                                className="p-2 text-gray-500 hover:text-white transition-colors"
                                title="Clear all filters"
                            >
                                <RotateCcw size={16} />
                            </button>
                        )}
                    </div>

                    {/* Primary Action Button */}
                    <button onClick={() => setIsAddModalOpen(true)} className="btn-primary flex items-center justify-center gap-2 rounded-xl w-full sm:w-auto">
                        <Plus size={18} />
                        <span>Add Lead</span>
                    </button>
                </div>

                {/* Collapsible Advanced Filters Panel */}
                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-charcoal-800 border border-white/5 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                        {/* Category */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Category</label>
                            <select
                                value={filters.category}
                                onChange={(e) => handleFilterChange('category', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                            >
                                <option value="">All Categories</option>
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Stage */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Lead Stage</label>
                            <select
                                value={filters.stage}
                                onChange={(e) => handleFilterChange('stage', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                            >
                                <option value="">All Stages</option>
                                {STAGE_FILTER_OPTIONS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Source */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Source</label>
                            <select
                                value={filters.source}
                                onChange={(e) => handleFilterChange('source', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                            >
                                <option value="">All Sources</option>
                                {SOURCES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tag */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Has Tag</label>
                            <select
                                value={filters.tag}
                                onChange={(e) => handleFilterChange('tag', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                            >
                                <option value="">All Tags</option>
                                {TAGS.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* State */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">State Code</label>
                            <input
                                type="text"
                                placeholder="e.g. CA, FL"
                                maxLength={2}
                                value={filters.state}
                                onChange={(e) => handleFilterChange('state', e.target.value.toUpperCase())}
                                className="w-full bg-charcoal-900 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none placeholder:text-gray-600 uppercase"
                            />
                        </div>

                        {/* City */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">City</label>
                            <input
                                type="text"
                                placeholder="Search city..."
                                value={filters.city}
                                onChange={(e) => handleFilterChange('city', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none placeholder:text-gray-600"
                            />
                        </div>

                        {/* Follow-up Status */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Follow-up Task</label>
                            <select
                                value={filters.followup}
                                onChange={(e) => handleFilterChange('followup', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                            >
                                <option value="">All Leads</option>
                                <option value="next7">Due by Next 7 Days</option>
                                <option value="today">Scheduled for Today</option>
                                <option value="overdue">Overdue Tasks</option>
                                <option value="upcoming">Upcoming Tasks</option>
                                <option value="none">No Follow-up Scheduled</option>
                            </select>
                        </div>

                        {/* Contact Status */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Contact Status</label>
                            <select
                                value={filters.contact}
                                onChange={(e) => handleFilterChange('contact', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                            >
                                <option value="">Any Contact Status</option>
                                <option value="missing">Missing Email or Phone</option>
                            </select>
                        </div>

                        {/* Rating Range */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Min Rating</label>
                            <input
                                type="number"
                                min="0"
                                max="5"
                                step="0.1"
                                placeholder="e.g. 4.2"
                                value={filters.min_rating}
                                onChange={(e) => handleFilterChange('min_rating', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none placeholder:text-gray-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Max Rating</label>
                            <input
                                type="number"
                                min="0"
                                max="5"
                                step="0.1"
                                placeholder="e.g. 5"
                                value={filters.max_rating}
                                onChange={(e) => handleFilterChange('max_rating', e.target.value)}
                                className="w-full bg-charcoal-900 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none placeholder:text-gray-600"
                            />
                        </div>

                        {/* Clear Button */}
                        <div className="flex items-end">
                            <button
                                onClick={clearAllFilters}
                                className="w-full px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium text-sm transition"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedIds.size > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-charcoal-800 border border-gold-400/20 rounded-2xl">
                    <span className="text-sm font-semibold text-gold-200">{selectedIds.size} selected</span>
                    <select
                        value={chosenStage}
                        onChange={(e) => setChosenStage(e.target.value)}
                        className="bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                    >
                        <option value="">Set stage…</option>
                        {LEAD_STAGES.map((stage) => (
                            <option key={stage.value} value={stage.value}>{stage.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleBulkStageUpdate}
                        disabled={!chosenStage}
                        className="btn-primary px-4 py-2 rounded-xl disabled:opacity-50 disabled:pointer-events-none"
                    >
                        Apply
                    </button>
                    <input
                        type="date"
                        value={chosenFollowUp}
                        onChange={(e) => setChosenFollowUp(e.target.value)}
                        className="bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none [color-scheme:dark]"
                    />
                    <button
                        onClick={handleBulkFollowUpUpdate}
                        disabled={!chosenFollowUp}
                        className="btn-primary px-4 py-2 rounded-xl disabled:opacity-50 disabled:pointer-events-none"
                    >
                        Apply
                    </button>
                    <select
                        value={chosenTag}
                        onChange={(e) => setChosenTag(e.target.value)}
                        className="bg-charcoal-900 border border-white/10 text-gray-300 rounded-xl px-3 py-2 text-sm focus:border-gold-400/50 outline-none"
                    >
                        <option value="">Add tag…</option>
                        {TAGS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleBulkAddTag}
                        disabled={!chosenTag}
                        className="btn-primary px-4 py-2 rounded-xl disabled:opacity-50 disabled:pointer-events-none"
                    >
                        Apply
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium text-sm transition"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Table Card */}
            <div className="card p-0 overflow-hidden bg-charcoal-800 border border-white/10 rounded-2xl relative shadow-xl">
                {isLoading && (
                    <div className="absolute inset-0 bg-charcoal-800/50 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
                    </div>
                )}

                {/* Mobile card list (the table is hidden below md) */}
                <div className="md:hidden divide-y divide-white/5">
                    {leads.length > 0 ? (
                        leads.map((lead) => (
                            <div
                                key={lead.id}
                                onClick={() => navigate(`/leads/${lead.id}`)}
                                className="p-4 flex gap-3 hover:bg-white/[0.02] cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    aria-label={`Select ${lead.business_name}`}
                                    checked={selectedIds.has(lead.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => {
                                        setSelectedIds((current) => {
                                            const next = new Set(current);
                                            if (next.has(lead.id)) next.delete(lead.id);
                                            else next.add(lead.id);
                                            return next;
                                        });
                                    }}
                                    className="h-4 w-4 accent-amber-400 mt-1 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium text-white truncate">{lead.business_name}</p>
                                        {getStageBadge(lead.lead_stage)}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                                        {(lead.city || lead.state) && <span>{[lead.city, lead.state].filter(Boolean).join(', ')}</span>}
                                        {lead.phone && <span className="font-mono">{lead.phone}</span>}
                                        {lead.next_follow_up_date && <span>Follow-up {lead.next_follow_up_date}</span>}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center text-gray-500">No leads found matching your criteria. Try resetting filters.</div>
                    )}
                </div>

                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 text-sm select-none">
                                <th className="p-4 w-12">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all visible leads"
                                        checked={leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id))}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSelectedIds((current) => {
                                                const next = new Set(current);
                                                leads.forEach((lead) => checked ? next.add(lead.id) : next.delete(lead.id));
                                                return next;
                                            });
                                        }}
                                        className="h-4 w-4 accent-amber-400"
                                    />
                                </th>
                                {renderSortableHeader('business_name', 'Business Name')}
                                <th className="p-4 font-semibold text-gray-400">Phone</th>
                                {renderSortableHeader('city', 'Location')}
                                {renderSortableHeader('lead_stage', 'Stage')}
                                {renderSortableHeader('next_follow_up_date', 'Next Follow-up')}
                                {renderSortableHeader('created_at', 'Added Date')}
                                <th className="p-4 font-semibold text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {leads.length > 0 ? (
                                leads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => navigate(`/leads/${lead.id}`)}
                                        className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 w-12" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${lead.business_name}`}
                                                checked={selectedIds.has(lead.id)}
                                                onChange={() => {
                                                    setSelectedIds((current) => {
                                                        const next = new Set(current);
                                                        if (next.has(lead.id)) next.delete(lead.id);
                                                        else next.add(lead.id);
                                                        return next;
                                                    });
                                                }}
                                                className="h-4 w-4 accent-amber-400"
                                            />
                                        </td>
                                        <td className="p-4 font-medium text-white group-hover:text-gold-200 transition-colors">
                                            {lead.business_name}
                                        </td>
                                        <td className="p-4 text-gray-300 font-mono">
                                            {lead.phone || '-'}
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={14} className="text-gray-500" />
                                                {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.city || lead.state || '-'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {getStageBadge(lead.lead_stage)}
                                        </td>
                                        <td className="p-4 text-gray-400">
                                            {lead.next_follow_up_date || '-'}
                                        </td>
                                        <td className="p-4 text-gray-400">
                                            {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`) }}
                                                className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-white/10 transition-colors"
                                            >
                                                <MoreHorizontal size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-gray-500">
                                        No leads found matching your criteria. Try resetting filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalCount > 0 && (
                    <div className="border-t border-white/5 p-4 bg-white/[0.01] flex flex-col sm:flex-row gap-4 items-center justify-between text-xs text-gray-500">
                        <div>
                            Showing <span className="font-semibold text-gray-300">{startIdx}</span> to <span className="font-semibold text-gray-300">{endIdx}</span> of <span className="font-semibold text-gray-300">{totalCount}</span> leads
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Page size selector */}
                            <div className="flex items-center gap-2">
                                <span>Rows per page:</span>
                                <select
                                    value={filters.pageSize}
                                    onChange={(e) => handleFilterChange('pageSize', parseInt(e.target.value))}
                                    className="bg-charcoal-900 border border-white/10 text-gray-300 rounded-lg px-2 py-1 text-xs focus:border-gold-400/50 outline-none"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            {/* Pager buttons */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(filters.page - 1)}
                                    disabled={filters.page === 1}
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <span className="px-3 py-1 font-medium text-gray-300">
                                    Page {filters.page} of {totalPages}
                                </span>

                                <button
                                    onClick={() => handlePageChange(filters.page + 1)}
                                    disabled={filters.page === totalPages}
                                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
