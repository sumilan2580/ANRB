import React, { useState, useEffect } from 'react';
import { Layers, Package, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { api } from '../../api';

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

export default function StockLedger() {
  const [activeTab, setActiveTab] = useState('rm-stock'); // rm-stock, fg-stock, ledger
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [ledgerType, setLedgerType] = useState('RAW_MATERIAL');
  const [loading, setLoading] = useState(true);
  const [rmSearch, setRmSearch] = useState('');
  const [fgSearch, setFgSearch] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      loadLedger();
    }
  }, [activeTab, ledgerType]);

  async function loadAll() {
    setLoading(true);
    try {
      const [rm, fg] = await Promise.all([
        api.getRawMaterialStock(),
        api.getFinishedGoodsStock()
      ]);
      setRawMaterials(rm);
      setFinishedGoods(fg);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger() {
    setLoading(true);
    try {
      const data = await api.getStockLedger(`type=${ledgerType}`);
      setLedger(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getMovementColor = (movType) => {
    if (movType === 'PURCHASE' || movType === 'PRODUCTION') return 'var(--emerald)';
    if (movType === 'PRODUCTION_CONSUMPTION' || movType === 'SALE') return 'var(--rose)';
    return 'var(--amber)';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><Layers size={22} /> Inventory Stock Ledger</h2>
          <p>Real-time transaction-based stock positions and movement history</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadAll}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="view-mode-toggle" style={{ marginBottom: '20px', width: 'fit-content' }}>
        {[
          { id: 'rm-stock', label: 'Raw Material Stock' },
          { id: 'fg-stock', label: 'Finished Goods Stock' },
          { id: 'ledger', label: 'Movement Ledger' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`mode-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw size={22} className="animate-spin" style={{ marginRight: '10px' }} />
          Loading inventory data...
        </div>
      ) : activeTab === 'rm-stock' ? (
        <div className="table-container">
          <div className="table-toolbar">
            <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '13px' }}>
              Raw Material Inventory — {rawMaterials.filter(rm => !rmSearch || rm.name?.toLowerCase().includes(rmSearch.toLowerCase()) || rm.code?.toLowerCase().includes(rmSearch.toLowerCase()) || rm.category?.toLowerCase().includes(rmSearch.toLowerCase())).length} items
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search material..."
                  value={rmSearch}
                  onChange={e => setRmSearch(e.target.value)}
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', width: '200px' }}
                />
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => exportCSV(rawMaterials, 'raw_material_stock.csv')}>
                Export CSV
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Material Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Unit</th>
                  <th style={{ textAlign: 'right' }}>Purchased</th>
                  <th style={{ textAlign: 'right' }}>Consumed</th>
                  <th style={{ textAlign: 'right' }}>Adjusted</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th>Alert Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.filter(rm => !rmSearch || rm.name?.toLowerCase().includes(rmSearch.toLowerCase()) || rm.code?.toLowerCase().includes(rmSearch.toLowerCase()) || rm.category?.toLowerCase().includes(rmSearch.toLowerCase())).map(rm => {
                  const isLow = rm.current_stock_kg <= rm.min_stock_alert;
                  return (
                    <tr key={rm.id}>
                      <td><span className="pill pill-cyan num-mono">{rm.code}</span></td>
                      <td style={{ fontWeight: '600' }}>{rm.name}</td>
                      <td><span className="pill pill-indigo">{rm.category}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="pill" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', fontSize: '11px', fontWeight: '700' }}>
                          {rm.unit || 'KG'}
                        </span>
                      </td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>+{rm.total_purchased_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--rose)' }}>-{rm.total_consumed_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>{rm.total_adjusted_kg?.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong className="num-mono" style={{ fontSize: '14px', color: isLow ? 'var(--amber)' : 'var(--text-main)' }}>
                          {rm.current_stock_kg?.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>{rm.unit || 'KG'}</span>
                        </strong>
                      </td>
                      <td>
                        {isLow && (
                          <span className="pill pill-amber">
                            <AlertCircle size={11} /> Low — Min {rm.min_stock_alert} {rm.unit || 'KG'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${rm.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>
                          {rm.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'fg-stock' ? (
        <div className="table-container">
          <div className="table-toolbar">
            <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '13px' }}>
              Finished Goods Inventory — {finishedGoods.filter(fg => !fgSearch || fg.product_name?.toLowerCase().includes(fgSearch.toLowerCase()) || fg.product_code?.toLowerCase().includes(fgSearch.toLowerCase()) || fg.colour?.toLowerCase().includes(fgSearch.toLowerCase()) || String(fg.gsm || '').includes(fgSearch)).length} specifications
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search product, colour, GSM..."
                  value={fgSearch}
                  onChange={e => setFgSearch(e.target.value)}
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', width: '220px' }}
                />
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => exportCSV(finishedGoods, 'finished_goods_stock.csv')}>
                Export CSV
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product</th>
                  <th>GSM</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Grade</th>
                  <th style={{ textAlign: 'right' }}>Produced KG</th>
                  <th style={{ textAlign: 'right' }}>Sold KG</th>
                  <th style={{ textAlign: 'right' }}>Adjusted KG</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {finishedGoods.filter(fg => !fgSearch || fg.product_name?.toLowerCase().includes(fgSearch.toLowerCase()) || fg.product_code?.toLowerCase().includes(fgSearch.toLowerCase()) || fg.colour?.toLowerCase().includes(fgSearch.toLowerCase()) || String(fg.gsm || '').includes(fgSearch)).map(fg => (
                  <tr key={fg.id}>
                    <td><span className="pill pill-cyan num-mono">{fg.product_code}</span></td>
                    <td style={{ fontWeight: '600' }}>{fg.product_name}</td>
                    <td className="num-mono"><strong>{fg.gsm}</strong></td>
                    <td>{fg.width_size}</td>
                    <td>{fg.colour}</td>
                    <td><span className="pill pill-indigo" style={{ fontSize: '10px' }}>{fg.grade}</span></td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>+{fg.total_produced_kg?.toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--rose)' }}>-{fg.total_sold_kg?.toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>{fg.total_adjusted_kg?.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="num-mono" style={{ fontSize: '14px', color: fg.current_stock_kg > 0 ? 'var(--text-main)' : 'var(--text-dim)' }}>
                        {fg.current_stock_kg?.toLocaleString()} KG
                      </strong>
                    </td>
                    <td>
                      <span className={`pill ${fg.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>
                        {fg.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Ledger View
        <div>
          <div className="view-mode-toggle" style={{ marginBottom: '14px', width: 'fit-content' }}>
            <button
              className={`mode-btn ${ledgerType === 'RAW_MATERIAL' ? 'active' : ''}`}
              onClick={() => setLedgerType('RAW_MATERIAL')}
            >Raw Material</button>
            <button
              className={`mode-btn ${ledgerType === 'FINISHED_GOOD' ? 'active' : ''}`}
              onClick={() => setLedgerType('FINISHED_GOOD')}
            >Finished Goods</button>
          </div>

          <div className="table-container">
            <div className="table-toolbar">
              <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '13px' }}>
                Movement Ledger — {ledger.length} entries (last 300)
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => exportCSV(ledger, `${ledgerType.toLowerCase()}_ledger.csv`)}>
                Export CSV
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Material / Item</th>
                    <th>Transaction Type</th>
                    <th>Reference</th>
                    <th style={{ textAlign: 'right' }}>Qty Change (KG)</th>
                    <th style={{ textAlign: 'right' }}>Balance After</th>
                    <th>Manager</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((mov, i) => {
                    const isCredit = mov.quantity_change > 0;
                    return (
                      <tr key={i}>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(mov.created_at).toLocaleDateString('en-IN')}<br />
                          <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                            {new Date(mov.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{mov.item_name}</div>
                          {mov.item_code && <span className="pill pill-cyan" style={{ fontSize: '10px' }}>{mov.item_code}</span>}
                        </td>
                        <td>
                          <span className={`pill ${mov.movement_type === 'ADJUSTMENT' ? 'pill-amber' : isCredit ? 'pill-emerald' : 'pill-rose'}`}>
                            {mov.movement_type}
                          </span>
                        </td>
                        <td>
                          <span className="num-mono" style={{ fontSize: '12px', color: 'var(--primary)' }}>{mov.reference_id}</span>
                        </td>
                        <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: getMovementColor(mov.movement_type) }}>
                          {isCredit ? '+' : ''}{mov.quantity_change?.toLocaleString()}
                        </td>
                        <td className="num-mono" style={{ textAlign: 'right', fontWeight: '600' }}>
                          {mov.balance_after?.toLocaleString()} KG
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{mov.manager_name}</span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mov.remarks}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
