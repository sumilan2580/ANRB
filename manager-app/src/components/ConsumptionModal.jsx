import React, { useState, useEffect } from 'react';
import { X, Layers, Plus, Trash2, AlertCircle, CheckCircle2, Factory } from 'lucide-react';
import { api } from '../api';

export default function ConsumptionModal({ isOpen, onClose, onSuccess }) {
  const [productionOrders, setProductionOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productionOrderId, setProductionOrderId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-item raw materials issued
  const [items, setItems] = useState([
    { rawMaterialId: '', quantity: '', unit: 'KG', batchLot: '' }
  ]);

  useEffect(() => {
    if (isOpen) {
      loadDropdowns();
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  async function loadDropdowns() {
    setLoading(true);
    try {
      const [pos, machs, shs, rms] = await Promise.all([
        api.getProductionOrders().catch(() => []),
        api.getMachines(),
        api.getShifts(),
        api.getRawMaterials()
      ]);
      setProductionOrders(pos || []);
      setMachines(machs || []);
      setShifts(shs || []);
      setRawMaterials(rms || []);

      if (machs && machs.length > 0 && !machineId) setMachineId(machs[0].id);
      if (shs && shs.length > 0 && !shiftId) setShiftId(shs[0].id);
      if (rms && rms.length > 0 && items[0].rawMaterialId === '') {
        setItems([{ rawMaterialId: rms[0].id, quantity: '', unit: 'KG', batchLot: '' }]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load master dropdowns.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddItem = () => {
    const defaultRmId = rawMaterials.length > 0 ? rawMaterials[0].id : '';
    setItems([...items, { rawMaterialId: defaultRmId, quantity: '', unit: 'KG', batchLot: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    setItems(next);
  };

  const totalIssuedKg = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.rawMaterialId) {
        setError(`Please select a raw material for item #${i + 1}.`);
        return;
      }
      const q = Number(it.quantity);
      if (isNaN(q) || q <= 0) {
        setError(`Item #${i + 1} must have quantity greater than 0.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        productionOrderId: productionOrderId ? Number(productionOrderId) : null,
        machineId: machineId ? Number(machineId) : null,
        shiftId: shiftId ? Number(shiftId) : null,
        status: 'Issued',
        items: items.map(it => ({
          rawMaterialId: Number(it.rawMaterialId),
          quantity: Number(it.quantity),
          unit: it.unit || 'KG',
          batchLot: it.batchLot || null
        })),
        remarks: remarks || ''
      };

      const res = await api.createConsumptionBatch(payload);
      setSuccess(`Material Issue Batch ${res.batch_no || ''} confirmed! ${totalIssuedKg} KG issued to floor.`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to record material issue.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '6px', borderRadius: '8px' }}>
              <Layers size={20} />
            </div>
            <div>
              <h2 className="modal-title">Material Issue (Consumption)</h2>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Issue raw materials to production floor</div>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert-banner error" style={{ marginBottom: '14px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="alert-banner success" style={{ marginBottom: '14px' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <div>{success}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Issue Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Link Customer Production Order (Optional)</label>
            <select
              className="form-select"
              value={productionOrderId}
              onChange={e => setProductionOrderId(e.target.value)}
            >
              <option value="">-- General Factory Issue (No Order) --</option>
              {productionOrders
                .filter(po => po.status !== 'Completed' && po.status !== 'Cancelled')
                .map(po => (
                  <option key={po.id} value={po.id}>
                    {po.order_no} — {po.customer_name || 'Customer'} ({po.product_name || 'Tripal'}, {po.required_quantity} {po.unit})
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Machine</label>
              <select
                className="form-select"
                value={machineId}
                onChange={e => setMachineId(e.target.value)}
              >
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Shift</label>
              <select
                className="form-select"
                value={shiftId}
                onChange={e => setShiftId(e.target.value)}
              >
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Raw Material Line Items */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Raw Materials to Issue</span>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  background: 'none',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Add Material
              </button>
            </div>

            {items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#38bdf8' }}>Item #{idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <select
                    className="form-select"
                    value={it.rawMaterialId}
                    onChange={e => handleItemChange(idx, 'rawMaterialId', e.target.value)}
                    required
                  >
                    <option value="">Select Raw Material…</option>
                    {rawMaterials.map(rm => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.category || 'Polymer'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                  <div>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Quantity (KG) *"
                      value={it.quantity}
                      onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      required
                      min="0.01"
                      step="any"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Lot / Silo #"
                      value={it.batchLot}
                      onChange={e => handleItemChange(idx, 'batchLot', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Total issued badge */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(56, 189, 248, 0.08)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#38bdf8',
              marginBottom: '10px'
            }}>
              <span>Total Material Issue</span>
              <span>{totalIssuedKg.toLocaleString()} KG</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Floor Remarks / Shift Notes</label>
            <input
              type="text"
              className="form-input"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Issued for Extruder Line 1 Morning"
            />
          </div>

          <button
            type="submit"
            className="btn-primary-mobile"
            disabled={submitting || loading}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {submitting ? 'Confirming Material Issue…' : `Confirm Issue (${totalIssuedKg} KG)`}
          </button>
        </form>
      </div>
    </div>
  );
}
