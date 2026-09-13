import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart2, TrendingUp, Package, Layers, ShoppingBag, Factory,
  Truck, AlertTriangle, RefreshCw, ArrowUpRight
} from 'lucide-react';
import { api } from '../../api';

// Tiny inline SVG bar chart renderer
function MiniBarChart({ data = [], valueKey, labelKey, color = '#0284c7', height = 80 }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: `${height}px` }}>
      {data.map((item, i) => {
        const barH = Math.max(((item[valueKey] || 0) / maxVal) * height, 2);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <div
              title={`${item[labelKey]}: ${(item[valueKey] || 0).toLocaleString()}`}
              style={{
                width: '100%',
                height: `${barH}px`,
                background: `linear-gradient(to top, ${color}, ${color}99)`,
                borderRadius: '3px 3px 0 0',
                cursor: 'default',
                transition: 'height 0.4s ease'
              }}
            />
            <span style={{ fontSize: '9px', color: 'var(--text-dim)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MiniLineChart({ data = [], valueKey, labelKey, color = '#10b981', height = 80 }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const w = 100, h = height;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((d[valueKey] || 0) / maxVal) * (h - 8);
    return `${x},${y}`;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={`${height}px`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={`0,${h} ${pts.join(' ')} ${w},${h}`}
          fill={`url(#grad-${color.slice(1)})`}
        />
        {data.map((d, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * w;
          const y = h - ((d[valueKey] || 0) / maxVal) * (h - 8);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill={color}
              vectorEffect="non-scaling-stroke"
            >
              <title>{d[labelKey]}: {(d[valueKey] || 0).toLocaleString()}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-dim)' }}>
        {data.map((d, i) => <span key={i}>{d[labelKey]}</span>)}
      </div>
    </div>
  );
}

function WastageDonut({ data = [] }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + (d.total_kg || 0), 0);
  if (!total) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No wastage recorded</div>;

  const colors = ['#f59e0b', '#f43f5e', '#6366f1', '#06b6d4', '#10b981', '#94a3b8'];
  let cumulative = 0;
  const radius = 40;
  const cx = 60, cy = 60;

  const slices = data.map((d, i) => {
    const pct = (d.total_kg || 0) / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;
    return {
      ...d,
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[i % colors.length],
      pct: (pct * 100).toFixed(1)
    };
  });

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
      <svg viewBox="0 0 120 120" width="120" height="120">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity="0.85">
            <title>{s.reason}: {s.total_kg?.toLocaleString()} KG ({s.pct}%)</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={radius - 18} fill="var(--bg-card)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-main)" fontSize="10" fontWeight="bold">Total</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-muted)" fontSize="8">{total.toLocaleString()} KG</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.reason}</span>
            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)', gap: '12px' }}>
        <RefreshCw size={22} className="animate-spin" />
        <span>Loading dashboard analytics...</span>
      </div>
    );
  }

  if (!stats) return null;

  const rmStock = stats.rawMaterialStockKg;
  const fgStock = stats.finishedGoodsStockKg;
  const todayWastePct = stats.todayProduction.rmUsedKg > 0
    ? ((stats.todayProduction.wastageKg / stats.todayProduction.rmUsedKg) * 100).toFixed(1)
    : '0.0';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><BarChart2 size={22} /> Executive Dashboard</h2>
          <p>Live factory metrics and inventory status — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn btn-outline" onClick={loadStats}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-title">
            Raw Material Stock
            <Layers size={16} color="var(--primary)" />
          </div>
          <div className="kpi-value">{rmStock?.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '400', color: 'var(--text-muted)' }}>KG</span></div>
          <div className="kpi-sub">
            <ArrowUpRight size={12} color="var(--emerald)" />
            Today's Purchase: +{stats.todayPurchase.kg?.toLocaleString()} KG
          </div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-title">
            Finished Goods Stock
            <Package size={16} color="var(--emerald)" />
          </div>
          <div className="kpi-value">{fgStock?.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '400', color: 'var(--text-muted)' }}>KG</span></div>
          <div className="kpi-sub">
            <ArrowUpRight size={12} color="var(--cyan)" />
            Today's Production: +{stats.todayProduction.finishedKg?.toLocaleString()} KG
          </div>
        </div>

        <div className="kpi-card cyan">
          <div className="kpi-title">
            Today's Purchase
            <ShoppingBag size={16} color="var(--cyan)" />
          </div>
          <div className="kpi-value">₹{(stats.todayPurchase.amount || 0).toLocaleString('en-IN')}</div>
          <div className="kpi-sub">
            {stats.todayPurchase.kg?.toLocaleString()} KG • {stats.todayPurchase.count} PO
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">
            Today's Production
            <Factory size={16} color="var(--primary)" />
          </div>
          <div className="kpi-value">{stats.todayProduction.finishedKg?.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>KG</span></div>
          <div className="kpi-sub">
            RM Used: {stats.todayProduction.rmUsedKg?.toLocaleString()} KG • {stats.todayProduction.count} batch(es)
          </div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-title">
            Today's Wastage
            <AlertTriangle size={16} color="var(--amber)" />
          </div>
          <div className="kpi-value">{stats.todayProduction.wastageKg?.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>KG</span></div>
          <div className="kpi-sub" style={{ color: 'var(--amber)' }}>
            Wastage %: {todayWastePct}%
          </div>
        </div>

        <div className="kpi-card rose">
          <div className="kpi-title">
            Today's Sales
            <Truck size={16} color="var(--rose)" />
          </div>
          <div className="kpi-value">₹{(stats.todaySales.amount || 0).toLocaleString('en-IN')}</div>
          <div className="kpi-sub">
            {stats.todaySales.kg?.toLocaleString()} KG • {stats.todaySales.count} order(s)
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">
            Monthly Production
            <TrendingUp size={16} color="var(--indigo)" />
          </div>
          <div className="kpi-value">{stats.monthlyProduction.finishedKg?.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>KG</span></div>
          <div className="kpi-sub">
            RM Used: {stats.monthlyProduction.rmUsedKg?.toLocaleString()} KG this month
          </div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-title">
            Monthly Sales
            <TrendingUp size={16} color="var(--emerald)" />
          </div>
          <div className="kpi-value">₹{(stats.monthlySales.amount || 0).toLocaleString('en-IN')}</div>
          <div className="kpi-sub">
            {stats.monthlySales.kg?.toLocaleString()} KG sold this month
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Raw Material Purchase Trend (7 Days)</div>
            <span className="pill pill-cyan">Last 7 Days</span>
          </div>
          <MiniBarChart
            data={stats.trends.rmTrend}
            valueKey="kg"
            labelKey="date"
            color="#0284c7"
            height={90}
          />
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Production Trend (KG Finished)</div>
            <span className="pill pill-indigo">Last 7 Days</span>
          </div>
          <MiniLineChart
            data={stats.trends.prodTrend}
            valueKey="finishedKg"
            labelKey="date"
            color="#6366f1"
            height={90}
          />
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Sales Revenue Trend (₹)</div>
            <span className="pill pill-emerald">Last 7 Days</span>
          </div>
          <MiniLineChart
            data={stats.trends.salesTrend}
            valueKey="amount"
            labelKey="date"
            color="#10b981"
            height={90}
          />
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Wastage Breakdown by Reason</div>
            <span className="pill pill-amber">All Time</span>
          </div>
          <WastageDonut data={stats.trends.wastageReasons} />
        </div>
      </div>
    </div>
  );
}
