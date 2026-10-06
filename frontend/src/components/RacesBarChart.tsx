import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SnailWins } from '../types';

export function RacesBarChart({ data }: { data: readonly SnailWins[] }) {
  const maxWins = data.reduce((max, item) => Math.max(max, item.wins), 0);
  const description = data.map((item) => `${item.name} ${item.wins}`).join(', ');
  const chartData = data.map((item) => ({ ...item }));

  return (
    <div className="bars-wrap" role="img" aria-label={`Gráfica de barras de victorias del día: ${description}`}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 24, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="name" interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} domain={[0, maxWins + 1]} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fillOpacity: 0.08 }}
            formatter={(value) => [`${String(value)} ${Number(value) === 1 ? 'victoria' : 'victorias'}`, '']}
            separator=""
          />
          <Bar dataKey="wins" name="Victorias" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {chartData.map((item) => (
              <Cell key={item.id} fill={item.color} />
            ))}
            <LabelList dataKey="wins" position="top" className="bar-label" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RacesBarChart;
