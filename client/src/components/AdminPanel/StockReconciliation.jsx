import React, { useState, useEffect } from 'react';
import { Scale, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../../api';

export default function StockReconciliation() {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [itemType, setItemType] = useState('RAW_MATERIAL');
  const [itemId, setItemId] = useState('');
  const [physicalQty, setPhysicalQty] = useState('');
  const [reason, setReason] = useState('');
  const [adjustedBy, setAdjustedBy] = useState('Admin');
  const [preview, setPreview] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [rm, fg, hist] = await Promise.all([
        api.getRawMaterialStock(),
        api.getFinishedGoodsStock(),
        api.getReconciliations()
      ]);
      setRawMaterials(rm);
      setFinishedGoods(fg);
      setHistory(hist);

      if (rm.length > 0) setItemId(rm[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Build preview
  useEffect(() => {
    const items = itemType === 'RAW_MATERIAL' ? rawMaterials : finishedGoods;
    const selectedItem = items.find(i => String(i.id) === String(itemId));
    const pQty = parseFloat(physicalQty);

    if (selectedItem && !isNaN(pQty) && pQty >= 0) {
      const systemQty = selectedItem.current_stock_kg || 0;
      const diff = pQty - systemQty;
      let status = 'MATCHED';
      if (Math.abs(diff) > 0.001) status = diff < 0 ? 'SHORT' : 'EXCESS';
      setPreview({
        item: selectedItem,
        systemQty,
        physicalQty: pQty,
        diff,
        status
      });
    } else {
      setPreview(null);
    }
  }, [itemId, itemType, physicalQty, rawMaterials, finishedGoods]);

  const handleItemTypeChange = (type) => {
    setItemType(type);
    setItemId('');
    setPhysicalQty('');
    setPreview(null);
    const items = type === 'RAW_MATERIAL' ? rawMaterials : finishedGoods;
    if (items.length > 0) setItemId(items[0].id);
  };

  const handleReconcile = async (e) => {
    e.preventDefault();
    if (!preview) return;
    setError('');
    setSuccessMsg('');

    try {
      setSubmitting(true);
      const result = await api.createReconciliation({
        itemType,
        itemId: parseInt(itemId),
        physicalQuantityKg: preview.physicalQty,
        reason: reason || 'Physical count reconciliation',
        adjustedBy
      });

      setSuccessMsg(`✓ Reconciliation ${result.adjustment_code} saved. Status: ${result.status}. Difference: ${result.differenceKg} KG.`);
      setPhysicalQty('');
      setReason('');
      setPreview(null);
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to record reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = {
    MATCHED: { color: 'var(--emerald)', icon: <CheckCircle2 size={16} />, bg: 'var(--emerald-bg)', label: 'MATCHED' },
    SHORT: { color: 'var(--rose)', icon: <TrendingDown size={16} />, bg: 'var(--rose-bg)', label: 'SHORT' },
    EXCESS: { color: 'var(--amber)', icon: <TrendingUp size={16} />, bg: 'var(--amber-bg)', label: 'EXCESS' }
  };

  const currentItems = itemType === 'RAW_MATERIAL' ? rawMaterials : finishedGoods;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><Scale size={22} /> Stock Reconciliation</h2>
          <p>Compare physical count with system stock and log any discrepancies</p>
        </div>
        <button className="btn btn-outline" onClick={loadAll}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Reconciliation Form */}
        <div className="table-container" style={{ borderRadius: 'var(--radius-md)', overflow: 'visible' }}>
          <div className="table-toolbar">
            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '14px' }}>Physical Count Entry</span>
          </div>

          <form onSubmit={handleReconcile} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px' }}>
                {error}
              </div>
            )}
            {successMsg && (
              <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px' }}>
                {successMsg}
              </div>
            )}

            {/* Item Type Toggle */}
            <div>
              <label className="form-label">Inventory Type</label>
              <div className="view-mode-toggle" style={{ marginTop: '6px', width: '100%' }}>
                <button
                  type="button"
                  className={`mode-btn ${itemType === 'RAW_MATERIAL' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => handleItemTypeChange('RAW_MATERIAL')}
                >Raw Material</button>
                <button
                  type="button"
                  className={`mode-btn ${itemType === 'FINISHED_GOOD' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => handleItemTypeChange('FINISHED_GOOD')}
                >Finished Good</button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select Item *</label>
              <select
                className="form-select"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
              >
                {currentItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {itemType === 'RAW_MATERIAL'
                      ? `${item.name} (Stock: ${item.current_stock_kg?.toLocaleString()} KG)`
                      : `${item.product_name} ${item.gsm} GSM ${item.width_size} ${item.colour} — ${item.current_stock_kg?.toLocaleString()} KG`
                    }
                  </option>
                ))}
              </select>
            </div>

            {/* System Stock Preview */}
            {preview && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>System Stock</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                      {preview.systemQty?.toLocaleString()} KG
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Physical Stock</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                      {preview.physicalQty?.toLocaleString()} KG
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Difference</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: preview.diff < 0 ? 'var(--rose)' : preview.diff > 0 ? 'var(--amber)' : 'var(--emerald)' }}>
                      {preview.diff > 0 ? '+' : ''}{preview.diff?.toFixed(2)} KG
                    </div>
                  </div>
                </div>

                {preview.status && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: '8px',
                    background: statusConfig[preview.status].bg,
                    color: statusConfig[preview.status].color,
                    fontWeight: '700',
                    fontSize: '14px'
                  }}>
                    {statusConfig[preview.status].icon}
                    {preview.status === 'MATCHED' && 'Physical stock MATCHES system stock — No adjustment needed'}
                    {preview.status === 'SHORT' && `System stock is SHORT by ${Math.abs(preview.diff).toLocaleString()} KG vs physical count`}
                    {preview.status === 'EXCESS' && `System stock shows EXCESS of ${preview.diff.toLocaleString()} KG over physical count`}
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Physical Count (KG) *</label>
              <input
                type="number"
                step="any"
                className="form-input num-mono"
                style={{ fontSize: '18px', fontWeight: '700' }}
                placeholder="Enter actual physical count in KG"
                value={physicalQty}
                onChange={(e) => setPhysicalQty(e.target.value)}
                required
              />
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason / Note *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Annual physical count, Q3 audit"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Adjusted By</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Admin Name"
                  value={adjustedBy}
                  onChange={(e) => setAdjustedBy(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
              disabled={submitting || !preview}
            >
              <Scale size={16} />
              {submitting ? 'Recording Reconciliation...' : 'Record Reconciliation & Adjust Stock'}
            </button>
          </form>
        </div>

        {/* Reconciliation History */}
        <div className="table-container" style={{ overflow: 'visible' }}>
          <div className="table-toolbar">
            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '14px' }}>
              Reconciliation History ({history.length})
            </span>
          </div>

          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No reconciliation records found
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Date</th>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>System KG</th>
                    <th style={{ textAlign: 'right' }}>Physical KG</th>
                    <th style={{ textAlign: 'right' }}>Difference</th>
                    <th>Status</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(rec => (
                    <tr key={rec.id}>
                      <td><span className="num-mono pill pill-cyan" style={{ fontSize: '11px' }}>{rec.adjustment_code}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rec.date}</td>
                      <td style={{ fontSize: '12.5px', fontWeight: '500' }}>{rec.item_name}</td>
                      <td className="num-mono" style={{ textAlign: 'right' }}>{rec.system_quantity_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right' }}>{rec.physical_quantity_kg?.toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: rec.difference_kg < 0 ? 'var(--rose)' : rec.difference_kg > 0 ? 'var(--amber)' : 'var(--emerald)' }}>
                        {rec.difference_kg > 0 ? '+' : ''}{rec.difference_kg?.toFixed(2)}
                      </td>
                      <td>
                        <span className={`pill ${rec.status === 'MATCHED' ? 'pill-emerald' : rec.status === 'SHORT' ? 'pill-rose' : 'pill-amber'}`}>
                          {statusConfig[rec.status]?.icon} {rec.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--primary)' }}>{rec.adjusted_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
