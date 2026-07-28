import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { outreachService } from '../services/outreachService'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  Gauge,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Reply,
  Settings,
  ShieldBan,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'

const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—')

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildAutomationReport({ funnel, usage, waves, experiments, replies, suppressed }) {
  return [
    '# Email Automation Status',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '## Monthly send allowance',
    `- Sent: ${usage?.used || 0}`,
    `- Allowance: ${usage?.cap || 0}`,
    '',
    '## Delivery',
    `- Queued: ${funnel?.queued || 0}`,
    `- Sent: ${funnel?.sent || 0}`,
    `- Opened: ${funnel?.opened || 0} (${pct(funnel?.opened || 0, funnel?.sent || 0)})`,
    `- Replied: ${funnel?.replied || 0} (${pct(funnel?.replied || 0, funnel?.sent || 0)})`,
    `- Positive: ${funnel?.positive || 0}`,
    '',
    '## Active campaigns',
    ...((waves || []).map((wave) => `- ${wave.segment}: wave ${wave.waveNumber}, ${wave.status}, testing ${wave.dimension}`)),
    ...(waves?.length ? [] : ['- No active waves']),
    '',
    '## Recent decisions',
    ...((experiments || []).map((experiment) => `- ${experiment.segment?.name || 'Segment'}: ${experiment.result_summary || experiment.test_dimension}`)),
    ...(experiments?.length ? [] : ['- No decided experiments']),
    '',
    '## Replies to review',
    ...((replies || []).map((reply) => `- ${reply.displayName || reply.email}: ${reply.positive_reply ? 'positive reply' : 'reply'}${reply.email ? ` — ${reply.email}` : ''}`)),
    ...(replies?.length ? [] : ['- No recent replies']),
    '',
    `Suppression list: ${suppressed ?? 0}`,
  ].join('\n')
}

function LoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-charcoal-900 px-4 py-3 text-sm text-gray-300">
        <Loader2 size={17} className="animate-spin text-gold-300" />
        Loading email automation
      </div>
    </div>
  )
}

function Metric({ label, value, detail }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 truncate text-xs text-gray-500">{detail}</p>
    </div>
  )
}

