import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, AlertCircle, CheckCircle2, Plus, Trash2, Receipt } from 'lucide-react';
import { api } from '../api';

export default function PurchaseModal({ isOpen, onClose, onSuccess }) {
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Invoice Header
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseType, setPurchaseType] = useState('GST');
  const [paymentMode, setPaymentMode] = useState('Credit');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-item lines
  const [items, setItems] = useState([]);

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
      const [supps, rms] = await Promise.all([
        api.getSuppliers(),
        api.getRawMaterials()
      ]);
      setSuppliers(supps || []);
      setRawMaterials(rms || []);

      if (supps && supps.length > 0 && !supplierId) {
        setSupplierId(String(supps[0].id));
      }

      if (rms && rms.length > 0) {
        const first = rms[0];
        setItems([{
          id: Date.now(),
          rawMaterialId: String(first.id),
          quantity: '',
          unit: first.unit || 'KG',
          rate: '',
          gstPercent: String(first.gst_percent || 18)
        }]);
      } else {
        setItems([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load master dropdowns.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddItem = () => {
    const first = rawMaterials[0];
    setItems([
      ...items,
      {
        id: Date.now() + Math.random(),
        rawMaterialId: first ? String(first.id) : '',
        quantity: '',
        unit: first ? (first.unit || 'KG') : 'KG',
        rate: '',
        gstPercent: purchaseType === 'GST' ? String(first?.gst_percent || 18) : '0'
      }
    ]);
  };

  const handleRemoveItem = (id) => {
    if (items.length <= 1) return;
    setItems(items.filter(it => it.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      if (field === 'rawMaterialId') {
        const rm = rawMaterials.find(r => String(r.id) === String(value));
        if (rm) {
          updated.unit = rm.unit || 'KG';
          updated.gstPercent = purchaseType === 'GST' ? String(rm.gst_percent || 18) : '0';
        }
      }
      return updated;
    }));
  };

  const isGST = (purchaseType === 'GST');

  let totalTaxable = 0;
  let totalGst = 0;

  const calculatedLines = items.map(it => {
    const q = parseFloat(it.quantity) || 0;
    const r = parseFloat(it.rate) || 0;
    const taxable = q * r;
    const gstPct = isGST ? (parseFloat(it.gstPercent) || 0) : 0;
    const gstAmt = taxable * (gstPct / 100);
    const lineTotal = taxable + gstAmt;

    totalTaxable += taxable;
    totalGst += gstAmt;

    return { ...it, taxable, gstAmt, lineTotal };
  });

  const grandTotal = totalTaxable + totalGst;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) {
      setError('Please select a Supplier and at least one item.');
      return;
    }

    for (const it of items) {
      const q = parseFloat(it.quantity) || 0;
      const r = parseFloat(it.rate) || 0;
      if (!it.rawMaterialId || q <= 0 || r <= 0) {
        setError('Every item must have a valid Quantity (>0) and Rate (>0).');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await api.createPurchase({
        date,
        supplierId: parseInt(supplierId),
        purchaseType,
        paymentMode,
        invoiceNumber: invoiceNumber.trim() || undefined,
        remarks,
        items: items.map(it => ({
          rawMaterialId: parseInt(it.rawMaterialId),
          quantity: parseFloat(it.quantity),
          unit: it.unit || 'KG',
          rate: parseFloat(it.rate),
          discount: 0,
          gstPercent: isGST ? (parseFloat(it.gstPercent) || 0) : 0
        }))
      });

      setSuccess(`Purchase recorded! Voucher: ${res.purchase_code || 'SAVED'}`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Error submitting purchase');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-header-title">
            <ShoppingBag size={20} color="#60a5fa" />
            <span>Multi-Item RM Purchase</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert-banner error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-banner success">
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading form masters...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Header fields */}
              <div className="form-group">
                <label className="form-label">Purchase Date</label>
                <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Supplier *</label>
                <select className="form-control" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.gst_number || 'URP'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Bill / Challan #</label>
                  <input type="text" className="form-control" placeholder="e.g. INV-1001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tax Type</label>
                  <select className="form-control" value={purchaseType} onChange={e => {
                    setPurchaseType(e.target.value);
                    setItems(items.map(it => ({
                      ...it,
                      gstPercent: e.target.value === 'GST' ? '18' : '0'
                    })));
                  }}>
                    <option value="GST">GST Purchase</option>
                    <option value="NON_GST">Non-GST</option>
                  </select>
                </div>
              </div>

              {/* Items Card List */}
              <div style={{ margin: '14px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Purchase Items ({items.length})
                </span>
                <button type="button" onClick={handleAddItem} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  <Plus size={14} /> Add Item
                </button>
              </div>

              {calculatedLines.map((it, idx) => {
                const rm = rawMaterials.find(r => String(r.id) === String(it.rawMaterialId));
                return (
                  <div key={it.id} style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--cyan)' }}>
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => handleRemoveItem(it.id)} style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', padding: '2px' }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Raw Material</label>
                      <select className="form-control" value={it.rawMaterialId} onChange={e => handleItemChange(it.id, 'rawMaterialId', e.target.value)} required style={{ fontSize: '13px', padding: '7px 10px' }}>
                        <option value="">Select Material...</option>
                        {rawMaterials.map(r => (
                          <option key={r.id} value={r.id}>{r.name} [{r.unit}]</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0"
                          step="any"
                          min="0.01"
                          value={it.quantity}
                          onChange={e => handleItemChange(it.id, 'quantity', e.target.value)}
                          required
                          style={{ fontSize: '13px', padding: '7px 10px' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Unit</label>
                        <div style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '12px', fontWeight: '700', textAlign: 'center', color: it.unit === 'PCS' ? 'var(--amber)' : '#38bdf8' }}>
                          {it.unit}
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Rate ₹</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Rate"
                          step="0.01"
                          min="0.01"
                          value={it.rate}
                          onChange={e => handleItemChange(it.id, 'rate', e.target.value)}
                          required
                          style={{ fontSize: '13px', padding: '7px 10px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Line Total ({it.unit}):</span>
                      <strong style={{ color: 'var(--emerald)' }}>₹{it.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                );
              })}

              {/* Grand Total Summary */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '12px 14px', marginTop: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Total Taxable:</span>
                  <span>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {isGST && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <span>GST:</span>
                    <span>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--emerald)' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="Credit">Credit (On Account)</option>
                  <option value="Bank">Bank Transfer / UPI</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks</label>
                <input type="text" className="form-control" placeholder="Optional notes" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>

              <button type="submit" className="submit-btn" disabled={submitting} style={{ width: '100%', marginTop: '10px' }}>
                {submitting ? 'Saving Purchase...' : 'Save Purchase Invoice'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
