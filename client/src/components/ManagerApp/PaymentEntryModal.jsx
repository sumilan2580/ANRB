import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShieldAlert, CheckCircle2, DollarSign } from 'lucide-react';
import { api } from '../../api';

export default function PaymentEntryModal({ isOpen, defaultType = 'CUSTOMER', managerName, onClose, onSuccess }) {
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
      loadParties(defaultType);
      setError('');
      setSuccess('');
      setAmount('');
      setReferenceNo('');
      setRemarks('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, defaultType]);

  async function loadParties(targetType = partyType) {
    setLoading(true);
    try {
      const [custs, supps] = await Promise.all([
        api.getCustomers(),
        api.getSuppliers()
      ]);
      setCustomers(custs || []);
      setSuppliers(supps || []);

      const list = targetType === 'CUSTOMER' ? (custs || []) : (supps || []);
      if (list.length > 0) {
        setPartyId(list[0].id);
      } else {
        setPartyId('');
      }
    } catch (err) {
      setError(err.message || 'Failed to load parties.');
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
      setError('Please enter a valid amount greater than ₹0.');
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
        remarks: remarks || '',
        managerName: managerName || 'Manager'
      };

      const res = await api.createPayment(payload);
      const isReceipt = partyType === 'CUSTOMER';
      setSuccess(`${isReceipt ? 'Receipt' : 'Payment'} ${res.payment_code || ''} recorded successfully! (₹${numAmount.toLocaleString('en-IN')})`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        onClose();
      }, 1200);
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header" style={{
          background: isReceipt
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'
            : 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(245, 158, 11, 0.2))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: isReceipt ? 'var(--emerald)' : 'var(--rose)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              {isReceipt ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                {isReceipt ? 'Customer Payment Receipt' : 'Supplier Payment Voucher'}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                {isReceipt ? 'Record payment collection from buyer' : 'Record raw material payment to vendor'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px 12px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div style={{ padding: '10px 12px', background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <div>{success}</div>
              </div>
            )}

            {/* Switch Type Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => handleTypeChange('CUSTOMER')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: partyType === 'CUSTOMER' ? '2px solid var(--emerald)' : '1px solid var(--border-color)',
                  background: partyType === 'CUSTOMER' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: partyType === 'CUSTOMER' ? 'var(--emerald)' : 'var(--text-dim)',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowDownLeft size={16} /> Customer Receipt
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('SUPPLIER')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: partyType === 'SUPPLIER' ? '2px solid var(--rose)' : '1px solid var(--border-color)',
                  background: partyType === 'SUPPLIER' ? 'rgba(244, 63, 94, 0.12)' : 'transparent',
                  color: partyType === 'SUPPLIER' ? 'var(--rose)' : 'var(--text-dim)',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowUpRight size={16} /> Supplier Payment
              </button>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Transaction Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
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

              <div className="form-group full-width">
                <label className="form-label">
                  {isReceipt ? 'Customer (Buyer) *' : 'Supplier (Vendor) *'}
                </label>
                <select
                  className="form-select"
                  value={partyId}
                  onChange={e => setPartyId(e.target.value)}
                  required
                  disabled={loading}
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
                  className="form-input num-mono"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  required
                  min="0.01"
                  step="any"
                  style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: isReceipt ? 'var(--emerald)' : 'var(--rose)'
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ref / UTR / Cheque No.</label>
                <input
                  type="text"
                  className="form-input num-mono"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="Optional reference"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Narration / Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Advance against bill / final settlement"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || loading}
              style={{
                background: isReceipt ? 'var(--emerald)' : 'var(--rose)',
                color: '#fff',
                fontWeight: '700'
              }}
            >
              {submitting ? 'Saving...' : (isReceipt ? 'Save Customer Receipt' : 'Save Supplier Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
