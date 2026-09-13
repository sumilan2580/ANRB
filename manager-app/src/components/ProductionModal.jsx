import React, { useState, useEffect } from 'react';
import { X, Factory, Plus, Trash2, AlertCircle, CheckCircle2, Layers, RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function ProductionModal({ isOpen, onClose, onSuccess }) {
  const [consumptionBatches, setConsumptionBatches] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Material Issue Batch
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Multi-outputs array: [{ id, finishedProductId, quantity, unit }]
  const [outputs, setOutputs] = useState([
    { id: 1, finishedProductId: '', quantity: '', unit: 'KG' }
  ]);

  const [totalWastage, setTotalWastage] = useState('');
  const [wastageUnit, setWastageUnit] = useState('KG');
  const [wastageReason, setWastageReason] = useState('Machine Waste');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  async function loadData() {
    setLoading(true);
    try {
      const [batches, fgs] = await Promise.all([
        api.getConsumptionBatches(),
        api.getFinishedGoods()
      ]);

      const activeFGs = (fgs || []).filter(f => f.status === 'active' || !f.status);
      setFinishedGoods(activeFGs);
      setConsumptionBatches(batches || []);

      // Pre-select first eligible issued batch if available
      const available = (batches || []).filter(b => b.status === 'Issued' && b.production_status !== 'Completed');
      if (available.length > 0) {
        setSelectedBatchId(String(available[0].id));
      } else {
        setSelectedBatchId('');
      }

      if (activeFGs.length > 0) {
        setOutputs([{ id: Date.now(), finishedProductId: String(activeFGs[0].id), quantity: '', unit: activeFGs[0].unit || 'KG' }]);
      } else {
        setOutputs([{ id: Date.now(), finishedProductId: '', quantity: '', unit: 'KG' }]);
      }

      setTotalWastage('');
      setWastageUnit('KG');
      setWastageReason('Machine Waste');
      setRemarks('');
    } catch (err) {
      setError(err.message || 'Failed to load production masters.');
    } finally {
      setLoading(false);
    }
  }

  const selectedBatch = consumptionBatches.find(b => String(b.id) === String(selectedBatchId));

  const handleAddOutput = () => {
    const firstFG = finishedGoods[0];
    setOutputs([
      ...outputs,
      {
        id: Date.now(),
        finishedProductId: firstFG ? String(firstFG.id) : '',
        quantity: '',
        unit: firstFG ? (firstFG.unit || 'KG') : 'KG'
      }
    ]);
  };

  const handleRemoveOutput = (idToRemove) => {
    if (outputs.length <= 1) return;
    setOutputs(outputs.filter((o) => o.id !== idToRemove));
  };

  const handleOutputChange = (id, field, value) => {
    setOutputs(outputs.map((o) => {
      if (o.id !== id) return o;
      const updated = { ...o, [field]: value };
      if (field === 'finishedProductId') {
        const fg = finishedGoods.find(f => String(f.id) === String(value));
        if (fg) updated.unit = fg.unit || 'KG';
      }
      return updated;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedBatchId) {
      setError('Please select a Material Issue Batch to start production.');
      return;
    }

    if (!selectedBatch) {
      setError('Selected Material Issue Batch was not found.');
      return;
    }

    if (selectedBatch.production_status === 'Completed' || selectedBatch.status === 'Completed') {
      setError('This Material Issue Batch has already been used in a Production Entry.');
      return;
    }

    if (outputs.length === 0) {
      setError('Please add at least one Finished Goods Output line.');
      return;
    }

    for (const out of outputs) {
      const q = parseFloat(out.quantity) || 0;
      if (!out.finishedProductId || q <= 0) {
        setError('Every finished good output must have a valid product and quantity (> 0).');
        return;
      }
    }

    const wasteQty = parseFloat(totalWastage) || 0;
    if (wasteQty < 0) {
      setError('Wastage quantity cannot be negative.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await api.createProduction({
        consumptionBatchId: parseInt(selectedBatchId),
        productionOrderId: selectedBatch.production_order_id || null,
        machineId: selectedBatch.machine_id || null,
        shiftId: selectedBatch.shift_id || null,
        date: selectedBatch.date || new Date().toISOString().split('T')[0],
        outputs: outputs.map((o) => ({
          finishedProductId: parseInt(o.finishedProductId),
          quantity: parseFloat(o.quantity),
          unit: o.unit || 'KG'
        })),
        totalWastage: wasteQty,
        wastageUnit: wastageUnit || 'KG',
        wastageReason,
        remarks
      });

      setSuccess(`Production batch recorded! Batch Code: ${res.batch_code || 'PROD-SUCCESS'}`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Error saving production batch');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const issuedBatches = consumptionBatches.filter(b => b.status === 'Issued' && b.production_status !== 'Completed');
  const completedBatches = consumptionBatches.filter(b => b.production_status === 'Completed' || b.status === 'Completed');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Factory size={20} color="#34d399" />
            <span>Manufacturing / Production Entry</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert-banner error" style={{ marginBottom: '12px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-banner success" style={{ marginBottom: '12px' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
              Loading Material Issue Batches...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* 1. SELECT MATERIAL ISSUE BATCH */}
              <div className="form-group" style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '700', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Layers size={15} /> Select Material Issue Batch *
                </label>
                <select
                  className="form-select"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  required
                >
                  <option value="">-- Select Material Issue Batch --</option>
                  {issuedBatches.length > 0 && (
                    <optgroup label="Ready for Production (Issued)">
                      {issuedBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batch_no} | {b.date} | {b.production_order_no ? `Order: ${b.production_order_no}` : 'General Issue'} | {b.machine_name || 'Machine'} ({b.items?.length || 0} Materials)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {completedBatches.length > 0 && (
                    <optgroup label="Already Completed (Ineligible)">
                      {completedBatches.map((b) => (
                        <option key={b.id} value={b.id} disabled>
                          {b.batch_no} | {b.date} | COMPLETED
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {selectedBatch && (
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '6px', fontSize: '11.5px' }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block' }}>Issue Batch:</span>
                      <strong style={{ color: 'var(--cyan)' }}>{selectedBatch.batch_no}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block' }}>Production Order:</span>
                      <strong>{selectedBatch.production_order_no || 'General Issue'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block' }}>Machine:</span>
                      <span>{selectedBatch.machine_name || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block' }}>Shift:</span>
                      <span>{selectedBatch.shift_name || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block' }}>Issue Date:</span>
                      <span>{selectedBatch.date}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block' }}>Issued By:</span>
                      <span>{selectedBatch.manager_name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. MATERIALS CONSUMED (READ-ONLY) */}
              {selectedBatch && (
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-main)' }}>
                      Materials Consumed
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--amber)', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      READ ONLY
                    </span>
                  </div>

                  <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                    {(!selectedBatch.items || selectedBatch.items.length === 0) ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                        No items recorded in batch.
                      </div>
                    ) : (
                      selectedBatch.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '12px' }}>
                          <span style={{ fontWeight: '500' }}>{it.raw_material_name}</span>
                          <span style={{ fontWeight: '700', color: 'var(--cyan)' }}>
                            {Number(it.quantity).toLocaleString()} <span style={{ fontSize: '10px', color: it.unit === 'PCS' ? 'var(--amber)' : 'var(--emerald)' }}>{it.unit}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 3. FINISHED GOODS OUTPUT */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: '700', color: 'var(--emerald)' }}>
                    Finished Goods Output *
                  </label>
                  <button
                    type="button"
                    className="btn-add-line"
                    onClick={handleAddOutput}
                    style={{ margin: 0, padding: '4px 8px', fontSize: '11px' }}
                  >
                    <Plus size={13} />
                    <span>Add Line</span>
                  </button>
                </div>

                {outputs.map((out, index) => (
                  <div key={out.id} className="output-item" style={{ marginBottom: '8px', padding: '10px' }}>
                    <div className="output-header" style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                        Output Line #{index + 1}
                      </span>
                      {outputs.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon-delete"
                          onClick={() => handleRemoveOutput(out.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: '6px' }}>
                      <select
                        className="form-select"
                        value={out.finishedProductId}
                        onChange={(e) => handleOutputChange(out.id, 'finishedProductId', e.target.value)}
                        required
                        style={{ fontSize: '12px' }}
                      >
                        <option value="">Select Finished Product...</option>
                        {finishedGoods.map((fg) => (
                          <option key={fg.id} value={fg.id}>
                            {fg.product_name} {fg.gsm ? `(${fg.gsm} GSM)` : ''} - {fg.product_code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        className="form-input num-input"
                        placeholder="Quantity"
                        value={out.quantity}
                        onChange={(e) => handleOutputChange(out.id, 'quantity', e.target.value)}
                        required
                        style={{ flex: 1, fontSize: '13px' }}
                      />
                      <span className="pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '11.5px' }}>
                        {out.unit || 'KG'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 4. WASTAGE SECTION */}
              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: '700', color: 'var(--amber)', marginBottom: '8px', display: 'block', fontSize: '12px' }}>
                  Wastage / Scrap
                </label>

                <div className="form-row" style={{ marginBottom: '8px' }}>
                  <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Wastage Qty</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-input num-input"
                      placeholder="0"
                      value={totalWastage}
                      onChange={(e) => setTotalWastage(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Unit</label>
                    <select
                      className="form-select"
                      value={wastageUnit}
                      onChange={(e) => setWastageUnit(e.target.value)}
                    >
                      <option value="KG">KG</option>
                      <option value="PCS">PCS</option>
                      <option value="METER">Meter</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Wastage Reason</label>
                  <select
                    className="form-select"
                    value={wastageReason}
                    onChange={(e) => setWastageReason(e.target.value)}
                  >
                    <option value="Machine Waste">Machine Waste</option>
                    <option value="Edge Trim">Edge Trim</option>
                    <option value="Scrap Film">Scrap Film</option>
                    <option value="Startup Purge">Startup Purge</option>
                    <option value="Defective Roll">Defective Roll</option>
                    <option value="Eyelet / Punch Scrap">Eyelet / Punch Scrap</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Smooth batch execution"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="btn-submit btn-green"
                  disabled={submitting || loading || !selectedBatchId}
                >
                  {submitting ? 'Saving Production...' : 'Save Production Batch'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
