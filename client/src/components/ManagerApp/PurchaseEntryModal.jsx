import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../api';

export default function PurchaseEntryModal({ isOpen, onClose, onSuccess, managerProfile, initialPurchase = null }) {
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Invoice Header States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseType, setPurchaseType] = useState('GST'); // 'GST' or 'NON_GST'
  const [paymentMode, setPaymentMode] = useState('Credit'); // 'Credit', 'Cash', 'Bank'
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-Item Lines
  // item: { id, rawMaterialId, quantity, unit, rate, discount, hsnCode, gstPercent }
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadMasters();
      setError('');
    }
  }, [isOpen, initialPurchase]);

  async function loadMasters() {
    setLoading(true);
    try {
      const [supps, rms] = await Promise.all([
        api.getSuppliers(),
        api.getRawMaterials()
      ]);
      const activeSupps = (supps || []).filter(s => s.status === 'active');
      const activeRMs = (rms || []).filter(r => r.status === 'active');
      setSuppliers(activeSupps);
      setRawMaterials(activeRMs);

      if (initialPurchase) {
        // Edit Mode
        setDate(initialPurchase.date || new Date().toISOString().split('T')[0]);
        setSupplierId(String(initialPurchase.supplier_id || ''));
        setPurchaseType(initialPurchase.purchase_type || 'GST');
        setPaymentMode(initialPurchase.payment_mode || 'Credit');
        setInvoiceNumber(initialPurchase.invoice_number || '');
        setDiscountAmount(String(initialPurchase.discount_amount || ''));
        setOtherCharges(String(initialPurchase.other_charges || ''));
        setRoundOff(String(initialPurchase.round_off || ''));
        setRemarks(initialPurchase.remarks || '');

        if (initialPurchase.items && initialPurchase.items.length > 0) {
          setItems(initialPurchase.items.map((it, idx) => ({
            id: it.id || idx + 1,
            rawMaterialId: String(it.raw_material_id),
            quantity: String(it.quantity || it.quantity_kg || ''),
            unit: it.unit || 'KG',
            rate: String(it.rate || it.rate_per_kg || ''),
            discount: String(it.discount || 0),
            hsnCode: it.hsn_code || '',
            gstPercent: String(it.gst_percent !== undefined ? it.gst_percent : 18)
          })));
        } else {
          setItems([{
            id: Date.now(),
            rawMaterialId: String(initialPurchase.raw_material_id || activeRMs[0]?.id || ''),
            quantity: String(initialPurchase.quantity_kg || ''),
            unit: 'KG',
            rate: String(initialPurchase.rate_per_kg || ''),
            discount: '0',
            hsnCode: '3901',
            gstPercent: String(initialPurchase.gst_percent || 18)
          }]);
        }
      } else {
        // New Mode
        setDate(new Date().toISOString().split('T')[0]);
        setSupplierId(activeSupps.length > 0 ? String(activeSupps[0].id) : '');
        setPurchaseType('GST');
        setPaymentMode('Credit');
        setInvoiceNumber('');
        setDiscountAmount('');
        setOtherCharges('');
        setRoundOff('');
        setRemarks('');

        if (activeRMs.length > 0) {
          const first = activeRMs[0];
          setItems([{
            id: Date.now(),
            rawMaterialId: String(first.id),
            quantity: '',
            unit: first.unit || 'KG',
            rate: '',
            discount: '0',
            hsnCode: first.hsn_code || '3901',
            gstPercent: String(first.gst_percent || 18)
          }]);
        } else {
          setItems([]);
        }
      }
    } catch (err) {
      setError('Failed to load form masters: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Add Item Line
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
        discount: '0',
        hsnCode: first ? (first.hsn_code || '3901') : '3901',
        gstPercent: purchaseType === 'GST' ? String(first?.gst_percent || 18) : '0'
      }
    ]);
  };

  // Remove Item Line
  const handleRemoveItem = (idToRemove) => {
    if (items.length <= 1) return;
    setItems(items.filter(it => it.id !== idToRemove));
  };

  // Line Field Change
  const handleItemChange = (id, field, value) => {
    setItems(items.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      if (field === 'rawMaterialId') {
        const rm = rawMaterials.find(r => String(r.id) === String(value));
        if (rm) {
          updated.unit = rm.unit || 'KG';
          updated.hsnCode = rm.hsn_code || '3901';
          if (purchaseType === 'GST') {
            updated.gstPercent = String(rm.gst_percent !== undefined ? rm.gst_percent : 18);
          } else {
            updated.gstPercent = '0';
          }
        }
      }
      return updated;
    }));
  };

  // Update GST rates when purchaseType switches
  const handlePurchaseTypeChange = (newType) => {
    setPurchaseType(newType);
    setItems(items.map(it => {
      if (newType === 'NON_GST') {
        return { ...it, gstPercent: '0' };
      } else {
        const rm = rawMaterials.find(r => String(r.id) === String(it.rawMaterialId));
        return { ...it, gstPercent: String(rm?.gst_percent || 18) };
      }
    }));
  };

  // Calculations
  const isGST = (purchaseType === 'GST');
  const selectedSupplier = suppliers.find(s => String(s.id) === String(supplierId));
  const isInterState = selectedSupplier && selectedSupplier.state && selectedSupplier.state.toLowerCase() !== 'gujarat';

  let totalTaxable = 0;
  let totalGst = 0;

  const calculatedLines = items.map(it => {
    const q = parseFloat(it.quantity) || 0;
    const r = parseFloat(it.rate) || 0;
    const disc = parseFloat(it.discount) || 0;
    const taxable = Math.max(0, (q * r) - disc);
    const gstPct = isGST ? (parseFloat(it.gstPercent) || 0) : 0;
    const gstAmt = taxable * (gstPct / 100);
    const lineTotal = taxable + gstAmt;

    totalTaxable += taxable;
    totalGst += gstAmt;

    return {
      ...it,
      taxable,
      gstAmt,
      lineTotal
    };
  });

  const billDiscount = parseFloat(discountAmount) || 0;
  const billOther = parseFloat(otherCharges) || 0;
  const billRound = parseFloat(roundOff) || 0;

  const grandTotal = Math.max(0, totalTaxable + totalGst + billOther - billDiscount + billRound);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supplierId) {
      setError('Please select a Supplier.');
      return;
    }
    if (items.length === 0) {
      setError('At least one purchase item is required.');
      return;
    }

    for (const it of items) {
      const q = parseFloat(it.quantity) || 0;
      const r = parseFloat(it.rate) || 0;
      if (!it.rawMaterialId || q <= 0 || r <= 0) {
        const rm = rawMaterials.find(rItem => String(rItem.id) === String(it.rawMaterialId));
        setError(`Please enter a valid Quantity (>0) and Rate (>0) for item "${rm ? rm.name : 'Selected Raw Material'}".`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        date,
        supplierId: parseInt(supplierId),
        purchaseType,
        paymentMode,
        invoiceNumber: invoiceNumber.trim(),
        discountAmount: billDiscount,
        otherCharges: billOther,
        roundOff: billRound,
        remarks,
        managerName: managerProfile?.name || 'Admin',
        managerId: managerProfile?.id || null,
        deviceId: managerProfile?.deviceId || localStorage.getItem('tripal_device_id') || '',
        items: items.map(it => ({
          rawMaterialId: parseInt(it.rawMaterialId),
          quantity: parseFloat(it.quantity),
          unit: it.unit || 'KG',
          rate: parseFloat(it.rate),
          discount: parseFloat(it.discount) || 0,
          hsnCode: it.hsnCode || '3901',
          gstPercent: isGST ? (parseFloat(it.gstPercent) || 0) : 0
        }))
      };

      if (initialPurchase && initialPurchase.id) {
        await api.updatePurchase(initialPurchase.id, payload);
      } else {
        await api.createPurchase(payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save purchase invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
      <div className="modal-content" style={{ maxWidth: '960px', width: '95%' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.15))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px' }}>
                {initialPurchase ? 'Edit Multi-Item Raw Material Purchase' : 'New Multi-Item Raw Material Purchase'}
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Entered By: <strong style={{ color: 'var(--cyan)' }}>{managerProfile?.name || 'Admin'}</strong>
                {initialPurchase?.purchase_code ? ` | Invoice: ${initialPurchase.purchase_code}` : ''}
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
                <RefreshCw size={20} className="animate-spin" /> Loading masters...
              </div>
            ) : (
              <>
                {/* INVOICE HEADER DETAILS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px', background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <label className="form-label">Purchase Date *</label>
                    <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>

                  <div>
                    <label className="form-label">Supplier *</label>
                    <select className="form-select" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                      <option value="">Select Supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.gst_number || 'URP'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Supplier Bill / Invoice #</label>
                    <input type="text" className="form-input" placeholder="e.g. INV-1001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                  </div>

                  <div>
                    <label className="form-label">Purchase Type *</label>
                    <select className="form-select" value={purchaseType} onChange={e => handlePurchaseTypeChange(e.target.value)}>
                      <option value="GST">GST Purchase (Taxable)</option>
                      <option value="NON_GST">Non-GST Purchase (0% Tax)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Payment Mode *</label>
                    <select className="form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                      <option value="Credit">Credit (On Account)</option>
                      <option value="Bank">Bank Transfer / UPI / Cheque</option>
                      <option value="Cash">Cash in Hand</option>
                    </select>
                  </div>
                </div>

                {/* PURCHASE ITEMS LINE BUILDER */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Raw Material Items</span>
                      <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '10px' }}>
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </span>
                    </h4>
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItem} style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)' }}>
                      <Plus size={13} /> Add Raw Material Line
                    </button>
                  </div>

                  <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table className="custom-table" style={{ fontSize: '12px', minWidth: '820px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                          <th style={{ width: '28%' }}>Raw Material Item *</th>
                          <th style={{ width: '13%' }}>Quantity *</th>
                          <th style={{ width: '10%' }}>Unit</th>
                          <th style={{ width: '14%' }}>Rate ₹ *</th>
                          {isGST && <th style={{ width: '10%' }}>GST %</th>}
                          <th style={{ width: '13%', textAlign: 'right' }}>Taxable ₹</th>
                          <th style={{ width: '14%', textAlign: 'right' }}>Line Total ₹</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedLines.map((it, idx) => {
                          const rm = rawMaterials.find(r => String(r.id) === String(it.rawMaterialId));
                          return (
                            <tr key={it.id}>
                              <td>
                                <select
                                  className="form-select"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  value={it.rawMaterialId}
                                  onChange={e => handleItemChange(it.id, 'rawMaterialId', e.target.value)}
                                  required
                                >
                                  <option value="">Select Item...</option>
                                  {rawMaterials.map(r => (
                                    <option key={r.id} value={r.id}>
                                      {r.name} [{r.unit}]
                                    </option>
                                  ))}
                                </select>
                                {rm?.hsn_code && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                    HSN: {rm.hsn_code} | Cat: {rm.category}
                                  </div>
                                )}
                              </td>

                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  placeholder="e.g. 100"
                                  step="any"
                                  min="0.01"
                                  value={it.quantity}
                                  onChange={e => handleItemChange(it.id, 'quantity', e.target.value)}
                                  required
                                />
                              </td>

                              <td>
                                <span className={`pill ${it.unit === 'PCS' ? 'pill-amber' : 'pill-cyan'}`} style={{ fontWeight: '700', fontSize: '11px' }}>
                                  {it.unit}
                                </span>
                              </td>

                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  placeholder="Rate/unit"
                                  step="0.01"
                                  min="0.01"
                                  value={it.rate}
                                  onChange={e => handleItemChange(it.id, 'rate', e.target.value)}
                                  required
                                />
                              </td>

                              {isGST && (
                                <td>
                                  <select
                                    className="form-select"
                                    style={{ padding: '6px 8px', fontSize: '11px' }}
                                    value={it.gstPercent}
                                    onChange={e => handleItemChange(it.id, 'gstPercent', e.target.value)}
                                  >
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18">18%</option>
                                    <option value="28">28%</option>
                                  </select>
                                </td>
                              )}

                              <td className="num-mono" style={{ textAlign: 'right', fontWeight: '600' }}>
                                ₹{it.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: 'var(--emerald)' }}>
                                ₹{it.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td>
                                {items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(it.id)}
                                    title="Delete line"
                                    style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', padding: '4px' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SUMMARY / TOTALS BAR */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Remarks / Note</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional notes, truck #, freight details..."
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>

                  <div style={{ fontSize: '12.5px', lineHeight: '1.8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>Total Taxable Amount:</span>
                      <strong style={{ color: 'var(--text-main)' }}>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>

                    {isGST && (
                      <>
                        {isInterState ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                            <span>IGST:</span>
                            <span className="num-mono">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                              <span>CGST ({(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):</span>
                              <span className="num-mono">₹{(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                              <span>SGST ({(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):</span>
                              <span className="num-mono">₹{(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', marginTop: '8px', paddingTop: '8px', fontSize: '15px', fontWeight: '800' }}>
                      <span style={{ color: 'var(--text-main)' }}>Grand Total:</span>
                      <span style={{ color: 'var(--emerald)' }}>
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
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
            <button type="submit" className="btn btn-primary" disabled={submitting || loading}>
              {submitting ? 'Saving Purchase...' : (initialPurchase ? 'Update Purchase' : 'Save Multi-Item Purchase')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
