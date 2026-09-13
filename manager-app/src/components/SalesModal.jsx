import React, { useState, useEffect } from 'react';
import { X, Truck, AlertCircle, CheckCircle2, Receipt, Hash } from 'lucide-react';
import { api } from '../api';

export default function SalesModal({ isOpen, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      loadDropdowns();
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  async function loadDropdowns() {
    setLoading(true);
    try {
      const [custs, fgs] = await Promise.all([
        api.getCustomers(),
        api.getFinishedGoods()
      ]);
      setCustomers(custs || []);
      setFinishedGoods(fgs || []);

      if (custs && custs.length > 0 && !customerId) {
        setCustomerId(custs[0].id);
      }
      if (fgs && fgs.length > 0) {
        const firstFG = fgs[0];
        if (!finishedProductId) {
          setFinishedProductId(firstFG.id);
          if (firstFG.gst_percent !== undefined && firstFG.gst_percent !== null) {
            setGstPercent(String(firstFG.gst_percent));
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load sales masters.');
    } finally {
      setLoading(false);
    }
  }

  // When finished good selection changes, auto-populate default GST rate
  const handleFinishedGoodChange = (e) => {
    const selectedId = e.target.value;
    setFinishedProductId(selectedId);
    const fg = finishedGoods.find(f => String(f.id) === String(selectedId));
    if (fg && fg.gst_percent !== undefined && fg.gst_percent !== null) {
      setGstPercent(String(fg.gst_percent));
    }
  };

  const selectedFG = finishedGoods.find(f => String(f.id) === String(finishedProductId));
  const selectedCustomer = customers.find(c => String(c.id) === String(customerId));

  const numQty = parseFloat(quantityKg) || 0;
  const numRate = parseFloat(ratePerKg) || 0;
  const numGst = parseFloat(gstPercent) || 0;

  const taxableAmount = numQty * numRate;
  const gstAmount = taxableAmount * (numGst / 100);
  const grandTotal = taxableAmount + gstAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId || !finishedProductId || numQty <= 0 || numRate <= 0) {
      setError('Please enter valid Customer, Finished Product, Quantity (>0), and Rate (>0)');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.createSale({
        date,
        customerId: parseInt(customerId),
        finishedProductId: parseInt(finishedProductId),
        quantityKg: numQty,
        ratePerKg: numRate,
        gstPercent: numGst,
        invoiceNumber: invoiceNumber.trim() || undefined,
        paymentType,
        remarks
      });

      const invDisplay = res.invoice_number || res.sale_code || 'SALE-RECORDED';
      setSuccess(`Sale dispatched successfully! Invoice: ${invDisplay}`);
      setTimeout(() => {
        setQuantityKg('');
        setRatePerKg('');
        setInvoiceNumber('');
        setRemarks('');
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Error recording sale');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Truck size={20} color="#fbbf24" />
            <span>Sales Dispatch Entry</span>
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
              Loading sales masters...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Dispatch Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Customer *</label>
                  {selectedCustomer?.gst_number && (
                    <span className="info-chip">
                      GSTIN: {selectedCustomer.gst_number}
                    </span>
                  )}
                </div>
                <select
                  className="form-select"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.state ? `(${c.state})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Finished Product Specification *</label>
                  {selectedFG?.hsn_code && (
                    <span className="info-chip chip-amber">
                      HSN: {selectedFG.hsn_code}
                    </span>
                  )}
                </div>
                <select
                  className="form-select"
                  value={finishedProductId}
                  onChange={handleFinishedGoodChange}
                  required
                >
                  {finishedGoods.map((fg) => (
                    <option key={fg.id} value={fg.id}>
                      {fg.product_code}: {fg.product_name} {fg.gsm} GSM ({fg.width_size}, {fg.colour}) [HSN: {fg.hsn_code || '3926'}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantity (KG) *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input num-input"
                    placeholder="e.g. 1500"
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rate / KG (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input num-input"
                    placeholder="e.g. 145.00"
                    value={ratePerKg}
                    onChange={(e) => setRatePerKg(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">GST Rate (%) *</label>
                <select
                  className="form-select"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                  required
                >
                  <option value="0">0% (Nil / Exempt)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Standard)</option>
                  <option value="28">28% GST</option>
                </select>
              </div>

              {/* GST & Financial Breakdown Card */}
              <div className="tax-breakdown-card amber-glow">
                <div className="tax-breakdown-title" style={{ color: '#fbbf24' }}>
                  <Receipt size={14} color="#fbbf24" />
                  <span>GST & Invoice Summary</span>
                </div>
                <div className="tax-row">
                  <span className="tax-label">Taxable Amount:</span>
                  <span className="tax-val">₹ {taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="tax-row">
                  <span className="tax-label">GST ({numGst}%):</span>
                  <span className="tax-val">₹ {gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="tax-divider"></div>
                <div className="tax-row grand-total-row">
                  <span className="tax-label-total">Grand Total (Invoice):</span>
                  <span className="tax-val-total" style={{ color: '#fbbf24' }}>
                    ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. INV-2026-0045 (Leave blank to auto-generate)"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select
                  className="form-select"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit">Credit</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI / Online">UPI / Online</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dispatched for agricultural shade nets, vehicle no."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                <button
                  type="submit"
                  className="btn-submit btn-amber"
                  disabled={submitting || loading || numQty <= 0 || numRate <= 0}
                >
                  {submitting ? 'Recording Sale...' : 'Save Sales Entry'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