function ReplyQueue({ replies }) {
  if (!replies?.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center px-6 py-8 text-center">
        <Inbox size={24} className="text-gray-600" />
        <p className="mt-3 text-sm font-semibold text-gray-300">No replies need review</p>
        <p className="mt-1 text-xs text-gray-500">New replies from your automation provider will appear here.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-white/5">
      {replies.slice(0, 6).map((reply) => {
        const subject = reply.subject ? `Re: ${reply.subject}` : 'Following up'
        const recordPath = reply.lead_id ? `/leads/${reply.lead_id}` : '/customers'
        const recordLabel = reply.lead_id ? 'Open lead' : 'View customer'

        return (
          <div key={reply.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              reply.positive_reply
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-white/5 text-gray-400'
            }`}>
              {reply.positive_reply ? <Sparkles size={16} /> : <Reply size={16} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{reply.displayName || reply.email}</p>
                {reply.positive_reply && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                    Positive
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {[reply.segment?.name, reply.location, reply.replied_at?.slice(0, 10)].filter(Boolean).join(' · ')}
              </p>
              {reply.subject && <p className="mt-1 truncate text-xs text-gray-400">{reply.subject}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={recordPath}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:border-white/20 hover:text-white"
              >
                {recordLabel}
              </Link>
              {reply.email && (
                <a
                  href={`mailto:${reply.email}?subject=${encodeURIComponent(subject)}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-xs font-bold text-charcoal-950 transition hover:bg-emerald-400"
                >
                  Reply <ArrowRight size={13} />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CampaignTable({ segments, waves }) {
  const wavesBySegment = new Map((waves || []).map((wave) => [wave.segment, wave]))

  if (!segments?.length) {
    return <p className="px-5 py-8 text-center text-sm text-gray-500">No campaign segments found.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="border-y border-white/5 bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-gray-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Campaign</th>
            <th className="px-4 py-3 text-right font-semibold">Sent</th>
            <th className="px-4 py-3 text-right font-semibold">Open rate</th>
            <th className="px-4 py-3 text-right font-semibold">Reply rate</th>
            <th className="px-4 py-3 text-right font-semibold">Positive</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {segments.map((segment) => {
            const wave = wavesBySegment.get(segment.name)
            const isActive = Boolean(wave)
            const status = isActive ? 'Active' : segment.sent > 0 ? 'Measured' : 'Building'

            return (
              <tr key={segment.id} className="transition hover:bg-white/[0.025]">
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    isActive ? 'text-emerald-300' : 'text-gray-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    {status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-gray-200">{segment.name}</p>
                  <p className="mt-0.5 text-xs capitalize text-gray-500">
                    {wave ? `Wave ${wave.waveNumber} · testing ${wave.dimension}` : segment.audience}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-right font-medium text-gray-200">{segment.sent.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right text-gray-300">{pct(segment.opened, segment.sent)}</td>
                <td className="px-4 py-3.5 text-right font-semibold text-gold-300">{pct(segment.replied, segment.sent)}</td>
                <td className="px-4 py-3.5 text-right text-gray-300">{segment.positive.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Outreach() {
  const funnelQuery = useQuery({ queryKey: ['otr-funnel'], queryFn: () => outreachService.getFunnel() })
  const segmentsQuery = useQuery({ queryKey: ['otr-segfunnels'], queryFn: () => outreachService.getSegmentFunnels() })
  const wavesQuery = useQuery({ queryKey: ['otr-waves'], queryFn: () => outreachService.getActiveWaves() })
  const experimentsQuery = useQuery({ queryKey: ['otr-exp'], queryFn: () => outreachService.getExperiments() })
  const repliesQuery = useQuery({ queryKey: ['otr-replies'], queryFn: () => outreachService.getRecentReplies() })
  const usageQuery = useQuery({ queryKey: ['otr-usage'], queryFn: () => outreachService.getMonthlyUsage() })
  const capturesQuery = useQuery({ queryKey: ['otr-captures'], queryFn: () => outreachService.getCapturesOverTime(30) })
  const suppressedQuery = useQuery({ queryKey: ['otr-supp'], queryFn: () => outreachService.getSuppressionCount() })

  const queries = [
    funnelQuery,
    segmentsQuery,
    wavesQuery,
    experimentsQuery,
    repliesQuery,
    usageQuery,
    capturesQuery,
    suppressedQuery,
  ]
  const error = queries.find((query) => query.error)?.error
  const isLoading = queries.some((query) => query.isLoading)
  const isFetching = queries.some((query) => query.isFetching)

  if (isLoading) return <LoadingState />

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-xl rounded-xl border border-red-500/20 bg-charcoal-900 p-7 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <h1 className="mt-4 text-xl font-bold">Email automation is disconnected</h1>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          The optional automation tables are unavailable. Run the automation section of the setup SQL, retry, or open Settings to check the connection.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => queries.forEach((query) => query.refetch())}
            disabled={isFetching}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Retry
          </button>
          <Link to="/settings" className="btn-secondary">
            <Settings size={16} /> Open Settings
          </Link>
        </div>
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-xs text-gray-500">Technical details</summary>
          <p className="mt-2 break-words rounded-md bg-black/20 p-3 font-mono text-xs text-red-200/70">{error.message}</p>
        </details>
      </div>
    )
  }

  const funnel = funnelQuery.data
  const segments = segmentsQuery.data
  const waves = wavesQuery.data
  const experiments = experimentsQuery.data
  const replies = repliesQuery.data
  const usage = usageQuery.data
  const captures = capturesQuery.data
  const suppressed = suppressedQuery.data
  const allowance = usage?.cap || 0
  const used = usage?.used || 0
  const remaining = Math.max(0, allowance - used)
  const usagePercent = allowance > 0 ? Math.min(100, (used / allowance) * 100) : 0
  const captureCount = (captures || []).reduce((sum, day) => sum + day.count, 0)
  const activeCampaigns = waves?.length || 0

  const handleExportReport = () => {
    const content = buildAutomationReport({ funnel, usage, waves, experiments, replies, suppressed })
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`crm-automation-status-${date}.md`, content)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 border-b border-white/5 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
            <Bot size={15} /> Email Autopilot
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">Email Automation</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            A dedicated control room for automated email campaigns, replies, and sending health.
          </p>
        </div>
        <button type="button" onClick={handleExportReport} className="btn-secondary w-full md:w-auto">
          <Download size={16} /> Export status
        </button>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-gray-200">All automation data is operational</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {used.toLocaleString()} sent this month · {funnel?.queued?.toLocaleString() || 0} queued · {replies?.length || 0} recent replies
            </p>
          </div>
        </div>
        <span className="self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 sm:self-auto">
          Live data
        </span>
      </section>

      <section className="rounded-xl border border-white/10 bg-charcoal-900">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">
                  {activeCampaigns > 0 ? 'Autopilot is running your campaigns' : 'Autopilot is ready'}
                </h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  View only
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Your sending provider owns delivery and campaign decisions. This workspace monitors activity; pause, budget, and copy controls require a connected provider API.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Manual campaign controls require a connected provider API."
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-600"
          >
            <SlidersHorizontal size={15} /> Manual controls unavailable
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-white/10 bg-charcoal-900">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold"><Inbox size={16} className="text-gold-300" /> Replies to review</h2>
              <p className="mt-0.5 text-xs text-gray-500">Open the CRM record or reply in your email app.</p>
            </div>
            <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-semibold text-gray-400">{replies?.length || 0}</span>
          </div>
          <ReplyQueue replies={replies} />
        </section>

        <section className="rounded-xl border border-white/10 bg-charcoal-900 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-200"><Gauge size={16} className="text-gold-300" /> Monthly send allowance</p>
              <p className="mt-3 text-3xl font-bold text-white">{used.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-500">of {allowance.toLocaleString()} emails used</p>
            </div>
            <span className="text-sm font-semibold text-gray-300">{usagePercent.toFixed(0)}%</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gold-400 transition-all duration-500" style={{ width: `${usagePercent}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{remaining.toLocaleString()} remaining</span>
            <span>Resets monthly</span>
          </div>
          <div className="mt-5 grid grid-cols-2 divide-x divide-white/5 rounded-lg border border-white/5 bg-black/10">
            <Metric label="Reply rate" value={pct(funnel?.replied || 0, funnel?.sent || 0)} detail={`${funnel?.replied || 0} replies`} />
            <Metric label="Positive" value={(funnel?.positive || 0).toLocaleString()} detail="hand-raisers" />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-charcoal-900">
        <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold"><Activity size={16} className="text-gold-300" /> Campaign performance</h2>
            <p className="mt-0.5 text-xs text-gray-500">Concise performance by campaign segment.</p>
          </div>
          <p className="text-xs text-gray-500">{activeCampaigns} active · {segments?.length || 0} total</p>
        </div>
        <CampaignTable segments={segments} waves={waves} />
      </section>

      <details className="rounded-xl border border-white/10 bg-charcoal-900">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Advanced automation details</h2>
            <p className="mt-0.5 text-xs text-gray-500">Experiment decisions, capture volume, and suppression health.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500">Expand</span>
        </summary>
        <div className="grid gap-5 border-t border-white/5 p-4 lg:grid-cols-3">
          <div className="rounded-lg border border-white/5 bg-black/10 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500"><Mail size={14} /> Website captures</p>
            <p className="mt-2 text-2xl font-bold text-white">{captureCount.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500">captured in the last 30 days</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/10 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500"><ShieldBan size={14} /> Suppression list</p>
            <p className="mt-2 text-2xl font-bold text-white">{(suppressed || 0).toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500">contacts protected from sending</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/10 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500"><Bot size={14} /> Active waves</p>
            <p className="mt-2 text-2xl font-bold text-white">{activeCampaigns}</p>
            <p className="mt-1 text-xs text-gray-500">campaigns currently sending or measuring</p>
          </div>

          <div className="lg:col-span-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Recent experiment decisions</p>
            {experiments?.length ? (
              <div className="divide-y divide-white/5 rounded-lg border border-white/5">
                {experiments.slice(0, 5).map((experiment) => (
                  <div key={experiment.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-300">{experiment.result_summary || `${experiment.test_dimension} test`}</p>
                    <p className="text-xs text-gray-500">
                      {[experiment.segment?.name, experiment.test_dimension, experiment.decided_at?.slice(0, 10)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No decided experiments yet.</p>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
