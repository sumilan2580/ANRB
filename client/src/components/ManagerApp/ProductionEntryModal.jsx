import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Factory, Plus, Trash2, CheckCircle2, AlertCircle, Layers, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '../../api';

// ─── Searchable Select Dropdown (Portaled) ─────────────────────────────
function SearchableSelect({ value, onChange, options, placeholder = 'Search...', required = false, style = {}, inputStyle = {} }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 220;
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setCoords({
        top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 180)
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      const handleScroll = (e) => {
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
        updateCoords();
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || String(o.value).toLowerCase().includes(query.toLowerCase()))
    : options;

  const matchedOpt = options.find(o => String(o.value) === String(value));
  const displayLabel = matchedOpt ? matchedOpt.label : '';

  const handleSelect = (optVal) => {
    onChange(optVal);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={open ? query : displayLabel}
          onChange={e => { setQuery(e.target.value); setOpen(true); updateCoords(); }}
          onFocus={() => { setOpen(true); setQuery(''); updateCoords(); }}
          placeholder={placeholder}
          required={required && !value}
          className="form-input"
          style={{ paddingRight: '28px', fontSize: '12px', padding: '6px 28px 6px 8px', ...inputStyle }}
        />
        <ChevronDown
          size={13}
          color="var(--text-dim)"
          style={{
            position: 'absolute', right: '8px', top: '50%',
            transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
            transition: 'transform 0.15s ease',
            pointerEvents: 'none'
          }}
        />
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999,
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
            borderRadius: '8px',
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 16px 40px rgba(0,0,0,0.65)'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
              No matches found
            </div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt.value}
                onMouseDown={() => handleSelect(String(opt.value))}
                style={{
                  padding: '7px 10px', cursor: 'pointer', fontSize: '12px',
                  color: String(opt.value) === String(value) ? 'var(--emerald, #10b981)' : 'var(--text-main, #f8fafc)',
                  background: String(opt.value) === String(value) ? 'rgba(16,185,129,0.12)' : 'transparent',
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = String(opt.value) === String(value) ? 'rgba(16,185,129,0.12)' : 'transparent'}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ProductionEntryModal({
  isOpen,
  onClose,
  onSuccess,
  managerProfile,
  preSelectedBatchId = null
}) {
  const [consumptionBatches, setConsumptionBatches] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Selected Material Issue Batch
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Production Outputs (Multi-line FG outputs)
  const [outputs, setOutputs] = useState([
    { id: 1, finishedProductId: '', quantity: '', unit: 'KG' }
  ]);

  // Wastage Fields
  const [totalWastage, setTotalWastage] = useState('');
  const [wastageUnit, setWastageUnit] = useState('KG');
  const [wastageReason, setWastageReason] = useState('Machine Waste');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      setError('');
    }
  }, [isOpen, preSelectedBatchId]);

  async function loadData() {
    setLoading(true);
    try {
      const [batches, fgs] = await Promise.all([
        api.getConsumptionBatches(),
        api.getFinishedGoods()
      ]);

      const activeFGs = (fgs || []).filter(f => f.status === 'active');
      setFinishedGoods(activeFGs);
      setConsumptionBatches(batches || []);

      // If preSelectedBatchId was provided, select it
      if (preSelectedBatchId) {
        setSelectedBatchId(String(preSelectedBatchId));
      } else {
        // Automatically preselect first available "Issued" batch that isn't completed
        const available = (batches || []).filter(b => b.status === 'Issued' && b.production_status !== 'Completed');
        if (available.length > 0) {
          setSelectedBatchId(String(available[0].id));
        } else {
          setSelectedBatchId('');
        }
      }

      // Initialize default output line
      if (activeFGs.length > 0) {
        setOutputs([{
          id: Date.now(),
          finishedProductId: String(activeFGs[0].id),
          quantity: '',
          unit: activeFGs[0].unit || 'KG'
        }]);
      } else {
        setOutputs([{ id: Date.now(), finishedProductId: '', quantity: '', unit: 'KG' }]);
      }
      setTotalWastage('');
      setWastageUnit('KG');
      setWastageReason('Machine Waste');
      setRemarks('');
    } catch (err) {
      setError('Failed to load production data: ' + err.message);
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
        id: Date.now() + Math.random(),
        finishedProductId: firstFG ? String(firstFG.id) : '',
        quantity: '',
        unit: firstFG ? (firstFG.unit || 'KG') : 'KG'
      }
    ]);
  };

  const handleRemoveOutput = (idToRemove) => {
    if (outputs.length <= 1) return;
    setOutputs(outputs.filter(o => o.id !== idToRemove));
  };

  const handleOutputChange = (id, field, value) => {
    setOutputs(outputs.map(o => {
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

      await api.createProduction({
        consumptionBatchId: parseInt(selectedBatchId),
        productionOrderId: selectedBatch.production_order_id || null,
        machineId: selectedBatch.machine_id || null,
        shiftId: selectedBatch.shift_id || null,
        date: selectedBatch.date || new Date().toISOString().split('T')[0],
        outputs: outputs.map(o => ({
          finishedProductId: parseInt(o.finishedProductId),
          quantity: parseFloat(o.quantity),
          unit: o.unit || 'KG'
        })),
        totalWastage: wasteQty,
        wastageUnit: wastageUnit || 'KG',
        wastageReason,
        remarks,
        managerName: managerProfile?.name || 'Admin',
        managerId: managerProfile?.id || null,
        deviceId: managerProfile?.deviceId || localStorage.getItem('tripal_device_id') || ''
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record manufacturing entry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filter available batches: show Issued batches first
  const issuedBatches = consumptionBatches.filter(b => b.status === 'Issued' && b.production_status !== 'Completed');
  const completedBatches = consumptionBatches.filter(b => b.production_status === 'Completed' || b.status === 'Completed');

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
      <div className="modal-content" style={{ maxWidth: '880px', width: '95%' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.15))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Factory size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px' }}>Manufacturing / Production Entry</h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Step: Select Material Issue Batch &rarr; Record Output & Wastage
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px' }}>
            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="animate-spin" /> Loading issue batches...
              </div>
            ) : (
              <>
                {/* 1. SELECT MATERIAL ISSUE BATCH */}
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Layers size={15} /> Select Material Issue Batch *
                  </label>

                  <select
                    className="form-select"
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    required
                    style={{ fontSize: '13px', padding: '9px 12px', fontWeight: '600' }}
                  >
                    <option value="">-- Choose an Issued Material Batch --</option>
                    {issuedBatches.length > 0 && (
                      <optgroup label="Ready for Production (Issued)">
                        {issuedBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batch_no} | {b.date} | {b.production_order_no ? `Order: ${b.production_order_no}` : 'General Issue'} | {b.machine_name || 'Machine'} | {b.items?.length || 0} Materials
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {completedBatches.length > 0 && (
                      <optgroup label="Already Completed (Read-Only / Ineligible)">
                        {completedBatches.map(b => (
                          <option key={b.id} value={b.id} disabled>
                            {b.batch_no} | {b.date} | COMPLETED
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {selectedBatch && (
                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Issue Batch #</div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--cyan)' }}>{selectedBatch.batch_no}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Production Order</div>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedBatch.production_order_no || 'General Issue'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Machine</div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{selectedBatch.machine_name || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Shift</div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{selectedBatch.shift_name || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Issue Date</div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{selectedBatch.date}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Issued By</div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{selectedBatch.manager_name}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. MATERIALS CONSUMED (READ-ONLY) */}
                {selectedBatch && (
                  <div style={{ marginBottom: '18px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Materials Consumed (From Issue Batch {selectedBatch.batch_no})
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--amber)', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: '10px' }}>
                        READ ONLY (Pre-Allocated & Stock Deducted)
                      </span>
                    </div>

                    <table className="custom-table" style={{ fontSize: '12px', width: '100%' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                          <th style={{ textAlign: 'left', width: '50%' }}>Material Name</th>
                          <th style={{ textAlign: 'right', width: '25%' }}>Quantity</th>
                          <th style={{ textAlign: 'center', width: '15%' }}>Unit</th>
                          <th style={{ textAlign: 'left', width: '10%' }}>Lot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!selectedBatch.items || selectedBatch.items.length === 0) ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No material items recorded in this issue batch.</td></tr>
                        ) : selectedBatch.items.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{it.raw_material_name}</td>
                            <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: 'var(--cyan)' }}>
                              {Number(it.quantity).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`pill ${it.unit === 'PCS' ? 'pill-amber' : 'pill-cyan'}`} style={{ fontSize: '10.5px' }}>
                                {it.unit}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{it.batch_lot || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. FINISHED GOODS OUTPUT */}
                <div style={{ marginBottom: '18px', background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--emerald)', margin: 0 }}>
                      Finished Goods Output *
                    </label>
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAddOutput} style={{ color: 'var(--emerald)', borderColor: 'var(--emerald)' }}>
                      <Plus size={13} /> Add Output Line
                    </button>
                  </div>

                  <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table className="custom-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                          <th style={{ width: '55%' }}>Product Specification *</th>
                          <th style={{ width: '25%' }}>Output Quantity *</th>
                          <th style={{ width: '15%' }}>Unit</th>
                          <th style={{ width: '5%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {outputs.map((out) => (
                          <tr key={out.id}>
                            <td>
                              <SearchableSelect
                                value={out.finishedProductId}
                                onChange={v => handleOutputChange(out.id, 'finishedProductId', v)}
                                options={[
                                  { value: '', label: 'Select Finished Product...' },
                                  ...finishedGoods.map(fg => ({
                                    value: String(fg.id),
                                    label: `${fg.product_name} ${fg.gsm ? `(${fg.gsm} GSM)` : ''} ${fg.width_size ? `[${fg.width_size}]` : ''} - ${fg.product_code}`
                                  }))
                                ]}
                                placeholder="Search finished product..."
                                required
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                placeholder="e.g. 80"
                                step="any"
                                min="0.01"
                                value={out.quantity}
                                onChange={e => handleOutputChange(out.id, 'quantity', e.target.value)}
                                required
                              />
                            </td>

                            <td>
                              <span className="pill pill-emerald" style={{ fontWeight: '700', fontSize: '11px' }}>
                                {out.unit || 'KG'}
                              </span>
                            </td>

                            <td>
                              {outputs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOutput(out.id)}
                                  title="Remove line"
                                  style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. WASTAGE SECTION */}
                <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--amber)', marginBottom: '10px', display: 'block' }}>
                    Process Wastage / Scrap
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <label className="form-label">Wastage Quantity</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 5"
                        step="any"
                        min="0"
                        value={totalWastage}
                        onChange={e => setTotalWastage(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label">Wastage Unit</label>
                      <select className="form-select" value={wastageUnit} onChange={e => setWastageUnit(e.target.value)}>
                        <option value="KG">KG</option>
                        <option value="PCS">PCS</option>
                        <option value="METER">Meter</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Wastage Reason</label>
                      <select className="form-select" value={wastageReason} onChange={e => setWastageReason(e.target.value)}>
                        <option value="Machine Waste">Machine Waste</option>
                        <option value="Edge Trim">Edge Trim</option>
                        <option value="Scrap Film">Scrap Film</option>
                        <option value="Startup Purge">Startup Purge</option>
                        <option value="Defective Roll">Defective Roll</option>
                        <option value="Eyelet / Punch Scrap">Eyelet / Punch Scrap</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Production Remarks</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Optional remarks"
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || loading || !selectedBatchId}>
              {submitting ? 'Saving Production...' : 'Save Production Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
