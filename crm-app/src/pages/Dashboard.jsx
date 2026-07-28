import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { dashboardService } from '../services/dashboardService';
import { settingsService } from '../services/settingsService';
import StatsCards from '../components/dashboard/StatsCards';
import RecentActivity from '../components/dashboard/RecentActivity';
import CallsOverTimeChart from '../components/charts/CallsOverTimeChart';
import LeadsByStageChart from '../components/charts/LeadsByStageChart';
import LeadsByStateChart from '../components/charts/LeadsByStateChart';
import {
  RefreshCw, Download, Loader2, AlertTriangle, ArrowRight, CalendarClock,
  CheckCircle2, ClipboardList, Clock3, DollarSign, Gauge, Mail, Phone, Radio, Repeat2, ShieldAlert, Target, Users, MapPin, TrendingUp
} from 'lucide-react';

const toneClasses = {
  danger: 'border-red-500/25 bg-red-500/10 text-red-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  good: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  neutral: 'border-white/10 bg-white/[0.03] text-gray-300'
};

function formatValue(value) {
  return typeof value === 'number' ? value.toLocaleString() : value || '-';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function downloadTextFile(filename, content, type = 'text/markdown') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error) {
  return error?.message || 'The data source did not respond.';
}

function buildDashboardReport({ commandCenter, priorityWorklist, dashboardStats, userName }) {
  const date = new Date();
  const reportDate = date.toLocaleString();
  const lines = [
    '# Business Status Report',
    '',
    `Generated: ${reportDate}`,
    `Owner: ${userName || 'User'}`,
    '',
    '## KPIs',
    '',
    `- Total leads: ${formatValue(commandCenter.kpis.totalLeads)}`,
    `- Hot leads: ${formatValue(commandCenter.kpis.hotLeads)}`,
    `- Customers: ${formatValue(commandCenter.kpis.customers)}`,
    `- Captures: ${formatValue(commandCenter.kpis.captures)}`,
    `- Calls today: ${formatValue(dashboardStats?.callsToday)}`,
    `- Calls this month: ${formatValue(dashboardStats?.callsThisMonth)}`,
    `- Open tasks: ${formatValue(commandCenter.queue.openTasks)}`,
    '',
    '## Operating Scorecard',
    '',
    `- Operating score: ${formatValue(commandCenter.scorecard?.operatingScore)}/100 (${commandCenter.scorecard?.operatingStatus || 'unknown'})`,
    `- Launch readiness: ${formatValue(commandCenter.scorecard?.launchReadinessRate)}%`,
    `- Contact completeness: ${formatValue(commandCenter.scorecard?.contactCompletenessRate)}%`,
    `- Outreach reply rate 7d: ${formatPercent(commandCenter.scorecard?.outreachReplyRate7d)}`,
    `- Urgent work items: ${formatValue(commandCenter.scorecard?.urgentWorkItems)}`,
    `- Estimated reorder opportunity: ${formatCurrency(commandCenter.scorecard?.estimatedReorderOpportunity || 0)}`,
    ...(commandCenter.scorecard?.scoreDrivers?.length ? [
      '',
      'Drivers:',
      ...commandCenter.scorecard.scoreDrivers.map((driver) => `- ${driver}`)
    ] : []),
    '',
    '## Growth Forecast',
    '',
    `- Next 7 day work items: ${formatValue(commandCenter.growthForecast?.workItems)}`,
    `- Lead follow-ups due by 7 days: ${formatValue(commandCenter.growthForecast?.followups?.total)} (${formatValue(commandCenter.growthForecast?.followups?.overdue)} overdue, ${formatValue(commandCenter.growthForecast?.followups?.today)} today, ${formatValue(commandCenter.growthForecast?.followups?.upcoming)} upcoming)`,
    `- Tasks due by 7 days: ${formatValue(commandCenter.growthForecast?.tasks?.total)} (${formatValue(commandCenter.growthForecast?.tasks?.overdue)} overdue, ${formatValue(commandCenter.growthForecast?.tasks?.today)} today, ${formatValue(commandCenter.growthForecast?.tasks?.upcoming)} upcoming)`,
    `- Expected touchpoints: ${formatValue(commandCenter.growthForecast?.expectedTouchpoints)}`,
    `- Ready outreach: ${formatValue(commandCenter.growthForecast?.readyOutreach)}`,
    `- Hot lead count: ${formatValue(commandCenter.growthForecast?.hotLeadCount)}`,
    `- Reorder opportunity: ${formatCurrency(commandCenter.growthForecast?.reorderOpportunity || 0)}`,
    `- Forecast status: ${commandCenter.growthForecast?.status || 'unknown'}`,
    '',
    '## Daily Operating Plan',
    '',
    ...(commandCenter.dailyPlan || []).map((item) => (
      `${item.rank}. ${item.label} - ${item.detail} (${formatValue(item.value)})`
    )),
    '',
    '## Launch Readiness',
    '',
    ...(commandCenter.launchChecklist || []).map((item) => (
      `- ${item.status.toUpperCase()}: ${item.label} - ${item.detail}`
    )),
    '',
    '## Marketing Pulse',
    '',
    `- Queued outreach: ${formatValue(commandCenter.marketing.queuedOutreach)}`,
    `- Personalized emails ready: ${formatValue(commandCenter.marketing.personalizedOutreach)}`,
    `- Sent last 7 days: ${formatValue(commandCenter.marketing.sentThisWeek)}`,
    `- Replies last 7 days: ${formatValue(commandCenter.marketing.repliesThisWeek)}`,
    `- Replies needing review: ${formatValue(commandCenter.marketing.replyReviewTasks)}`,
    `- Suppression list: ${formatValue(commandCenter.marketing.suppressionCount)}`,
    `- Missing campaign IDs: ${formatValue(commandCenter.marketing.missingCampaigns)}`,
    '',
    '## Segment Health',
    '',
    ...(commandCenter.segmentHealth?.available
      ? (commandCenter.segmentHealth.segments?.length
        ? commandCenter.segmentHealth.segments.map((segment) => (
          `- ${segment.status.toUpperCase()}: ${segment.name} - ready ${formatValue(segment.ready)}, sent ${formatValue(segment.sent)}, reply ${formatPercent(segment.replyRate)}, positive ${formatPercent(segment.positiveRate)}`
        ))
        : ['No outreach segments found.'])
      : [`Unavailable: ${commandCenter.segmentHealth?.error || 'Automation tables were not readable.'}`]),
    '',
    '## Revenue & Retention',
    '',
    `- Active customer revenue: ${formatCurrency(commandCenter.commerce?.totalRevenue || 0)}`,
    `- Repeat customers: ${formatValue(commandCenter.commerce?.repeatCustomers || 0)}`,
    `- Customers due for reorder: ${formatValue(commandCenter.commerce?.reorderDue || 0)}`,
    `- Average revenue per active customer: ${formatCurrency(commandCenter.commerce?.averageRevenuePerActiveCustomer || 0)}`,
    ...(commandCenter.commerce?.topCustomers?.length ? [
      '',
      'Top customers:',
      ...commandCenter.commerce.topCustomers.map((customer) => (
        `- ${customer.name}: ${formatCurrency(customer.totalSpent)} across ${formatValue(customer.orderCount)} order${customer.orderCount === 1 ? '' : 's'}`
      ))
    ] : []),
    '',
    '## Data Health',
    '',
    ...(commandCenter.health || []).map((item) => (
      `- ${item.severity.toUpperCase()}: ${item.label} - ${formatValue(item.value)}`
    )),
    '',
    '## Data Freshness',
    '',
    ...(commandCenter.freshness || []).map((item) => (
      `- ${item.severity.toUpperCase()}: ${item.label} - ${item.detail}`
    )),
    '',
    '## Priority Worklist',
    '',
    ...(priorityWorklist?.length ? priorityWorklist.map((item, index) => (
      `${index + 1}. ${item.businessName} - ${item.action} - ${item.reasons.join(' + ')} - ${item.path}`
    )) : ['Nothing urgent in the worklist.']),
    '',
    '## Quick Links',
    '',
    '- Dashboard: /',
    '- Leads missing contact: /leads?contact=missing',
    '- Leads missing follow-up: /leads?followup=none',
    '- Lead follow-ups due by 7 days: /leads?followup=next7',
    '- Tasks due by 7 days: /tasks?filter=next7',
    '- Reorder customers: /customers?customerFilter=reorder_due',
    '- Warm captures to promote: /customers?tab=captures&filter=unpromoted',
    '- Outreach: /outreach',
    '- Customers and captures: /customers',
    ''
  ];

  return lines.join('\n');
}

