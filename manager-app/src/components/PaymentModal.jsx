import React, { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function PaymentModal({ isOpen, defaultType = 'CUSTOMER', onClose, onSuccess }) {
  const [partyType, setPartyType] = useState(defaultType); // 'CUSTOMER' or 'SUPPLIER'
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPartyType(defaultType);
      loadParties();
      setError('');
      setSuccess('');
      setAmount('');
      setReferenceNo('');
      setRemarks('');
    }
  }, [isOpen, defaultType]);

  async function loadParties() {
    setLoading(true);
    try {
      const [custs, supps] = await Promise.all([
        api.getCustomers(),
        api.getSuppliers()
      ]);
      setCustomers(custs || []);
      setSuppliers(supps || []);

      const list = partyType === 'CUSTOMER' ? custs : supps;
      if (list && list.length > 0) {
        setPartyId(list[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load customers and suppliers.');
    } finally {
      setLoading(false);
    }
  }

  const handleTypeChange = (type) => {
    setPartyType(type);
    const list = type === 'CUSTOMER' ? customers : suppliers;
    if (list && list.length > 0) {
      setPartyId(list[0].id);
    } else {
      setPartyId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const numAmount = Number(amount);
    if (!partyId) {
      setError(`Please select a ${partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'}.`);
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        partyType,
        partyId: Number(partyId),
        amount: numAmount,
        paymentMode,
        referenceNo: referenceNo || '',
        remarks: remarks || ''
      };

      const res = await api.createPayment(payload);
      const isReceipt = partyType === 'CUSTOMER';
      setSuccess(`${isReceipt ? 'Receipt' : 'Payment'} ${res.payment_code || ''} recorded successfully! (₹${numAmount.toLocaleString('en-IN')})`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to record payment entry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentList = partyType === 'CUSTOMER' ? customers : suppliers;
  const isReceipt = partyType === 'CUSTOMER';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: isReceipt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: isReceipt ? 'var(--emerald)' : 'var(--rose)',
              padding: '6px',
              borderRadius: '8px'
            }}>
              {isReceipt ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h2 className="modal-title">
                {isReceipt ? 'Customer Payment Receipt' : 'Supplier Payment'}
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {isReceipt ? 'Record payment collection from buyer' : 'Record raw material payment to vendor'}
              </div>
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

          {/* Toggle Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => handleTypeChange('CUSTOMER')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: partyType === 'CUSTOMER' ? '2px solid var(--emerald)' : '1px solid var(--border-color)',
                background: partyType === 'CUSTOMER' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                color: partyType === 'CUSTOMER' ? 'var(--emerald)' : 'var(--text-dim)',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <ArrowDownLeft size={15} /> Customer Receipt
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('SUPPLIER')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: partyType === 'SUPPLIER' ? '2px solid var(--rose)' : '1px solid var(--border-color)',
                background: partyType === 'SUPPLIER' ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                color: partyType === 'SUPPLIER' ? 'var(--rose)' : 'var(--text-dim)',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <ArrowUpRight size={15} /> Supplier Payment
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Transaction Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {isReceipt ? 'Select Customer' : 'Select Supplier'} *
            </label>
            <select
              className="form-select"
              value={partyId}
              onChange={e => setPartyId(e.target.value)}
              required
            >
              <option value="">Choose party…</option>
              {currentList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gst_number ? `(${p.gst_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              required
              min="0.01"
              step="any"
              style={{ fontSize: '16px', fontWeight: '700', color: isReceipt ? 'var(--emerald)' : 'var(--rose)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-select"
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash In Hand</option>
                <option value="Bank">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ref / UTR / Cheque #</label>
              <input
                type="text"
                className="form-input"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                placeholder="Optional ref"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Remarks</label>
            <input
              type="text"
              className="form-input"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Advance payment / settlement"
            />
          </div>

          <button
            type="submit"
            className="btn-primary-mobile"
            disabled={submitting || loading}
            style={{
              width: '100%',
              marginTop: '10px',
              background: isReceipt ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #e11d48, #f43f5e)'
            }}
          >
            {submitting ? 'Saving Transaction…' : (isReceipt ? 'Record Customer Receipt' : 'Record Supplier Payment')}
          </button>
        </form>
      </div>
    </div>
  );
}
