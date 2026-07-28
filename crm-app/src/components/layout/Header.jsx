import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Gauge, LogOut, Plus, Search, TrendingUp } from 'lucide-react';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';

export default function Header() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchValue, setSearchValue] = useState('');
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const { data: commandCenter } = useQuery({
        queryKey: ['dashboard-command-center'],
        queryFn: () => dashboardService.getCommandCenter(),
        staleTime: 60_000
    });

    const alertItems = commandCenter?.dailyPlan?.filter((item) => item.status !== 'ready' || item.value > 0).slice(0, 4) || [];
    const alertValueCount = alertItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const notificationCount = alertValueCount || alertItems.length;
    const notificationLabel = notificationCount > 0
        ? `${notificationCount} business alert${notificationCount === 1 ? '' : 's'}`
        : 'Open tasks';
    const operatingStatus = commandCenter?.scorecard?.operatingStatus || 'unknown';
    const forecastStatus = commandCenter?.growthForecast?.status || 'unknown';
    const statusTone = {
        healthy: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
        opportunity: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
        watch: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        busy: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        blocked: 'border-red-500/20 bg-red-500/10 text-red-300',
        'needs-attention': 'border-red-500/20 bg-red-500/10 text-red-300',
        unknown: 'border-white/10 bg-white/[0.03] text-gray-300'
    };

    const openPath = (path) => {
        setIsAlertsOpen(false);
        navigate(path);
    };

    const handleSearch = (event) => {
        event.preventDefault();
        const query = searchValue.trim();
        if (!query) {
            navigate('/leads');
            return;
        }
        navigate(`/leads?search=${encodeURIComponent(query)}`);
    };

    const handleSignOut = async () => {
        try {
            await authService.signOut();
            queryClient.clear();
            navigate('/', { replace: true });
            toast.success('Signed out');
        } catch (error) {
            toast.error(error.message || 'Could not sign out');
        }
    };

    return (
        <header className="h-16 bg-charcoal-900/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between gap-3 px-3 md:px-6 sticky top-0 z-30">
            {/* Search Bar */}
            <div className="flex-1 min-w-0 max-w-xl">
                <form onSubmit={handleSearch} className="relative group">
                    <button
                        type="submit"
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 transition-colors hover:text-gold-300 group-focus-within:text-gold-400"
                        title="Search leads"
                        aria-label="Search leads"
                    >
                        <Search size={18} />
                    </button>
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder="Search leads..."
                        className="w-full bg-charcoal-800 border border-white/5 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold-500/30 focus:bg-charcoal-800 transition-all placeholder-gray-600"
                    />
                </form>
            </div>

            {/* Right Actions */}
            <div className="flex shrink-0 items-center gap-2 md:gap-4">
                <div className="relative">
                    <button
                        onClick={() => setIsAlertsOpen((open) => !open)}
                        className="relative p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full"
                        title={notificationLabel}
                        aria-label={notificationLabel}
                        aria-expanded={isAlertsOpen}
                    >
                        <Bell size={20} />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-gold-500 px-1.5 text-[11px] font-bold leading-5 text-charcoal-950">
                                {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                        )}
                    </button>

                    {isAlertsOpen && (
                        <div className="absolute right-0 top-12 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-white/10 bg-charcoal-900 shadow-2xl">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Business Alerts</p>
                                    <p className="text-xs text-gray-500">{notificationLabel}</p>
                                </div>
                                <button
                                    onClick={() => openPath('/')}
                                    className="text-xs font-medium text-gold-300 hover:text-gold-200"
                                >
                                    Dashboard
                                </button>
                            </div>

                            {commandCenter && (
                                <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3">
                                    <button
                                        onClick={() => openPath('/')}
                                        className={`rounded-md border px-3 py-2 text-left ${statusTone[operatingStatus] || statusTone.unknown}`}
                                    >
                                        <span className="flex items-center gap-2 text-xs uppercase tracking-wider">
                                            <Gauge size={13} />
                                            Score
                                        </span>
                                        <span className="mt-1 block text-lg font-bold text-white">
                                            {commandCenter.scorecard?.operatingScore ?? '-'}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => openPath('/')}
                                        className={`rounded-md border px-3 py-2 text-left ${statusTone[forecastStatus] || statusTone.unknown}`}
                                    >
                                        <span className="flex items-center gap-2 text-xs uppercase tracking-wider">
                                            <TrendingUp size={13} />
                                            7d Forecast
                                        </span>
                                        <span className="mt-1 block text-sm font-semibold capitalize text-white">
                                            {forecastStatus.replace('-', ' ')}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-gray-400">
                                            {(commandCenter.growthForecast?.expectedTouchpoints || 0).toLocaleString()} touches
                                        </span>
                                    </button>
                                </div>
                            )}

                            {alertItems.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {alertItems.map((item) => {
                                        const isBlocked = item.status === 'blocked';
                                        return (
                                            <button
                                                key={`${item.rank}-${item.label}`}
                                                onClick={() => openPath(item.path)}
                                                className="grid w-full grid-cols-[32px_minmax(0,1fr)_16px] items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
                                            >
                                                <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border ${
                                                    isBlocked
                                                        ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                                        : 'border-gold-500/20 bg-gold-500/10 text-gold-300'
                                                }`}>
                                                    <AlertTriangle size={16} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-white">{item.label}</span>
                                                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-gray-400">{item.detail}</span>
                                                </span>
                                                <ArrowRight size={15} className="mt-2 text-gray-500" />
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 px-4 py-4 text-sm text-emerald-300">
                                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold">No urgent alerts</p>
                                        <p className="mt-1 text-xs leading-5 text-emerald-300/70">Follow-ups, tasks, captures, and outreach blockers look clear.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="hidden sm:block w-px h-6 bg-white/10 mx-2"></div>

                <button
                    onClick={() => navigate('/leads?new=1')}
                    className="hidden sm:flex btn-primary text-sm py-1.5 px-3"
                >
                    <Plus size={16} />
                    <span>New Lead</span>
                </button>

                <button
                    onClick={handleSignOut}
                    className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full"
                    title="Sign out"
                    aria-label="Sign out"
                >
                    <LogOut size={19} />
                </button>
            </div>
        </header>
    );
}
