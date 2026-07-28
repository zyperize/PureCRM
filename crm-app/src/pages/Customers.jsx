import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { audienceService } from '../services/audienceService';
import { Download, Users, Mail, Calendar, Sparkles, AlertCircle, Loader2, UserCheck, ArrowRightLeft, RefreshCw, CheckCircle2, DollarSign } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

const TABS = ['customers', 'captures'];
const CAPTURE_FILTERS = ['all', 'unpromoted', 'promoted', 'no-consent'];
const CUSTOMER_FILTERS = ['active', 'reorder_due', 'all', 'suppressed', 'unsub', 'bounced', 'dnc'];
const REORDER_DUE_DAYS = 45;

export default function Customers() {
  const [renderTime] = useState(() => Date.now());
  const [orderDraft, setOrderDraft] = useState({ customer: null, amount: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'customers';
  const captureFilter = CAPTURE_FILTERS.includes(searchParams.get('filter')) ? searchParams.get('filter') : 'all';
  const customerFilter = CUSTOMER_FILTERS.includes(searchParams.get('customerFilter'))
    ? searchParams.get('customerFilter')
    : 'active';

  // Fetch retail customers from Supabase (promoted/active list)
  const { data: customers, isLoading: isCustomersLoading, error: customersError, refetch: refetchCustomers, isFetching: isFetchingCustomers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => audienceService.getCustomers()
  });

  // Fetch raw website captures (raw pop-up opt-ins)
  const { data: captures, isLoading: isCapturesLoading, error: capturesError, refetch: refetchCaptures, isFetching: isFetchingCaptures } = useQuery({
    queryKey: ['captures-list'],
    queryFn: () => audienceService.getWebsiteCaptures()
  });

  const promoteCaptureMutation = useMutation({
    mutationFn: (capture) => audienceService.promoteCaptureToCustomer(capture),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      queryClient.invalidateQueries({ queryKey: ['captures-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-command-center'] });
      toast.success('Capture promoted to customer');
    },
    onError: (err) => toast.error(`Failed to promote capture: ${err.message}`)
  });

  const recordOrderMutation = useMutation({
    mutationFn: ({ customer, orderTotal }) => audienceService.recordCustomerOrder(customer, orderTotal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-command-center'] });
      setOrderDraft({ customer: null, amount: '' });
      toast.success('Customer order recorded');
    },
    onError: (err) => toast.error(`Failed to record order: ${err.message}`)
  });

  const updateView = (updates) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (
        !value ||
        (key === 'tab' && value === 'customers') ||
        (key === 'filter' && value === 'all') ||
        (key === 'customerFilter' && value === 'active')
      ) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    if (updates.tab !== 'captures') nextParams.delete('filter');
    if (updates.tab && updates.tab !== 'customers') nextParams.delete('customerFilter');
    setSearchParams(nextParams, { replace: true });
  };

  const handleExportCustomers = () => {
    if (!filteredCustomers || filteredCustomers.length === 0) {
      toast.error('No customers to export');
      return;
    }
    const csv = Papa.unparse(filteredCustomers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_customers_${customerFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Customer list exported successfully!');
  };

  const handleExportCaptures = () => {
    if (!filteredCaptures || filteredCaptures.length === 0) {
      toast.error('No captures to export');
      return;
    }
    const csv = Papa.unparse(filteredCaptures);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_website_captures_${captureFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Website captures exported successfully!');
  };

  const handleRecordOrder = (customer) => {
    setOrderDraft({ customer, amount: '' });
  };

  const handleRecordOrderSubmit = (event) => {
    event.preventDefault();
    if (!orderDraft.customer) return;
    recordOrderMutation.mutate({
      customer: orderDraft.customer,
      orderTotal: orderDraft.amount.trim()
    });
  };

  const isLoading = isCustomersLoading || isCapturesLoading;
  const hasError = customersError || capturesError;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-gold-400" />
        <span className="text-gray-400 font-mono text-sm uppercase tracking-wider">Syncing Customer Records...</span>
      </div>
    );
  }

  if (hasError) {
    const errorMsg = customersError?.message || capturesError?.message;
    const retry = () => {
      refetchCustomers();
      refetchCaptures();
    };
    const retrying = isFetchingCustomers || isFetchingCaptures;
    return (
      <div className="card p-8 text-center max-w-xl mx-auto mt-12 border border-red-500/20 bg-charcoal-900/50">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Sync Connection Error</h3>
        <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
        <button onClick={retry} disabled={retrying} className="btn-secondary mx-auto mb-4 disabled:opacity-50">
          {retrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Retry
        </button>
        <div className="bg-charcoal-950 p-4 rounded border border-white/5 text-xs text-gray-500 text-left font-mono">
          Note: Make sure your Supabase schema setup was fully completed using the setup scripts. If you get table not found errors, check if the tables <code className="text-gold-400">customers</code> and <code className="text-gold-400">website_captures</code> exist.
        </div>
      </div>
    );
  }

  // Calculate quick stats
  const totalSubscribers = captures?.length || 0;
  const promotedCount = captures?.filter(c => c.promoted).length || 0;
  const unpromotedConsentedCount = captures?.filter(c => c.consented && !c.promoted).length || 0;
  const statusFor = (customer) => customer.status || 'active';
  const daysSince = (dateString) => {
    if (!dateString) return null;
    return Math.max(0, Math.floor((renderTime - new Date(dateString).getTime()) / 86400000));
  };
  const isReorderDue = (customer) => {
    if (statusFor(customer) !== 'active' || Number(customer.order_count || 0) <= 0) return false;
    const age = daysSince(customer.last_order_at);
    return age === null || age >= REORDER_DUE_DAYS;
  };
  const activeCustomers = customers?.filter(c => statusFor(c) === 'active').length || 0;
  const reorderDueCustomers = customers?.filter(isReorderDue).length || 0;
  const suppressedCustomers = customers?.filter(c => statusFor(c) !== 'active').length || 0;
  const filteredCustomers = (customers || []).filter((customer) => {
    const status = statusFor(customer);
    if (customerFilter === 'all') return true;
    if (customerFilter === 'reorder_due') return isReorderDue(customer);
    if (customerFilter === 'suppressed') return status !== 'active';
    return status === customerFilter;
  });
  const filteredCaptures = (captures || []).filter((capture) => {
    if (captureFilter === 'unpromoted') return capture.consented && !capture.promoted;
    if (captureFilter === 'promoted') return capture.promoted;
    if (captureFilter === 'no-consent') return !capture.consented;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {orderDraft.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form onSubmit={handleRecordOrderSubmit} className="w-full max-w-md rounded-lg border border-white/10 bg-charcoal-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Record Order</p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {orderDraft.customer.first_name || orderDraft.customer.email}
                </h2>
                <p className="mt-1 text-sm text-gray-400">{orderDraft.customer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setOrderDraft({ customer: null, amount: '' })}
                disabled={recordOrderMutation.isPending}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-bold text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Order Amount</span>
              <div className="flex items-center rounded-lg border border-white/10 bg-charcoal-950 px-3 focus-within:border-emerald-400/60">
                <DollarSign size={16} className="text-emerald-300" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={orderDraft.amount}
                  onChange={(event) => setOrderDraft((draft) => ({ ...draft, amount: event.target.value }))}
                  className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-gray-600"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOrderDraft({ customer: null, amount: '' })}
                disabled={recordOrderMutation.isPending}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordOrderMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-charcoal-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {recordOrderMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                Record Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Audience & Captures</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
              Active Sync
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Manage your warm customer database and raw storefront pop-up email captures.
          </p>
        </div>

        <div>
          {activeTab === 'customers' ? (
            <button
              onClick={handleExportCustomers}
              className="btn-primary inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-charcoal-950 font-bold transition-all px-4 py-2.5 rounded-lg shadow-lg"
            >
              <Download size={18} />
              <span>Export Customers CSV</span>
            </button>
          ) : (
            <button
              onClick={handleExportCaptures}
              className="btn-primary inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-charcoal-950 font-bold transition-all px-4 py-2.5 rounded-lg shadow-lg"
            >
              <Download size={18} />
              <span>Export Captures CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => updateView({ tab: 'customers' })}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'customers'
              ? 'border-gold-500 text-gold-400'
              : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UserCheck size={16} />
          <span>Promoted Customers ({customers?.length || 0})</span>
        </button>
        <button
          onClick={() => updateView({ tab: 'captures' })}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'captures'
              ? 'border-gold-500 text-gold-400'
              : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles size={16} />
          <span>Storefront Popup Captures ({captures?.length || 0})</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-charcoal-800 border-l-4 border-gold-500 flex items-center justify-between shadow-md relative overflow-hidden group hover:border-gold-400 transition-all duration-300">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gold-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono font-bold">Active Customers</p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{activeCustomers}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 group-hover:scale-110 transition-transform">
            <Users size={24} />
          </div>
        </div>

        <div className="card p-6 bg-charcoal-800 border-l-4 border-green-500 flex items-center justify-between shadow-md relative overflow-hidden group hover:border-green-400 transition-all duration-300">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-green-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono font-bold">Raw Email Captures</p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{totalSubscribers}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
            <Mail size={24} />
          </div>
        </div>

        <div className="card p-6 bg-charcoal-800 border-l-4 border-blue-500 flex items-center justify-between shadow-md relative overflow-hidden group hover:border-blue-400 transition-all duration-300">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono font-bold">Promoted Rate</p>
            <p className="text-3xl font-black text-white mt-2 font-mono">
              {totalSubscribers ? Math.round((promotedCount / totalSubscribers) * 100) : 0}%
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <ArrowRightLeft size={24} />
          </div>
        </div>
      </div>

      {activeTab === 'customers' && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'active', label: `Active (${activeCustomers})` },
            { key: 'reorder_due', label: `Reorder due (${reorderDueCustomers})` },
            { key: 'all', label: `All (${customers?.length || 0})` },
            { key: 'suppressed', label: `Suppressed (${suppressedCustomers})` },
            { key: 'unsub', label: `Unsub (${customers?.filter(c => statusFor(c) === 'unsub').length || 0})` },
            { key: 'bounced', label: `Bounced (${customers?.filter(c => statusFor(c) === 'bounced').length || 0})` },
            { key: 'dnc', label: `DNC (${customers?.filter(c => statusFor(c) === 'dnc').length || 0})` }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => updateView({ tab: 'customers', customerFilter: filter.key })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                customerFilter === filter.key
                  ? 'bg-gold-500 text-charcoal-950'
                  : 'bg-charcoal-800 text-gray-400 hover:bg-charcoal-700 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'captures' && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: `All (${totalSubscribers})` },
            { key: 'unpromoted', label: `Needs promotion (${unpromotedConsentedCount})` },
            { key: 'promoted', label: `Promoted (${promotedCount})` },
            { key: 'no-consent', label: `No consent (${captures?.filter(c => !c.consented).length || 0})` }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => updateView({ tab: 'captures', filter: filter.key })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                captureFilter === filter.key
                  ? 'bg-gold-500 text-charcoal-950'
                  : 'bg-charcoal-800 text-gray-400 hover:bg-charcoal-700 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Pane */}
      {activeTab === 'customers' ? (
        <div className="card p-0 bg-charcoal-800 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 bg-charcoal-900/50 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white">Promoted warm customer base</h3>
            <span className="text-xs font-mono text-gray-500">Source: orders & promoted captures</span>
          </div>

          {!customers || filteredCustomers.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-20 text-gold-400" />
              <p className="text-lg font-bold text-white mb-1">
                {customers?.length ? 'No customers match this filter' : 'No customers found'}
              </p>
              <p className="text-sm max-w-sm mx-auto">
                {customers?.length
                  ? 'Use another status filter to inspect the rest of the warm customer list.'
                  : 'Customer contacts will appear here when you import order history or promote consented website captures.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-charcoal-900/30 text-xs text-gray-500 font-mono uppercase">
                    <th className="px-6 py-4 font-semibold">Customer Email</th>
                    <th className="px-6 py-4 font-semibold">First Name</th>
                    <th className="px-6 py-4 font-semibold">Location</th>
                    <th className="px-6 py-4 font-semibold">Orders / Spent</th>
                    <th className="px-6 py-4 font-semibold">Source</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredCustomers.map((c) => {
                    const isRecordingOrder = recordOrderMutation.isPending && recordOrderMutation.variables?.customer?.id === c.id;
                    return (
                    <tr key={c.id} className="group hover:bg-white/[0.02] transition-colors duration-150">
                      <td className="px-6 py-4 text-white font-medium flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-charcoal-700/50 flex items-center justify-center text-gold-400 group-hover:bg-gold-500/10 group-hover:text-gold-300 transition-colors">
                          <Mail size={14} />
                        </div>
                        <span className="truncate max-w-xs">{c.email}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-300 font-medium">{c.first_name || '-'}</td>
                      <td className="px-6 py-4 text-gray-400">
                        {c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-300 font-mono">
                        <span className="font-bold text-white">{c.order_count || 0}</span> orders
                        {c.total_spent > 0 && <span className="text-emerald-400 ml-1.5 font-bold">${Number(c.total_spent).toFixed(2)}</span>}
                        <span className="mt-1 block text-xs text-gray-500">
                          {c.last_order_at ? `Last ${c.last_order_at.slice(0, 10)}` : Number(c.order_count || 0) > 0 ? 'Last order unknown' : 'No orders logged'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs capitalize">{c.source || 'order'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          statusFor(c) === 'active'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/10'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/10'
                        }`}>
                          {statusFor(c)}
                        </span>
                        {isReorderDue(c) && (
                          <span className="mt-1 block text-xs font-semibold text-amber-300">reorder due</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRecordOrder(c)}
                          disabled={isRecordingOrder}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-charcoal-950 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Record a new customer order"
                        >
                          {isRecordingOrder ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                          Record Order
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-0 bg-charcoal-800 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 bg-charcoal-900/50 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white">Raw exit-intent pop-up captures</h3>
            <span className="text-xs font-mono text-gray-500">Source: connected website capture form</span>
          </div>

          {!captures || filteredCaptures.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-20 text-gold-400 animate-pulse" />
              <p className="text-lg font-bold text-white mb-1">
                {captures?.length ? 'No captures match this filter' : 'No popup captures recorded'}
              </p>
              <p className="text-sm max-w-sm mx-auto">
                {captures?.length
                  ? 'Use another status filter to inspect the rest of the capture list.'
                  : 'Opt-in signups from your storefront exit-intent widget will populate here in real-time.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-charcoal-900/30 text-xs text-gray-500 font-mono uppercase">
                    <th className="px-6 py-4 font-semibold">Opt-in Email</th>
                    <th className="px-6 py-4 font-semibold">Offer Displayed</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Consented</th>
                    <th className="px-6 py-4 font-semibold">Captured Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredCaptures.map((cap) => {
                    const canPromote = cap.consented && !cap.promoted;
                    const isPromoting = promoteCaptureMutation.isPending && promoteCaptureMutation.variables?.id === cap.id;
                    return (
                    <tr key={cap.id} className="group hover:bg-white/[0.02] transition-colors duration-150">
                      <td className="px-6 py-4 text-white font-medium flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-charcoal-700/50 flex items-center justify-center text-gold-400 group-hover:bg-gold-500/10 group-hover:text-gold-300 transition-colors">
                          <Mail size={14} />
                        </div>
                        <span className="truncate max-w-xs">{cap.email}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{cap.offer_shown || 'No offer recorded'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          cap.promoted
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                        }`}>
                          {cap.promoted ? 'Promoted to Customer' : 'Raw Lead'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          cap.consented
                            ? 'bg-green-500/10 text-green-400 border border-green-500/10'
                            : 'bg-red-500/10 text-red-400 border border-red-500/10'
                        }`}>
                          {cap.consented ? 'Opted In' : 'No Consent'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-gray-500" />
                          {new Date(cap.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => promoteCaptureMutation.mutate(cap)}
                          disabled={!canPromote || isPromoting}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gold-500/20 bg-gold-500/10 px-3 py-2 text-xs font-bold text-gold-300 transition-colors hover:bg-gold-500 hover:text-charcoal-950 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5 disabled:text-gray-500"
                          title={cap.promoted ? 'Already promoted' : cap.consented ? 'Promote to customer' : 'Consent required before promotion'}
                        >
                          {isPromoting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          {cap.promoted ? 'Promoted' : 'Promote'}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
