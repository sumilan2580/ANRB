import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { api } from '../../api';

export default function SalesEntryModal({ isOpen, initialSale, onClose, onSuccess, managerProfile }) {
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [finishedProductId, setFinishedProductId] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [gstPercent, setGstPercent] = useState('18');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMasters();
      setError('');
      if (initialSale) {
        setDate(initialSale.date || new Date().toISOString().split('T')[0]);
        setCustomerId(String(initialSale.customer_id || ''));
        setFinishedProductId(String(initialSale.finished_product_id || initialSale.items?.[0]?.finished_product_id || ''));
        setQuantityKg(String(initialSale.quantity_kg || initialSale.items?.[0]?.quantity || ''));
        setRatePerKg(String(initialSale.rate_per_kg || initialSale.items?.[0]?.rate || ''));
        setGstPercent(String(initialSale.gst_percent || initialSale.items?.[0]?.gst_percent || '18'));
        setInvoiceNumber(initialSale.invoice_number || '');
        setPaymentType(initialSale.payment_type || 'Cash');
        setRemarks(initialSale.remarks || '');
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setQuantityKg('');
        setRatePerKg('');
        setInvoiceNumber('');
        setRemarks('');
      }
    }
  }, [isOpen, initialSale]);

  async function loadMasters() {
    setLoading(true);
    try {
      const [custs, fgs] = await Promise.all([
        api.getCustomers(),
        api.getFinishedGoods()
      ]);
      const activeCusts = custs.filter(c => c.status === 'active');
      const activeFGs = fgs.filter(f => f.status === 'active');
      setCustomers(activeCusts);
      setFinishedGoods(activeFGs);
      if (!initialSale) {
        setCustomerId(activeCusts.length > 0 ? String(activeCusts[0].id) : '');
        if (activeFGs.length > 0) {
          setFinishedProductId(String(activeFGs[0].id));
          setGstPercent(String(activeFGs[0].gst_percent || 18));
        } else {
          setFinishedProductId('');
          setGstPercent('18');
        }
      }
    } catch (err) {
      setError('Failed to load customers or finished goods: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleFGChange = (id) => {
    setFinishedProductId(id);
    const fg = finishedGoods.find(f => String(f.id) === String(id));
    if (fg) setGstPercent(String(fg.gst_percent || 18));
  };

  const selectedFG = finishedGoods.find(f => String(f.id) === String(finishedProductId));
  const currentFGStock = selectedFG ? (selectedFG.current_stock_kg || 0) : 0;
  const initialQty = initialSale ? Number(initialSale.quantity_kg || initialSale.items?.[0]?.quantity || 0) : 0;
  const availableStock = currentFGStock + initialQty;
  const numQty = parseFloat(quantityKg) || 0;
  const numRate = parseFloat(ratePerKg) || 0;
  const numGst = parseFloat(gstPercent) || 0;
  const taxableAmount = numQty * numRate;
  const gstAmount = (taxableAmount * numGst) / 100;
  const totalAmount = taxableAmount + gstAmount;
  const isInsufficientStock = numQty > 0 && numQty > availableStock;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerId || !finishedProductId || numQty <= 0 || numRate <= 0) {
      setError('Please select customer, finished product, quantity (>0), and rate (>0).');
      return;
    }

    if (isInsufficientStock) {
      setError(`Insufficient stock! Available: ${availableStock.toLocaleString()} KG, Required: ${numQty.toLocaleString()} KG.`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        date,
        customerId: parseInt(customerId),
        finishedProductId: parseInt(finishedProductId),
        quantityKg: numQty,
        ratePerKg: numRate,
        gstPercent: numGst,
        invoiceNumber: invoiceNumber.trim(),
        paymentType,
        remarks,
        managerName: managerProfile?.name || 'Admin',
        managerId: managerProfile?.id || null,
        deviceId: managerProfile?.deviceId || localStorage.getItem('tripal_device_id') || '',
        items: [{
          finishedProductId: parseInt(finishedProductId),
          quantity: numQty,
          rate: numRate,
          gstPercent: numGst
        }]
      };

      if (initialSale && initialSale.id) {
        await api.updateSale(initialSale.id, payload);
      } else {
        await api.createSale(payload);
      }

      // Reset form
      setQuantityKg('');
      setRatePerKg('');
      setInvoiceNumber('');
      setRemarks('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Error recording sales entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Truck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                {initialSale ? `Edit Sale Invoice (${initialSale.invoice_number || initialSale.sale_code})` : 'New Sale / Dispatch Entry'}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                {initialSale ? 'Modify sale details, quantities, rates and invoice number' : 'GST Tax Invoice & Goods Delivery Note'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {loading && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading masters...</div>
            )}

            {error && (
              <div style={{ padding: '10px 12px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {!loading && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Sale Date *</label>
                    <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer *</label>
                    <select className="form-select" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                      {customers.length === 0 && <option value="">No active customers</option>}
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Finished Good Specification *</label>
                  <select className="form-select" value={finishedProductId} onChange={e => handleFGChange(e.target.value)} required>
                    {finishedGoods.length === 0 && <option value="">No active finished goods</option>}
                    {finishedGoods.map(fg => (
                      <option key={fg.id} value={fg.id}>
                        {fg.product_code}: {fg.product_name} — {fg.gsm} GSM, {fg.width_size}, {fg.colour} ({fg.grade}) | Stock: {(fg.current_stock_kg || 0).toLocaleString()} KG
                      </option>
                    ))}
                  </select>
                  {selectedFG && (
                    <div style={{ marginTop: '4px', fontSize: '11.5px', color: isInsufficientStock ? 'var(--rose)' : 'var(--emerald)' }}>
                      Available Stock: <strong>{availableStock.toLocaleString()} KG</strong>
                      {isInsufficientStock && ` — Short by ${(numQty - availableStock).toLocaleString()} KG!`}
                    </div>
                  )}
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Quantity Sold (KG) *</label>
                    <input
                      type="number" step="any" className="form-input num-mono"
                      placeholder="e.g. 500" value={quantityKg}
                      onChange={e => setQuantityKg(e.target.value)} required
                      style={isInsufficientStock ? { borderColor: 'var(--rose)' } : {}}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate per KG (₹) *</label>
                    <input type="number" step="any" className="form-input num-mono" placeholder="e.g. 145.00" value={ratePerKg} onChange={e => setRatePerKg(e.target.value)} required />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">GST %</label>
                    <select className="form-select" value={gstPercent} onChange={e => setGstPercent(e.target.value)}>
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Invoice Number</label>
                    <input type="text" className="form-input" placeholder="Leave blank for auto-generate" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                  </div>
                </div>

                {/* GST Calculation Panel */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', margin: '4px 0 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Taxable Amount</span>
                    <span className="num-mono" style={{ fontWeight: '600' }}>₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {numGst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>GST @ {numGst}%</span>
                      <span className="num-mono" style={{ color: 'var(--amber)' }}>₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Invoice Total</span>
                    <span className="num-mono" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--emerald)' }}>
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="form-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remarks</label>
                    <input type="text" className="form-input" placeholder="Optional note" value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-emerald"
              disabled={submitting || loading || isInsufficientStock || numQty <= 0 || !finishedProductId || !customerId}
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Saving...' : initialSale ? 'Save Changes' : 'Save Sales Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
