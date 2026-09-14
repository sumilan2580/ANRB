import React, { useState, useEffect } from 'react';
import { FileBarChart, AlertTriangle, Users, RefreshCw, Filter, Layers, Factory } from 'lucide-react';
import { api } from '../../api';

function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
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

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('wastage');
  const [wastageData, setWastageData] = useState({ rows: [], summary: {}, byMachine: [], byReason: [], byProduct: [] });
  const [consumptionData, setConsumptionData] = useState({ batches: [], summary: {} });
  const [customerSalesData, setCustomerSalesData] = useState({ customers: [], productBreakdown: [] });
  const [salesData, setSalesData] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [managers, setManagers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');

  useEffect(() => {
    api.getManagers().then(setManagers).catch(() => {});
    api.getMachines().then(setMachines).catch(() => {});
    api.getCustomers().then(setCustomers).catch(() => {});
  }, []);

  useEffect(() => {
    loadReport();
  }, [activeReport, dateFrom, dateTo, managerFilter, customerFilter, machineFilter]);

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (managerFilter) params.append('managerName', managerFilter);
      if (machineFilter) params.append('machineId', machineFilter);
      if (customerFilter) params.append('customerId', customerFilter);
      const qs = params.toString();

      if (activeReport === 'wastage') {
        const data = await api.getWastageReport(qs);
        setWastageData(data || { rows: [], summary: {}, byMachine: [], byReason: [], byProduct: [] });
      } else if (activeReport === 'consumption') {
        const data = await api.getConsumptionReport(qs);
        setConsumptionData(data || { batches: [], summary: {} });
      } else if (activeReport === 'customer-sales') {
        const data = await api.getCustomerSalesReport(qs);
        setCustomerSalesData(data || { customers: [], productBreakdown: [] });
      } else if (activeReport === 'sales') {
        const data = await api.getSales(qs);
        setSalesData(data || []);
      } else if (activeReport === 'purchases') {
        const data = await api.getPurchases(qs);
        setPurchases(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const REPORTS = [
    { id: 'wastage', label: '1. Wastage Analysis & Scrap' },
    { id: 'consumption', label: '2. RM Consumption vs FG' },
    { id: 'customer-sales', label: '3. Customer Sales & Products' },
    { id: 'sales', label: '4. Sales Register' },
    { id: 'purchases', label: '5. Purchase Register' },
  ];

  const FilterBar = () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border-color)' }}>
      <Filter size={14} color="var(--text-dim)" />
      <input type="date" className="form-input" style={{ width: '140px', padding: '5px 8px', fontSize: '12px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
      <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>to</span>
      <input type="date" className="form-input" style={{ width: '140px', padding: '5px 8px', fontSize: '12px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />

      {(activeReport === 'wastage' || activeReport === 'consumption' || activeReport === 'sales' || activeReport === 'purchases') && (
        <select className="form-select" style={{ width: '140px', padding: '5px 8px', fontSize: '12px' }} value={managerFilter} onChange={e => setManagerFilter(e.target.value)}>
          <option value="">All Managers</option>
          {managers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
      )}

      {(activeReport === 'wastage' || activeReport === 'consumption') && (
        <select className="form-select" style={{ width: '140px', padding: '5px 8px', fontSize: '12px' }} value={machineFilter} onChange={e => setMachineFilter(e.target.value)}>
          <option value="">All Machines</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      {(activeReport === 'customer-sales' || activeReport === 'sales') && (
        <select className="form-select" style={{ width: '180px', padding: '5px 8px', fontSize: '12px' }} value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}>
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {(dateFrom || dateTo || managerFilter || customerFilter || machineFilter) && (
        <button className="btn btn-outline btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setManagerFilter(''); setCustomerFilter(''); setMachineFilter(''); }}>
          Clear Filters
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FileBarChart size={22} /> Reports & Analytics</h2>
          <p>Wastage breakdown, material consumption, customer sales, and factory yield analytics</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadReport}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-outline btn-sm" onClick={() => {
            if (activeReport === 'wastage') exportCSV(wastageData.rows, 'wastage_report.csv');
            if (activeReport === 'consumption') exportCSV((consumptionData.batches || []).map(b => ({
              'Issue Batch #': b.batch_no,
              'Date': b.date,
              'Production Order': b.order_no || 'Floor Issue',
              'Customer': b.customer_name || '—',
              'Machine': b.machine_name || '—',
              'Shift': b.shift_name || '—',
              'Total Issued KG': Number(b.total_issued_kg ?? b.totalIssuedQty ?? 0),
              'Status': b.status,
              'Issued By': b.manager_name
            })), 'consumption_report.csv');
            if (activeReport === 'customer-sales') exportCSV(customerSalesData.customers, 'customer_sales_report.csv');
            if (activeReport === 'sales') exportCSV(salesData, 'sales_report.csv');
            if (activeReport === 'purchases') exportCSV(purchases, 'purchase_report.csv');
          }}>Export CSV</button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {REPORTS.map(r => (
          <button
            key={r.id}
            className={`btn ${activeReport === r.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveReport(r.id)}
            style={{ borderRadius: '20px', fontSize: '12px' }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="table-container">
        <FilterBar />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="animate-spin" /> Generating report...
          </div>
        ) : activeReport === 'wastage' ? (
          <>
            {/* Wastage Summary Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(245, 158, 11, 0.05)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Wastage</div>
                <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                  {wastageData.summary?.totalWastageKg?.toLocaleString()} KG
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total RM Used</div>
                <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                  {wastageData.summary?.totalRMUsedKg?.toLocaleString()} KG
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Overall Wastage %</div>
                <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: Number(wastageData.summary?.overallWastagePercentage) < 5 ? 'var(--emerald)' : 'var(--rose)' }}>
                  {wastageData.summary?.overallWastagePercentage}%
                </div>
              </div>
            </div>

            {/* Breakdowns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
              {/* By Machine */}
              {wastageData.byMachine && wastageData.byMachine.length > 0 && (
                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>Wastage by Machine</div>
                  <table style={{ width: '100%', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }}><th style={{ textAlign: 'left' }}>Machine</th><th style={{ textAlign: 'right' }}>Wastage KG</th><th style={{ textAlign: 'right' }}>%</th></tr>
                    </thead>
                    <tbody>
                      {wastageData.byMachine.map((m, i) => (
                        <tr key={i}><td style={{ padding: '3px 0' }}>{m.machine_name}</td><td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--amber)' }}>{m.total_wastage_kg?.toLocaleString()}</td><td style={{ textAlign: 'right' }}>{m.wastage_pct}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* By Reason */}
              {wastageData.byReason && wastageData.byReason.length > 0 && (
                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--amber)', marginBottom: '8px' }}>Wastage by Reason / Scrap Type</div>
                  <table style={{ width: '100%', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }}><th style={{ textAlign: 'left' }}>Reason</th><th style={{ textAlign: 'right' }}>Batches</th><th style={{ textAlign: 'right' }}>Total KG</th></tr>
                    </thead>
                    <tbody>
                      {wastageData.byReason.map((r, i) => (
                        <tr key={i}><td style={{ padding: '3px 0' }}>{r.reason}</td><td style={{ textAlign: 'right' }}>{r.batch_count}</td><td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--amber)' }}>{r.total_wastage_kg?.toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* By Product */}
              {wastageData.byProduct && wastageData.byProduct.length > 0 && (
                <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--emerald)', marginBottom: '8px' }}>Wastage by Finished Good</div>
                  <table style={{ width: '100%', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }}><th style={{ textAlign: 'left' }}>Product</th><th style={{ textAlign: 'right' }}>Total Scrap KG</th></tr>
                    </thead>
                    <tbody>
                      {wastageData.byProduct.map((p, i) => (
                        <tr key={i}><td style={{ padding: '3px 0' }}>{p.product_name}</td><td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--amber)' }}>{p.total_wastage_kg?.toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detailed Rows Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Batch Code</th>
                    <th>Date</th>
                    <th>Machine</th>
                    <th>Shift</th>
                    <th style={{ textAlign: 'right' }}>RM Used</th>
                    <th style={{ textAlign: 'right' }}>Finished KG</th>
                    <th style={{ textAlign: 'right' }}>Wastage KG</th>
                    <th>Wastage %</th>
                    <th>Reason</th>
                    <th>Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {wastageData.rows.length === 0 ? (
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No wastage entries recorded for this period.</td></tr>
                  ) : wastageData.rows.map(row => (
                    <tr key={row.id}>
                      <td><span className="pill pill-indigo num-mono">{row.batch_code}</span></td>
                      <td>{row.date}</td>
                      <td>{row.machine_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{row.shift_name}</td>
                      <td className="num-mono" style={{ textAlign: 'right' }}>{row.raw_material_used_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>{row.total_finished_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--amber)', fontWeight: '700' }}>{row.total_wastage_kg?.toLocaleString()}</td>
                      <td>
                        <span className={`pill ${row.wastage_percentage < 5 ? 'pill-emerald' : row.wastage_percentage < 10 ? 'pill-amber' : 'pill-rose'}`}>
                          {row.wastage_percentage}%
                        </span>
                      </td>
                      <td><span className="pill pill-amber" style={{ fontSize: '10px' }}>{row.wastage_reason || 'Process Scrap'}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--primary)' }}>{row.manager_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : activeReport === 'consumption' ? (
          /* Consumption Report */
          <div style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(56, 189, 248, 0.05)', display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Batches: </span>
                <span style={{ fontSize: '16px', fontWeight: '800' }}>{consumptionData.batches?.length || 0}</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Issued Material: </span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--emerald)' }}>
                  {(
                    consumptionData.summary?.total_issued_kg ??
                    consumptionData.summary?.totalIssued ??
                    consumptionData.batches?.reduce((s, b) => s + (Number(b.total_issued_kg ?? b.totalIssuedQty) || 0), 0) ??
                    0
                  ).toLocaleString()} KG
                </span>
              </div>
            </div>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Issue Batch #</th>
                  <th>Date</th>
                  <th>Production Order</th>
                  <th>Customer</th>
                  <th>Machine</th>
                  <th>Shift</th>
                  <th style={{ textAlign: 'right' }}>Total Issued</th>
                  <th>Status</th>
                  <th>Issued By</th>
                </tr>
              </thead>
              <tbody>
                {(!consumptionData.batches || consumptionData.batches.length === 0) ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No material consumption batches found.</td></tr>
                ) : consumptionData.batches.map(b => {
                  const issuedQty = Number(
                    b.total_issued_kg ??
                    b.totalIssuedQty ??
                    (b.items ? b.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) : 0)
                  ) || 0;
                  return (
                    <tr key={b.id}>
                      <td><span className="pill pill-cyan num-mono">{b.batch_no}</span></td>
                      <td>{b.date}</td>
                      <td style={{ fontWeight: '600' }}>{b.order_no || 'Floor Issue'}</td>
                      <td>{b.customer_name || '—'}</td>
                      <td>{b.machine_name || '—'}</td>
                      <td><span className="pill pill-blue" style={{ fontSize: '10px' }}>{b.shift_name || '—'}</span></td>
                      <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--emerald)' }}>
                        {issuedQty.toLocaleString()} KG
                      </td>
                      <td>
                        <span className={`pill ${b.status === 'Issued' ? 'pill-emerald' : b.status === 'Cancelled' ? 'pill-rose' : 'pill-amber'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{b.manager_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : activeReport === 'customer-sales' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>GST</th>
                  <th style={{ textAlign: 'right' }}>Total Orders</th>
                  <th style={{ textAlign: 'right' }}>Total Qty KG</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue ₹</th>
                  <th>Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {customerSalesData.customers.map(c => (
                  <tr key={c.customer_id}>
                    <td style={{ fontWeight: '600' }}>{c.customer_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.phone || '—'}</td>
                    <td style={{ fontSize: '11px' }}>{c.gst_number || '—'}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{c.total_orders}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: '600' }}>{c.total_quantity_kg?.toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--emerald)' }}>₹{c.total_sales_amount?.toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.last_purchase_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeReport === 'sales' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Sale Code</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>GSM</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th style={{ textAlign: 'right' }}>Qty KG</th>
                  <th style={{ textAlign: 'right' }}>Rate/KG</th>
                  <th style={{ textAlign: 'right' }}>Amount ₹</th>
                  <th>Payment</th>
                  <th>Manager</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map(s => (
                  <tr key={s.id}>
                    <td><span className="pill pill-emerald num-mono">{s.sale_code}</span></td>
                    <td>{s.date}</td>
                    <td style={{ fontWeight: '500' }}>{s.customer_name}</td>
                    <td>{s.product_name}</td>
                    <td className="num-mono" style={{ fontWeight: '700' }}>{s.gsm}</td>
                    <td>{s.width_size}</td>
                    <td>{s.colour}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '600' }}>{s.quantity_kg?.toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>₹{s.rate_per_kg}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--emerald)' }}>₹{s.total_amount?.toLocaleString('en-IN')}</td>
                    <td><span className={`pill ${s.payment_type === 'Cash' ? 'pill-emerald' : s.payment_type === 'Credit' ? 'pill-amber' : 'pill-cyan'}`}>{s.payment_type}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--primary)' }}>{s.manager_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeReport === 'purchases' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Purchase Code</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Raw Material</th>
                  <th style={{ textAlign: 'right' }}>Qty KG</th>
                  <th style={{ textAlign: 'right' }}>Rate/KG</th>
                  <th style={{ textAlign: 'right' }}>Total ₹</th>
                  <th>Invoice #</th>
                  <th>Manager</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td><span className="pill pill-cyan num-mono">{p.purchase_code}</span></td>
                    <td>{p.date}</td>
                    <td style={{ fontWeight: '500' }}>{p.supplier_name}</td>
                    <td style={{ fontWeight: '500' }}>{p.raw_material_name}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)', fontWeight: '600' }}>{p.quantity_kg?.toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>₹{p.rate_per_kg}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700' }}>₹{p.total_amount?.toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.invoice_number || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--primary)' }}>{p.manager_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
