import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { AlertCircle, Loader2, TrendingUp, Users, Phone, CheckSquare, Download } from 'lucide-react';
import CallsOverTimeChart from '../components/charts/CallsOverTimeChart';
import LeadsByStageChart from '../components/charts/LeadsByStageChart';
import LeadsByStateChart from '../components/charts/LeadsByStateChart';

function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function buildReport({ stats, callsData, stageData, stateData }) {
    const date = new Date().toLocaleString();
    const calls = callsData || [];
    const stages = stageData || [];
    const states = stateData || [];

    return [
        '# CRM Report',
        '',
        `Generated: ${date}`,
        '',
        '## Summary',
        `- Total leads: ${stats?.totalLeads || 0}`,
        `- Calls today: ${stats?.callsToday || 0}`,
        `- Calls this month: ${stats?.callsThisMonth || 0}`,
        `- Open tasks: ${stats?.openTasks || 0}`,
        '',
        '## Calls Over Time',
        ...calls.map((row) => `- ${row.date}: ${row.count || 0}`),
        '',
        '## Leads By Stage',
        ...stages.map((row) => `- ${row.name || 'Unknown'}: ${row.count || 0}`),
        '',
        '## Top States',
        ...states.map((row) => `- ${row.name || 'Unknown'}: ${row.count || 0}`)
    ].join('\n');
}

export default function Reports() {
    const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => dashboardService.getDashboardStats()
    });

    const { data: callsData, error: callsError } = useQuery({
        queryKey: ['calls-over-time'],
        queryFn: () => dashboardService.getCallsOverTime(30)
    });

    const { data: stageData, error: stageError } = useQuery({
        queryKey: ['leads-by-stage'],
        queryFn: () => dashboardService.getLeadStageStats()
    });

    const { data: stateData, error: stateError } = useQuery({
        queryKey: ['leads-by-state'],
        queryFn: () => dashboardService.getLeadsByState()
    });

    if (statsLoading) {
        return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>;
    }

    const error = statsError || callsError || stageError || stateError;

    const handleExportReport = () => {
        const content = buildReport({ stats, callsData, stageData, stateData });
        const date = new Date().toISOString().slice(0, 10);
        downloadTextFile(`crm-report-${date}.md`, content);
    };

    if (error) {
        return (
            <div className="card p-8 text-center max-w-xl mx-auto mt-12 border border-red-500/20 bg-charcoal-900/50">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Reports failed to load</h3>
                <p className="text-gray-400 text-sm">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Reports</h1>
                    <p className="text-gray-400 mt-1">Analytics and performance overview.</p>
                </div>
                <button onClick={handleExportReport} className="btn-secondary w-full sm:w-auto">
                    <Download size={16} />
                    Export Report
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gold-500/10 flex items-center justify-center"><Users className="text-gold-400" size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400">Total Leads</p>
                        <p className="text-2xl font-bold text-white">{stats?.totalLeads || 0}</p>
                    </div>
                </div>
                <div className="card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center"><Phone className="text-green-400" size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400">Calls Today</p>
                        <p className="text-2xl font-bold text-white">{stats?.callsToday || 0}</p>
                    </div>
                </div>
                <div className="card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="text-blue-400" size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400">Calls This Month</p>
                        <p className="text-2xl font-bold text-white">{stats?.callsThisMonth || 0}</p>
                    </div>
                </div>
                <div className="card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center"><CheckSquare className="text-purple-400" size={24} /></div>
                    <div>
                        <p className="text-sm text-gray-400">Open Tasks</p>
                        <p className="text-2xl font-bold text-white">{stats?.openTasks || 0}</p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="text-lg font-bold text-white mb-4">Calls Over Time (30 Days)</h3>
                    <div className="h-64"><CallsOverTimeChart data={callsData} /></div>
                </div>
                <div className="card">
                    <h3 className="text-lg font-bold text-white mb-4">Leads by Stage</h3>
                    <div className="h-64"><LeadsByStageChart data={stageData} /></div>
                </div>
            </div>

            <div className="card">
                <h3 className="text-lg font-bold text-white mb-4">Top States</h3>
                <div className="h-64"><LeadsByStateChart data={stateData} /></div>
            </div>
        </div>
    );
}
