import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { BetStats } from '../types';

const WON_COLOR = '#2f9e5b';
const LOST_COLOR = '#d9534f';

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function BetsDonutChart({ stats }: { stats: BetStats }) {
  const total = stats.won + stats.lost;
  const effectiveness = total === 0 ? 0 : Math.round((stats.won / total) * 100);
  const data: DonutSlice[] = [
    { name: 'Ganadas', value: stats.won, color: WON_COLOR },
    { name: 'Perdidas', value: stats.lost, color: LOST_COLOR },
  ];

  return (
    <>
      <div
        className="donut-wrap"
        role="img"
        aria-label={`Gráfica donut: ${stats.won} apuestas ganadas y ${stats.lost} perdidas, ${effectiveness}% de efectividad`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={66}
              outerRadius={94}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="none"
              isAnimationActive
            >
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${String(value)} apuestas`, '']} separator="" />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-hidden="true">
          <strong>{effectiveness}%</strong>
          <span>efectividad</span>
        </div>
      </div>
      <dl className="stats">
        <div>
          <dt>
            <span className="dot" style={{ background: WON_COLOR }} />
            Ganadas
          </dt>
          <dd>{stats.won}</dd>
        </div>
        <div>
          <dt>
            <span className="dot" style={{ background: LOST_COLOR }} />
            Perdidas
          </dt>
          <dd>{stats.lost}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{total}</dd>
        </div>
      </dl>
    </>
  );
}

export default BetsDonutChart;
