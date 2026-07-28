import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const TIP = {
  backgroundColor: 'rgba(18,18,18,0.92)',
  border: '1px solid rgba(212,175,55,0.25)',
  borderRadius: '12px',
  color: '#fff',
  backdropFilter: 'blur(8px)',
}

/** "Before you leave" website email captures over time. */
export default function CapturesChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No website captures yet</div>
  }
  const fmt = data.map(d => ({ ...d, label: d.date.slice(5) }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={fmt} margin={{ left: -18, right: 12, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="capGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} minTickGap={24} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={TIP} cursor={{ stroke: 'rgba(212,175,55,0.3)' }} />
        <Area type="monotone" dataKey="count" stroke="#D4AF37" strokeWidth={2} fill="url(#capGold)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
