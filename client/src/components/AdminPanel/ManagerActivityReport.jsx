import React, { useState, useEffect } from 'react';
import { Users, Activity, RefreshCw, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { api } from '../../api';

export default function ManagerActivityReport() {
  const [data, setData] = useState({ managers: [], details: null });
  const [selectedManager, setSelectedManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState('purchases');

  useEffect(() => {
    loadActivity();
  }, []);

  useEffect(() => {
    if (selectedManager) {
      loadManagerDetail(selectedManager);
    }
  }, [selectedManager]);

  async function loadActivity() {
    setLoading(true);
    try {
      const res = await api.getManagerActivity();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadManagerDetail(managerName) {
    try {
      const res = await api.getManagerActivity(managerName);
      setData(prev => ({ ...prev, details: res.details }));
    } catch (err) {
      console.error(err);
    }
  }

  function exportCSV(rows, filename) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><Users size={22} /> Manager Activity Report</h2>
          <p>Track all transactions entered by each manager with attribution details</p>
        </div>
        <button className="btn btn-outline" onClick={loadActivity}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Manager Summary Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '24px' }}>
        {data.managers.map(mgr => (
          <div
            key={mgr.id}
            className="kpi-card"
            style={{
              cursor: 'pointer',
              border: selectedManager === mgr.name ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              boxShadow: selectedManager === mgr.name ? '0 0 0 2px var(--primary-glow)' : 'none',
            }}
            onClick={() => setSelectedManager(selectedManager === mgr.name ? null : mgr.name)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '17px', color: '#fff', flexShrink: 0 }}>
                {mgr.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>{mgr.name}</div>
                <span className={`pill ${mgr.status === 'active' ? 'pill-emerald' : 'pill-rose'}`} style={{ fontSize: '10px' }}>
                  {mgr.status}
                </span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {selectedManager === mgr.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>{mgr.purchase_count}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Purchases</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--indigo)' }}>{mgr.production_count}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Productions</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--emerald)' }}>{mgr.sales_count}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Sales</div>
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Total Production:</span>
                <strong className="num-mono">{mgr.total_production_kg?.toLocaleString()} KG</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Total Sales:</span>
                <strong className="num-mono" style={{ color: 'var(--emerald)' }}>{mgr.total_sales_kg?.toLocaleString()} KG</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Total Wastage:</span>
                <strong className="num-mono" style={{ color: 'var(--amber)' }}>{mgr.total_wastage_kg?.toLocaleString()} KG</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Sales Revenue:</span>
                <strong className="num-mono" style={{ color: 'var(--emerald)' }}>₹{mgr.total_sales_amount?.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Drill-down: Manager's transactions */}
      {selectedManager && data.details && (
        <div className="table-container">
          <div className="table-toolbar">
            <div>
              <span style={{ fontWeight: '700', fontSize: '15px' }}>
                📋 {selectedManager}'s Entry History
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="view-mode-toggle">
                <button className={`mode-btn ${detailTab === 'purchases' ? 'active' : ''}`} onClick={() => setDetailTab('purchases')}>Purchases ({data.details.purchases.length})</button>
                <button className={`mode-btn ${detailTab === 'productions' ? 'active' : ''}`} onClick={() => setDetailTab('productions')}>Production ({data.details.productions.length})</button>
                <button className={`mode-btn ${detailTab === 'sales' ? 'active' : ''}`} onClick={() => setDetailTab('sales')}>Sales ({data.details.sales.length})</button>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => {
                if (detailTab === 'purchases') exportCSV(data.details.purchases, `${selectedManager}_purchases.csv`);
                if (detailTab === 'productions') exportCSV(data.details.productions, `${selectedManager}_productions.csv`);
                if (detailTab === 'sales') exportCSV(data.details.sales, `${selectedManager}_sales.csv`);
              }}>Export CSV</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {detailTab === 'purchases' && (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Purchase Code</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Raw Material</th>
                    <th style={{ textAlign: 'right' }}>Qty KG</th>
                    <th style={{ textAlign: 'right' }}>Rate/KG</th>
                    <th style={{ textAlign: 'right' }}>Amount ₹</th>
                    <th>Invoice</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.details.purchases.map(p => (
                    <tr key={p.id}>
                      <td><span className="pill pill-cyan num-mono">{p.purchase_code}</span></td>
                      <td style={{ fontSize: '13px' }}>{p.date}</td>
                      <td style={{ fontSize: '13px' }}>{p.supplier_name}</td>
                      <td style={{ fontSize: '13px', fontWeight: '500' }}>{p.raw_material_name}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>{p.quantity_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right' }}>₹{p.rate_per_kg}</td>
                      <td className="num-mono" style={{ textAlign: 'right', fontWeight: '600' }}>₹{p.total_amount?.toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.invoice_number}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {detailTab === 'productions' && (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Batch Code</th>
                    <th>Date</th>
                    <th>Machine</th>
                    <th>Shift</th>
                    <th>Raw Material</th>
                    <th style={{ textAlign: 'right' }}>RM Used</th>
                    <th style={{ textAlign: 'right' }}>Finished KG</th>
                    <th style={{ textAlign: 'right' }}>Wastage KG</th>
                    <th>Wastage %</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.details.productions.map(p => {
                    const wastePct = p.raw_material_used_kg > 0
                      ? ((p.total_wastage_kg / p.raw_material_used_kg) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <tr key={p.id}>
                        <td><span className="pill pill-indigo num-mono">{p.batch_code}</span></td>
                        <td style={{ fontSize: '13px' }}>{p.date}</td>
                        <td style={{ fontSize: '13px' }}>{p.machine_name}</td>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{p.shift_name}</td>
                        <td style={{ fontSize: '13px', fontWeight: '500' }}>{p.raw_material_name}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--primary)' }}>{p.raw_material_used_kg?.toLocaleString()}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>{p.total_finished_kg?.toLocaleString()}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>{p.total_wastage_kg?.toLocaleString()}</td>
                        <td>
                          <span className={`pill ${Number(wastePct) < 5 ? 'pill-emerald' : Number(wastePct) < 10 ? 'pill-amber' : 'pill-rose'}`}>
                            {wastePct}%
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {detailTab === 'sales' && (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Sale Code</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>GSM</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'right' }}>Qty KG</th>
                    <th style={{ textAlign: 'right' }}>Rate/KG</th>
                    <th style={{ textAlign: 'right' }}>Amount ₹</th>
                    <th>Payment</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.details.sales.map(s => (
                    <tr key={s.id}>
                      <td><span className="pill pill-emerald num-mono">{s.sale_code}</span></td>
                      <td style={{ fontSize: '13px' }}>{s.date}</td>
                      <td style={{ fontWeight: '500' }}>{s.customer_name}</td>
                      <td style={{ fontSize: '13px' }}>{s.product_name}</td>
                      <td className="num-mono" style={{ fontWeight: '600' }}>{s.gsm}</td>
                      <td style={{ fontSize: '13px' }}>{s.width_size}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--primary)' }}>{s.quantity_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right' }}>₹{s.rate_per_kg}</td>
                      <td className="num-mono" style={{ textAlign: 'right', fontWeight: '600', color: 'var(--emerald)' }}>₹{s.total_amount?.toLocaleString('en-IN')}</td>
                      <td><span className={`pill ${s.payment_type === 'Cash' ? 'pill-emerald' : s.payment_type === 'Credit' ? 'pill-amber' : 'pill-cyan'}`}>{s.payment_type}</span></td>
                      <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
