import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts'

const TIP = {
  backgroundColor: 'rgba(18,18,18,0.92)',
  border: '1px solid rgba(212,175,55,0.25)',
  borderRadius: '12px',
  color: '#fff',
  backdropFilter: 'blur(8px)',
}
const PALETTE = ['#D4AF37', '#5EA9A1', '#E6C86E', '#9B8BD4', '#C5A028']

/** Reply rate (%) per variant in a wave — the A/B bars. */
export default function WaveVariantChart({ variants }) {
  if (!variants || variants.length === 0) {
    return <div className="flex items-center justify-center h-40 text-gray-500 text-sm">No sends in this wave yet</div>
  }
  const data = variants.map((v, i) => ({
    name: v.name.replace(/^[a-z]+_/, '').replace(/_/g, ' '),
    replyRate: +(v.replyRate * 100).toFixed(1),
    sends: v.sends,
    fill: v.status === 'winner' ? '#22c55e' : v.status === 'paused' ? '#6b7280' : PALETTE[i % PALETTE.length],
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -10, right: 12, top: 12, bottom: 4 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} unit="%" />
        <Tooltip contentStyle={TIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(val, _n, p) => [`${val}% reply · ${p.payload.sends} sent`, 'Variant']} />
        <Bar dataKey="replyRate" radius={[8, 8, 0, 0]} barSize={48}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          <LabelList dataKey="replyRate" position="top" fill="#E6C86E" fontSize={12} fontWeight={700} formatter={(v) => `${v}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
