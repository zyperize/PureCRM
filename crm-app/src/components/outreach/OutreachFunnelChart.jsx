import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts'

const TIP = {
  backgroundColor: 'rgba(18,18,18,0.92)',
  border: '1px solid rgba(212,175,55,0.25)',
  borderRadius: '12px',
  color: '#fff',
  backdropFilter: 'blur(8px)',
}

const STAGES = [
  { key: 'sent', label: 'Sent', color: '#826818' },
  { key: 'opened', label: 'Opened', color: '#A3841F' },
  { key: 'replied', label: 'Replied', color: '#D4AF37' },
  { key: 'positive', label: 'Positive', color: '#E6C86E' },
]

export default function OutreachFunnelChart({ funnel }) {
  if (!funnel) return <div className="flex items-center justify-center h-64 text-gray-500">No data yet</div>
  const data = STAGES.map(s => ({ name: s.label, value: funnel[s.key] || 0, fill: s.color }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
          tick={{ fill: '#9ca3af', fontSize: 13 }} width={72} />
        <Tooltip contentStyle={TIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          <LabelList dataKey="value" position="right" fill="#E6C86E" fontSize={13} fontWeight={700} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
