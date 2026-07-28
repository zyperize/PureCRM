import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  new: '#3b82f6',          // blue
  contacted: '#8b5cf6',    // purple
  interested: '#f59e0b',   // amber/gold
  samples_sent: '#14b8a6',  // teal
  qualified: '#10b981',    // green
  won: '#22c55e',          // bright green
  lost: '#6b7280'          // gray
};

export default function LeadsByStageChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No lead stage data available
      </div>
    );
  }

  // Format data for recharts
  const chartData = data.map(item => ({
    name: item.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: item.count,
    fill: COLORS[item.name] || '#6b7280'
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Legend
          wrapperStyle={{ color: '#9ca3af' }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