function MetricStrip({ command }) {
  const metrics = [
    { label: 'Total leads', value: command.kpis.totalLeads, icon: Users },
    { label: 'Hot leads', value: command.kpis.hotLeads, icon: Target },
    { label: 'Customers', value: command.kpis.customers, icon: CheckCircle2 },
    { label: 'Captures', value: command.kpis.captures, icon: Mail }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map(({ label, value, icon }) => {
        const TileIcon = icon;
        return (
          <div key={label} className="border border-white/10 bg-charcoal-800 rounded-lg p-4 min-h-24">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
              <TileIcon size={17} className="text-gold-300" />
            </div>
            <p className="text-2xl font-bold text-white mt-3">{formatNumber(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function OperatingScorecard({ scorecard }) {
  const statusTone = {
    healthy: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
    watch: 'text-amber-300 border-amber-500/20 bg-amber-500/10',
    'needs-attention': 'text-red-300 border-red-500/20 bg-red-500/10'
  }[scorecard.operatingStatus] || toneClasses.neutral;

  const rows = [
    { label: 'Launch readiness', value: `${scorecard.launchReadinessRate}%`, icon: Target },
    { label: 'Contact completeness', value: `${scorecard.contactCompletenessRate}%`, icon: Users },
    { label: 'Reply rate 7d', value: formatPercent(scorecard.outreachReplyRate7d), icon: Mail },
    { label: 'Urgent work', value: scorecard.urgentWorkItems, icon: ClipboardList },
    { label: 'Reorder opportunity', value: formatCurrency(scorecard.estimatedReorderOpportunity), icon: Repeat2 }
  ];

  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border ${statusTone}`}>
            <div className="text-center">
              <p className="text-2xl font-bold leading-none text-white">{scorecard.operatingScore}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-400">score</p>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Gauge size={18} className="text-gold-300" />
              <h2 className="text-lg font-bold">Operating Scorecard</h2>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {scorecard.operatingStatus === 'healthy'
                ? 'Core growth systems are moving.'
                : scorecard.operatingStatus === 'watch'
                  ? 'A few lanes need attention today.'
                  : 'Fix blockers before scaling more outreach.'}
            </p>
            {scorecard.scoreDrivers?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {scorecard.scoreDrivers.slice(0, 4).map((driver) => (
                  <span key={driver} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-gray-300">
                    {driver}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 xl:flex-1">
          {rows.map(({ label, value, icon }) => {
            const RowIcon = icon;
            return (
              <div key={label} className="rounded-md border border-white/5 bg-white/[0.02] p-3 min-h-20">
                <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider">
                  <span>{label}</span>
                  <RowIcon size={14} />
                </div>
                <p className="mt-2 text-lg font-bold text-white">{formatValue(value)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GrowthForecast({ forecast }) {
  const followups = forecast.followups || {};
  const tasks = forecast.tasks || {};
  const statusTone = {
    blocked: toneClasses.danger,
    busy: toneClasses.warning,
    opportunity: toneClasses.good,
    steady: toneClasses.neutral
  }[forecast.status] || toneClasses.neutral;

  const rows = [
    {
      label: '7d follow-ups',
      value: followups.total,
      detail: `${formatNumber(followups.overdue)} overdue, ${formatNumber(followups.today)} today, ${formatNumber(followups.upcoming)} upcoming`,
      icon: ClipboardList,
      path: '/leads?followup=next7'
    },
    {
      label: '7d tasks',
      value: tasks.total,
      detail: `${formatNumber(tasks.overdue)} overdue, ${formatNumber(tasks.today)} today, ${formatNumber(tasks.upcoming)} upcoming`,
      icon: CalendarClock,
      path: '/tasks?filter=next7'
    },
    {
      label: 'Touchpoints',
      value: forecast.expectedTouchpoints,
      detail: 'Work, outreach, and reorder touches',
      icon: Target,
      path: '/leads'
    },
    {
      label: 'Ready outreach',
      value: forecast.readyOutreach,
      detail: 'Queued or personalized emails',
      icon: Mail,
      path: '/outreach'
    },
    {
      label: 'Hot leads',
      value: forecast.hotLeadCount,
      detail: 'Interested, qualified, or samples sent',
      icon: Users,
      path: '/leads?stage=hot'
    },
    {
      label: 'Reorder upside',
      value: formatCurrency(forecast.reorderOpportunity),
      detail: `${formatNumber(forecast.reorderCustomers)} customer${forecast.reorderCustomers === 1 ? '' : 's'} due`,
      icon: DollarSign,
      path: '/customers?customerFilter=reorder_due'
    }
  ];

  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gold-300" />
            <h2 className="text-lg font-bold">Growth Forecast</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">Next 7 days of work pressure, outreach, and revenue upside.</p>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs uppercase tracking-wider ${statusTone}`}>
          {(forecast.status || 'steady').replace('-', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        {rows.map(({ label, value, detail, icon, path }) => {
          const RowIcon = icon;
          return (
            <Link key={label} to={path} className="rounded-md border border-white/5 bg-white/[0.02] p-3 min-h-28 transition hover:bg-white/[0.04]">
              <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider">
                <span>{label}</span>
                <RowIcon size={14} />
              </div>
              <p className="mt-2 text-xl font-bold text-white">{formatValue(value)}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ActionQueue({ actions }) {
  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-gold-300" />
          <h2 className="text-lg font-bold">Today Queue</h2>
        </div>
        <span className="text-xs text-gray-500">ranked by urgency</span>
      </div>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.path}
            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition hover:bg-white/[0.04] ${toneClasses[action.tone] || toneClasses.neutral}`}
          >
            <span className="text-sm font-medium">{action.label}</span>
            <span className="flex items-center gap-2 font-mono text-sm">
              {formatNumber(action.value)}
              <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MarketingStatus({ marketing }) {
  const replyRate = marketing.sentThisWeek > 0 ? `${((marketing.repliesThisWeek / marketing.sentThisWeek) * 100).toFixed(1)}%` : '-';
  const rows = [
    { label: 'Queued', value: marketing.queuedOutreach, icon: Radio },
    { label: 'Ready', value: marketing.personalizedOutreach, icon: Mail },
    { label: 'Sent 7d', value: marketing.sentThisWeek, icon: CalendarClock },
    { label: 'Reply rate 7d', value: replyRate, icon: Target },
    { label: 'Review replies', value: marketing.replyReviewTasks, icon: AlertTriangle }
  ];

  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-gold-300" />
          <h2 className="text-lg font-bold">Marketing Pulse</h2>
        </div>
        <span className="text-xs text-gray-500">{formatNumber(marketing.suppressionCount)} suppressed</span>
      </div>
      {!marketing.outreachAvailable && (
        <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {marketing.outreachErrorCount || 1} outreach metric source{marketing.outreachErrorCount === 1 ? '' : 's'} unavailable
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(({ label, value, icon }) => {
          const RowIcon = icon;
          return (
            <div key={label} className="rounded-md border border-white/5 bg-white/[0.02] p-3 min-h-20">
              <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider">
                <span>{label}</span>
                <RowIcon size={14} />
              </div>
              <p className="text-xl font-bold text-white mt-2">{formatValue(value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SegmentHealthPanel({ segmentHealth }) {
  if (!segmentHealth?.available) {
    return (
      <div className="border border-red-500/25 bg-red-500/10 rounded-lg p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-red-300" />
              <h2 className="text-lg font-bold text-white">Segment Health</h2>
            </div>
            <p className="mt-2 text-sm text-red-200/80">{segmentHealth?.error || 'Automation tables were not readable.'}</p>
          </div>
          <Link to="/outreach" className="btn-secondary shrink-0 text-xs">
            Open Outreach
          </Link>
        </div>
      </div>
    );
  }

  const segments = segmentHealth.segments || [];
  const summary = [
    { label: 'Blocked', value: segmentHealth.blocked, tone: 'danger' },
    { label: 'Ready', value: segmentHealth.ready, tone: 'good' },
    { label: 'Measuring', value: segmentHealth.measuring, tone: 'warning' }
  ];

  const statusTone = {
    blocked: toneClasses.danger,
    ready: toneClasses.good,
    measuring: toneClasses.warning,
    idle: toneClasses.neutral,
    paused: 'border-gray-500/20 bg-gray-500/10 text-gray-300'
  };

  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-gold-300" />
            <h2 className="text-lg font-bold">Segment Health</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">Audience lanes, campaign blockers, and reply quality.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.map((item) => (
            <span key={item.label} className={`rounded-md border px-2.5 py-1 text-xs ${toneClasses[item.tone]}`}>
              {item.label}: {formatNumber(item.value)}
            </span>
          ))}
          <Link to="/outreach" className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-gold-300 hover:bg-white/[0.06]">
            Details
          </Link>
        </div>
      </div>

      {segments.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
          {segments.slice(0, 8).map((segment) => (
            <Link key={segment.id} to="/outreach" className={`rounded-md border p-3 min-h-36 transition hover:bg-white/[0.04] ${statusTone[segment.status] || toneClasses.neutral}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{segment.name}</p>
                  <p className="mt-1 text-xs capitalize text-gray-500">{segment.audience} audience</p>
                </div>
                <span className="rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] uppercase tracking-wider text-gray-300">
                  {segment.status.replace('-', ' ')}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-500 uppercase tracking-wider">Ready</p>
                  <p className="mt-1 font-mono text-white">{formatNumber(segment.ready)}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase tracking-wider">Sent</p>
                  <p className="mt-1 font-mono text-white">{formatNumber(segment.sent)}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase tracking-wider">Reply</p>
                  <p className="mt-1 font-mono text-white">{formatPercent(segment.replyRate)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>{formatNumber(segment.positive)} positive</span>
                <span>{formatPercent(segment.openRate)} open</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
          No outreach segments found.
        </div>
      )}
    </div>
  );
}

function RevenueRetention({ commerce }) {
  const rows = [
    { label: 'Customer revenue', value: formatCurrency(commerce.totalRevenue), icon: DollarSign },
    { label: 'Repeat customers', value: commerce.repeatCustomers, icon: Repeat2 },
    { label: 'Reorder due', value: commerce.reorderDue, icon: CalendarClock },
    { label: 'Avg/customer', value: formatCurrency(commerce.averageRevenuePerActiveCustomer), icon: Users }
  ];

  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-gold-300" />
          <h2 className="text-lg font-bold">Revenue & Retention</h2>
        </div>
        <Link to="/customers?customerFilter=reorder_due" className="text-xs text-gold-300 hover:text-gold-200">
          Reorder list
        </Link>
      </div>
      {!commerce.available && (
        <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {commerce.error || 'Customer revenue source unavailable'}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(({ label, value, icon }) => {
          const RowIcon = icon;
          return (
            <div key={label} className="rounded-md border border-white/5 bg-white/[0.02] p-3 min-h-20">
              <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider">
                <span>{label}</span>
                <RowIcon size={14} />
              </div>
              <p className="text-xl font-bold text-white mt-2">{formatValue(value)}</p>
            </div>
          );
        })}
      </div>
      {commerce.topCustomers?.length > 0 && (
        <div className="mt-4 divide-y divide-white/5">
          {commerce.topCustomers.slice(0, 3).map((customer) => (
            <div key={customer.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{customer.name}</p>
                <p className="truncate text-xs text-gray-500">{customer.email}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-emerald-300">{formatCurrency(customer.totalSpent)}</p>
                <p className="text-xs text-gray-500">{customer.orderCount} order{customer.orderCount === 1 ? '' : 's'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPanel({ items }) {
  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert size={18} className="text-gold-300" />
        <h2 className="text-lg font-bold">Data Health</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.severity === 'good' ? CheckCircle2 : AlertTriangle;
          return (
            <Link key={item.label} to={item.path} className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04]">
              <span className="flex min-w-0 items-start gap-2 text-sm text-gray-300">
                <Icon size={15} className={`mt-0.5 shrink-0 ${item.severity === 'good' ? 'text-emerald-400' : item.severity === 'danger' ? 'text-red-400' : 'text-amber-400'}`} />
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  {item.detail && <span className="mt-0.5 block truncate text-xs text-gray-500">{item.detail}</span>}
                </span>
              </span>
              <span className="font-mono text-sm text-white">{formatNumber(item.value)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DataFreshness({ items }) {
  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock3 size={18} className="text-gold-300" />
        <h2 className="text-lg font-bold">Data Freshness</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.severity === 'good' ? CheckCircle2 : AlertTriangle;
          return (
            <Link key={item.label} to={item.path} className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04]">
              <span className="flex min-w-0 items-start gap-2 text-sm text-gray-300">
                <Icon size={15} className={`mt-0.5 shrink-0 ${item.severity === 'good' ? 'text-emerald-400' : item.severity === 'danger' ? 'text-red-400' : 'text-amber-400'}`} />
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">{item.detail}</span>
                </span>
              </span>
              <span className="font-mono text-xs text-gray-400">{item.ageDays === null ? '-' : `${item.ageDays}d`}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DashboardError({ title, error, onRetry, minHeight = 'min-h-32' }) {
  return (
    <div className={`rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-red-100 ${minHeight}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={17} className="shrink-0 text-red-300" />
            <p className="font-semibold">{title}</p>
          </div>
          <p className="mt-2 break-words text-sm text-red-200/80">{getErrorMessage(error)}</p>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="btn-secondary shrink-0 text-xs">
            <RefreshCw size={14} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

function LaunchReadiness({ items }) {
  const readyCount = items.filter((item) => item.status === 'ready').length;
  const blockedCount = items.filter((item) => item.status === 'blocked').length;
  const progress = items.length ? Math.round((readyCount / items.length) * 100) : 0;

  const statusCopy = blockedCount > 0
    ? `${blockedCount} blocker${blockedCount === 1 ? '' : 's'}`
    : `${progress}% ready`;

  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-gold-300" />
            <h2 className="text-lg font-bold">Launch Readiness</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">Marketing, data, and follow-up blockers in one place.</p>
        </div>
        <div className="min-w-36">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{readyCount}/{items.length} ready</span>
            <span>{statusCopy}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gold-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((item) => {
          const isReady = item.status === 'ready';
          const isBlocked = item.status === 'blocked';
          const Icon = isReady ? CheckCircle2 : AlertTriangle;
          const tone = isReady ? toneClasses.good : isBlocked ? toneClasses.danger : toneClasses.warning;

          return (
            <Link key={item.label} to={item.path} className={`rounded-md border p-3 min-h-28 transition hover:bg-white/[0.04] ${tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-5">{item.detail}</p>
                </div>
                <Icon size={16} className={isReady ? 'text-emerald-300' : isBlocked ? 'text-red-300' : 'text-amber-300'} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="uppercase tracking-wider text-gray-500">{isReady ? 'Ready' : isBlocked ? 'Blocked' : 'Needs cleanup'}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DailyOperatingPlan({ items }) {
  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-gold-300" />
            <h2 className="text-lg font-bold">Daily Operating Plan</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">The highest-leverage order for today.</p>
        </div>
        <span className="text-xs text-gray-500">{items.length} focus lanes</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        {items.map((item) => {
          const isBlocked = item.status === 'blocked';
          const isReady = item.status === 'ready';
          const tone = isBlocked ? toneClasses.danger : isReady ? toneClasses.good : toneClasses.warning;

          return (
            <Link key={item.label} to={item.path} className={`rounded-md border p-3 min-h-36 transition hover:bg-white/[0.04] ${tone}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/20 font-mono text-xs text-white">
                  {item.rank}
                </span>
                <span className="font-mono text-xs text-gray-400">{formatNumber(item.value)}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-white leading-5">{item.label}</p>
              <p className="mt-2 text-xs text-gray-400 leading-5">{item.detail}</p>
              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-wider text-gray-500">
                <span>{isBlocked ? 'Fix first' : isReady ? 'Ready' : 'Do next'}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PriorityWorklist({ items, isLoading, error, onRetry }) {
  return (
    <div className="border border-white/10 bg-charcoal-800 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-gold-300" />
          <h2 className="text-lg font-bold">Priority Worklist</h2>
        </div>
        <span className="text-xs text-gray-500">best next records to touch</span>
      </div>

      {error ? (
        <DashboardError title="Priority worklist unavailable" error={error} onRetry={onRetry} minHeight="min-h-24" />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-md border border-white/5 bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : items?.length ? (
        <div className="divide-y divide-white/5">
          {items.map((item) => (
            <div key={item.leadId} className="flex items-stretch gap-2 hover:bg-white/[0.02] rounded-md px-2 -mx-2 transition py-3 first:pt-0 last:pb-0">
              <Link to={item.path} className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_64px] gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white truncate">{item.businessName}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-gray-300 capitalize">
                      {item.stage.replace('_', ' ')}
                    </span>
                    {!item.hasContact && (
                      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
                        no contact
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {item.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} />
                        {item.location}
                      </span>
                    )}
                    <span>{item.reasons.join(' + ')}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-300 lg:text-right">
                  <p className="font-medium text-gold-200">{item.action}</p>
                  <p className="text-xs text-gray-500">{item.followupDate || 'No follow-up date'}</p>
                </div>
                <div className="flex items-center justify-between lg:justify-end gap-2 text-sm">
                  <span className="font-mono text-gray-400">{Math.round(item.score)}</span>
                  <ArrowRight size={15} className="text-gray-500" />
                </div>
              </Link>
              {item.phone && (
                <a
                  href={`tel:${item.phone.replace(/\D/g, '').length === 10 ? '+1' + item.phone.replace(/\D/g, '') : '+' + item.phone.replace(/\D/g, '')}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`Call ${item.businessName}`}
                  aria-label={`Call ${item.businessName}`}
                  className="shrink-0 self-center flex items-center justify-center h-9 w-9 rounded-full border border-green-500/30 bg-green-600/15 text-green-400 hover:bg-green-600/25 transition"
                >
                  <Phone size={16} />
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          Nothing urgent in the worklist.
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  // Fetch user name
  const { data: userName } = useQuery({
    queryKey: ['userName'],
    queryFn: () => settingsService.getUserName()
  });

  const { data: commandCenter, isLoading: commandLoading, error: commandError, refetch: refetchCommand } = useQuery({
    queryKey: ['dashboard-command-center'],
    queryFn: () => dashboardService.getCommandCenter()
  });

  const { data: priorityWorklist, isLoading: priorityLoading, error: priorityError, refetch: refetchPriority } = useQuery({
    queryKey: ['dashboard-priority-worklist'],
    queryFn: () => dashboardService.getPriorityWorklist(12)
  });

  // Fetch dashboard data
  const { data: recentActivity, isLoading: activityLoading, error: activityError, refetch: refetchActivity } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => dashboardService.getRecentActivity(10)
  });

  const { data: dashboardStats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getDashboardStats()
  });

  // Fetch analytics data
  const { data: callsOverTime, isLoading: callsLoading, error: callsError, refetch: refetchCalls } = useQuery({
    queryKey: ['calls-over-time'],
    queryFn: () => dashboardService.getCallsOverTime(30)
  });

  const { data: leadsByStage, isLoading: stageLoading, error: stageError, refetch: refetchStage } = useQuery({
    queryKey: ['leads-by-stage'],
    queryFn: () => dashboardService.getLeadStageStats()
  });

  const { data: leadsByState, isLoading: stateLoading, error: stateError, refetch: refetchState } = useQuery({
    queryKey: ['leads-by-state'],
    queryFn: () => dashboardService.getLeadsByState()
  });

  const handleSync = () => {
    refetchCommand();
    refetchPriority();
    refetchActivity();
    refetchStats();
    refetchCalls();
    refetchStage();
    refetchState();
  };

  const handleExportReport = () => {
    if (!commandCenter) return;

    const report = buildDashboardReport({
      commandCenter,
      priorityWorklist: priorityWorklist || [],
      dashboardStats,
      userName
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`crm_status_report_${date}.md`, report);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Welcome back, {userName || 'User'}. Here's what's happening today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleSync} className="btn-secondary text-sm">
            <RefreshCw size={16} /> Sync
          </button>
          <button
            onClick={handleExportReport}
            disabled={!commandCenter}
            className="btn-primary text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download size={16} /> Export Report
          </button>
        </div>
      </div>

      {commandError ? (
        <DashboardError title="Command center unavailable" error={commandError} onRetry={refetchCommand} minHeight="min-h-44" />
      ) : commandLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-white/10 bg-charcoal-800 rounded-lg p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : commandCenter && (
        <div className="space-y-4">
          <MetricStrip command={commandCenter} />
          {commandCenter.scorecard && <OperatingScorecard scorecard={commandCenter.scorecard} />}
          {commandCenter.growthForecast && <GrowthForecast forecast={commandCenter.growthForecast} />}
          <DailyOperatingPlan items={commandCenter.dailyPlan || []} />
          <LaunchReadiness items={commandCenter.launchChecklist || []} />
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <ActionQueue actions={commandCenter.topActions} />
            <MarketingStatus marketing={commandCenter.marketing} />
            <RevenueRetention commerce={commandCenter.commerce} />
            <HealthPanel items={commandCenter.health} />
          </div>
          <SegmentHealthPanel segmentHealth={commandCenter.segmentHealth} />
          <DataFreshness items={commandCenter.freshness || []} />
        </div>
      )}

      <PriorityWorklist items={priorityWorklist || []} isLoading={priorityLoading} error={priorityError} onRetry={refetchPriority} />

      {/* Stats Cards */}
      {statsError ? (
        <DashboardError title="Dashboard stats unavailable" error={statsError} onRetry={refetchStats} />
      ) : statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse h-32">
              <div className="h-4 bg-charcoal-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-charcoal-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <StatsCards stats={dashboardStats} />
      )}

      {/* Main Grid: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3 width) - Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Calls Over Time Chart */}
          <div className="card min-h-[400px] flex flex-col">
            <h3 className="text-xl font-bold mb-6">Calls Over Time (Last 30 Days)</h3>
            <div className="flex-1 min-h-[300px]">
              {callsError ? (
                <DashboardError title="Call trend unavailable" error={callsError} onRetry={refetchCalls} minHeight="min-h-72" />
              ) : callsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
                </div>
              ) : (
                <CallsOverTimeChart data={callsOverTime} />
              )}
            </div>
          </div>

          {/* Leads by Stage and State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Leads by Stage Pie Chart */}
            <div className="card h-80 flex flex-col">
              <h3 className="text-lg font-bold mb-4">Leads by Stage</h3>
              <div className="flex-1">
                {stageError ? (
                  <DashboardError title="Stage chart unavailable" error={stageError} onRetry={refetchStage} minHeight="min-h-56" />
                ) : stageLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
                  </div>
                ) : (
                  <LeadsByStageChart data={leadsByStage} />
                )}
              </div>
            </div>

            {/* Leads by State Bar Chart */}
            <div className="card h-80 flex flex-col">
              <h3 className="text-lg font-bold mb-4">Top States</h3>
              <div className="flex-1">
                {stateError ? (
                  <DashboardError title="State chart unavailable" error={stateError} onRetry={refetchState} minHeight="min-h-56" />
                ) : stateLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
                  </div>
                ) : (
                  <LeadsByStateChart data={leadsByState} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width) - Activity Feed */}
        <div className="lg:col-span-1">
          {activityError ? (
            <DashboardError title="Recent activity unavailable" error={activityError} onRetry={refetchActivity} minHeight="min-h-64" />
          ) : activityLoading ? (
            <div className="card flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
          ) : (
            <RecentActivity activities={recentActivity || []} />
          )}
        </div>
      </div>
    </div>
  );
}
