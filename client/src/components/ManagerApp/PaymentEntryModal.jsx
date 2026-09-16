import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShieldAlert, CheckCircle2, DollarSign, PlusCircle } from 'lucide-react';
import { api } from '../../api';

export default function PaymentEntryModal({ isOpen, defaultType = 'CUSTOMER', managerName, onClose, onSuccess }) {
  const [partyType, setPartyType] = useState(defaultType); // 'CUSTOMER', 'SUPPLIER', 'EXPENSE', 'INCOME'
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPartyType(defaultType);
      loadAllData(defaultType);
      setError('');
      setSuccess('');
      setAmount('');
      setReferenceNo('');
      setRemarks('');
      setBankAccountId('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, defaultType]);

  async function loadAllData(targetType = partyType) {
    setLoading(true);
    try {
      const [custs, supps, heads, banks] = await Promise.all([
        api.getCustomers(),
        api.getSuppliers(),
        api.getExpenseHeads ? api.getExpenseHeads() : Promise.resolve([]),
        api.getBankAccounts ? api.getBankAccounts() : Promise.resolve([])
      ]);
      setCustomers(custs || []);
      setSuppliers(supps || []);
      setExpenseHeads(heads || []);
      setBankAccounts(banks || []);

      updateSelectedPartyId(targetType, custs, supps, heads);
    } catch (err) {
      setError(err.message || 'Failed to load master records.');
    } finally {
      setLoading(false);
    }
  }

  function updateSelectedPartyId(type, custs = customers, supps = suppliers, heads = expenseHeads) {
    let list = [];
    if (type === 'CUSTOMER') list = custs || [];
    else if (type === 'SUPPLIER') list = supps || [];
    else if (type === 'EXPENSE') list = (heads || []).filter(h => (h.type || 'EXPENSE') === 'EXPENSE' && h.status !== 'INACTIVE');
    else if (type === 'INCOME') list = (heads || []).filter(h => h.type === 'INCOME' && h.status !== 'INACTIVE');

    if (list.length > 0) {
      setPartyId(list[0].id);
    } else {
      setPartyId('');
    }
  }

  const handleTypeChange = (type) => {
    setPartyType(type);
    updateSelectedPartyId(type);
  };

  const isReceipt = partyType === 'CUSTOMER' || partyType === 'INCOME';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const numAmount = Number(amount);
    if (!partyId) {
      const partyLabel = partyType === 'CUSTOMER'
        ? 'Customer'
        : partyType === 'SUPPLIER'
          ? 'Supplier'
          : partyType === 'EXPENSE'
            ? 'Expense Head'
            : 'Income Head';
      setError(`Please select a ${partyLabel}.`);
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
        bankAccountId: paymentMode === 'Cash' ? null : (bankAccountId ? Number(bankAccountId) : null),
        amount: numAmount,
        paymentMode,
        referenceNo: referenceNo || '',
        remarks: remarks || '',
        managerName: managerName || 'Manager'
      };

      const res = await api.createPayment(payload);
      const actionName = partyType === 'CUSTOMER'
        ? 'Customer Receipt'
        : partyType === 'INCOME'
          ? 'Side Income Receipt'
          : partyType === 'EXPENSE'
            ? 'Expense Payment'
            : 'Supplier Payment';

      setSuccess(`${actionName} ${res.payment_code || ''} recorded successfully! (₹${numAmount.toLocaleString('en-IN')})`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to record entry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  let currentList = [];
  let currentLabel = 'Party';
  if (partyType === 'CUSTOMER') {
    currentList = customers;
    currentLabel = 'Customer (Buyer)';
  } else if (partyType === 'SUPPLIER') {
    currentList = suppliers;
    currentLabel = 'Supplier (Vendor)';
  } else if (partyType === 'EXPENSE') {
    currentList = expenseHeads.filter(h => (h.type || 'EXPENSE') === 'EXPENSE' && h.status !== 'INACTIVE');
    currentLabel = 'Expense Head';
  } else if (partyType === 'INCOME') {
    currentList = expenseHeads.filter(h => h.type === 'INCOME' && h.status !== 'INACTIVE');
    currentLabel = 'Side Income Head';
  }

  const headerColor = isReceipt
    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'
    : 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(245, 158, 11, 0.2))';

  const iconColor = isReceipt ? 'var(--emerald)' : 'var(--rose)';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header" style={{ background: headerColor }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              {isReceipt ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                {partyType === 'CUSTOMER' && 'Customer Payment Receipt'}
                {partyType === 'SUPPLIER' && 'Supplier Payment Voucher'}
                {partyType === 'EXPENSE' && 'Daily Expense Payment'}
                {partyType === 'INCOME' && 'Side / Scrap Income Receipt'}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                {partyType === 'CUSTOMER' && 'Record payment collection from customer'}
                {partyType === 'SUPPLIER' && 'Record raw material payment to vendor'}
                {partyType === 'EXPENSE' && 'Record factory, labour, or office expense payment'}
                {partyType === 'INCOME' && 'Record scrap sale or miscellaneous cash/bank receipt'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px 12px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setError(''); loadAllData(); }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    background: 'var(--rose)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {success && (
              <div style={{ padding: '10px 12px', background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <div>{success}</div>
              </div>
            )}

            {/* Switch Type Tabs - 4 Types */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => handleTypeChange('CUSTOMER')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: partyType === 'CUSTOMER' ? '2px solid var(--emerald)' : '1px solid var(--border-color)',
                  background: partyType === 'CUSTOMER' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
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
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: partyType === 'SUPPLIER' ? '2px solid var(--rose)' : '1px solid var(--border-color)',
                  background: partyType === 'SUPPLIER' ? 'rgba(244, 63, 94, 0.12)' : 'transparent',
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

              <button
                type="button"
                onClick={() => handleTypeChange('EXPENSE')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: partyType === 'EXPENSE' ? '2px solid var(--rose)' : '1px solid var(--border-color)',
                  background: partyType === 'EXPENSE' ? 'rgba(244, 63, 94, 0.12)' : 'transparent',
                  color: partyType === 'EXPENSE' ? 'var(--rose)' : 'var(--text-dim)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowUpRight size={15} /> Expense Payment
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('INCOME')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: partyType === 'INCOME' ? '2px solid var(--emerald)' : '1px solid var(--border-color)',
                  background: partyType === 'INCOME' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: partyType === 'INCOME' ? 'var(--emerald)' : 'var(--text-dim)',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowDownLeft size={15} /> Side Income
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
                <label className="form-label">{currentLabel} *</label>
                <select
                  className="form-select"
                  value={partyId}
                  onChange={e => setPartyId(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="">Choose {currentLabel.toLowerCase()}…</option>
                  {currentList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ''} {p.category ? `— ${p.category}` : ''} {p.gst_number ? `[${p.gst_number}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {paymentMode !== 'Cash' && bankAccounts.length > 0 && (
                <div className="form-group full-width">
                  <label className="form-label">Bank Account (Optional)</label>
                  <select
                    className="form-select"
                    value={bankAccountId}
                    onChange={e => setBankAccountId(e.target.value)}
                  >
                    <option value="">Default Primary Bank Account…</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name || b.account_name} — A/C: {b.account_number || b.bank_account_no} {b.is_primary ? '★ Primary' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
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
                <label className="form-label">Ref / UTR / Cheque / Slip #</label>
                <input
                  type="text"
                  className="form-input num-mono"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="e.g. UTR / Receipt slip"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Narration / Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder={
                    partyType === 'EXPENSE'
                      ? 'e.g. Factory diesel, machine maintenance, tea/snacks...'
                      : partyType === 'INCOME'
                        ? 'e.g. Scrap sale to local buyer, empty drums...'
                        : 'e.g. Advance against bill / final settlement'
                  }
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
              {submitting
                ? 'Saving...'
                : partyType === 'CUSTOMER'
                  ? 'Save Customer Receipt'
                  : partyType === 'INCOME'
                    ? 'Save Side Income'
                    : partyType === 'EXPENSE'
                      ? 'Save Expense Payment'
                      : 'Save Supplier Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
