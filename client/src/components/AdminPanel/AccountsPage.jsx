import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, CreditCard, FileText, Download, RefreshCw, Plus, Trash2, Edit2,
  AlertTriangle, ChevronRight, Printer, Filter, Users, UserCheck, X,
  TrendingUp, TrendingDown, DollarSign, FileCheck, Archive
} from 'lucide-react';
import { api } from '../../api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const lines = rows.map(row =>
    Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csv = [headers, ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function fmtINR(num) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return '₹' + Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Action Button ─────────────────────────────────────────────────────────────
function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        background: 'none', border: `1px solid ${color}44`, borderRadius: '6px',
        color, width: '28px', height: '28px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = `${color}44`; }}
    >
      {icon}
    </button>
  );
}

// ── Confirm Delete ─────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ isOpen, itemLabel, onClose, onConfirm, loading }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '380px' }}>
        <div className="modal-header">
          <h3 style={{ color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} /> Confirm Delete
          </h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Delete payment entry <strong style={{ color: 'var(--text-main)' }}>{itemLabel}</strong>?
            <br /><span style={{ fontSize: '12px', color: 'var(--amber)' }}>This will affect the party ledger balance.</span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn" style={{ background: 'var(--rose)', color: '#fff' }} onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Payment Modal ─────────────────────────────────────────────────────────
function AddPaymentModal({ isOpen, initialPayment, customers, suppliers, expenseHeads: propExpenseHeads, bankAccounts: propBankAccounts, defaultPartyType, defaultPartyId, onClose, onSuccess }) {
  const [internalExpenseHeads, setInternalExpenseHeads] = useState([]);
  const [internalBankAccounts, setInternalBankAccounts] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    partyType: defaultPartyType || 'CUSTOMER',
    partyId: defaultPartyId || '',
    bankAccountId: '',
    amount: '',
    paymentMode: 'Bank',
    referenceNo: '',
    remarks: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (!propExpenseHeads || propExpenseHeads.length === 0) {
        api.getExpenseHeads().then(setInternalExpenseHeads).catch(() => {});
      }
      if (!propBankAccounts || propBankAccounts.length === 0) {
        api.getBankAccounts().then(setInternalBankAccounts).catch(() => {});
      }
    }
  }, [isOpen, propExpenseHeads, propBankAccounts]);

  const expenseHeads = (propExpenseHeads && propExpenseHeads.length > 0) ? propExpenseHeads : internalExpenseHeads;
  const bankAccounts = (propBankAccounts && propBankAccounts.length > 0) ? propBankAccounts : internalBankAccounts;

  useEffect(() => {
    if (isOpen) {
      if (initialPayment) {
        setForm({
          date: initialPayment.date || new Date().toISOString().split('T')[0],
          partyType: initialPayment.party_type || defaultPartyType || 'CUSTOMER',
          partyId: initialPayment.party_id || defaultPartyId || '',
          bankAccountId: initialPayment.bank_account_id || '',
          amount: initialPayment.amount || '',
          paymentMode: initialPayment.payment_mode || 'Bank',
          referenceNo: initialPayment.reference_no || '',
          remarks: initialPayment.remarks || '',
        });
      } else {
        setForm({
          date: new Date().toISOString().split('T')[0],
          partyType: defaultPartyType || 'CUSTOMER',
          partyId: defaultPartyId || '',
          bankAccountId: '',
          amount: '',
          paymentMode: 'Bank',
          referenceNo: '',
          remarks: '',
        });
      }
      setError('');
    }
  }, [isOpen, initialPayment, defaultPartyType, defaultPartyId]);

  if (!isOpen) return null;

  let partyList = [];
  let partyLabel = 'Party';
  if (form.partyType === 'CUSTOMER') {
    partyList = customers || [];
    partyLabel = 'Customer';
  } else if (form.partyType === 'SUPPLIER') {
    partyList = suppliers || [];
    partyLabel = 'Supplier';
  } else if (form.partyType === 'EXPENSE') {
    partyList = expenseHeads.filter(h => (h.type || 'EXPENSE') === 'EXPENSE' && h.status !== 'INACTIVE');
    partyLabel = 'Expense Head';
  } else if (form.partyType === 'INCOME') {
    partyList = expenseHeads.filter(h => h.type === 'INCOME' && h.status !== 'INACTIVE');
    partyLabel = 'Income Head';
  }

  const isReceipt = form.partyType === 'CUSTOMER' || form.partyType === 'INCOME';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.partyId || !form.amount || Number(form.amount) <= 0) {
      return setError('Party / Head and a valid amount are required.');
    }
    try {
      setLoading(true); setError('');
      const payload = {
        date: form.date,
        partyType: form.partyType,
        partyId: Number(form.partyId),
        bankAccountId: form.paymentMode === 'Cash' ? null : (form.bankAccountId ? Number(form.bankAccountId) : null),
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        referenceNo: form.referenceNo,
        remarks: form.remarks,
      };
      if (initialPayment && initialPayment.id) {
        await api.updatePayment(initialPayment.id, payload);
      } else {
        await api.createPayment(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>
            {initialPayment
              ? `Edit ${isReceipt ? 'Receipt' : 'Payment'} (${initialPayment.payment_code})`
              : form.partyType === 'CUSTOMER'
                ? '+ Record Customer Receipt'
                : form.partyType === 'INCOME'
                  ? '+ Record Side Income Receipt'
                  : form.partyType === 'EXPENSE'
                    ? '+ Record Expense Payment'
                    : '+ Record Supplier Payment'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>
                {error}
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Transaction Type *</label>
                <select className="form-select" value={form.partyType} onChange={e => setForm({ ...form, partyType: e.target.value, partyId: '' })}>
                  <option value="CUSTOMER">Customer (Receipt)</option>
                  <option value="SUPPLIER">Supplier (Payment)</option>
                  <option value="EXPENSE">Expense (Daily / Factory Payment)</option>
                  <option value="INCOME">Side Income (Scrap / Other Receipt)</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">{partyLabel} *</label>
                <select className="form-select" value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })} required>
                  <option value="">Select {partyLabel.toLowerCase()}…</option>
                  {partyList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ''} {p.category ? `— ${p.category}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 5000" required min="0.01" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <select className="form-select" value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Cash">Cash in Hand</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                </select>
              </div>
              {form.paymentMode !== 'Cash' && (
                <div className="form-group full-width">
                  <label className="form-label">Bank Account (Optional)</label>
                  <select className="form-select" value={form.bankAccountId} onChange={e => setForm({ ...form, bankAccountId: e.target.value })}>
                    <option value="">Select Bank Account (Default Primary)…</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name || b.account_name} — A/C: {b.account_number || b.bank_account_no} {b.is_primary ? '★ Primary' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Reference / UTR / Cheque #</label>
                <input type="text" className="form-input" value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} placeholder="UTR / Voucher / Cheque No." />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Remarks / Description</label>
                <input type="text" className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="e.g. Factory tea, diesel, scrap sale slip..." />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isReceipt ? 'Record Receipt' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── GST Invoice Print Modal ───────────────────────────────────────────────────
function InvoiceModal({ saleId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef();

  useEffect(() => {
    if (!saleId) return;
    setLoading(true);
    api.getInvoice(saleId)
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [saleId]);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: 'Arial', sans-serif; }
        body { background: #fff; color: #000; font-size:13px; }
        .inv-wrap { max-width:800px; margin:0 auto; padding:20px; border:2px solid #000; }
        .inv-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:14px; margin-bottom:14px; }
        .company-name { font-size:22px; font-weight:800; color:#1a237e; }
        .company-sub { font-size:11px; color:#555; }
        .inv-title { font-size:20px; font-weight:700; text-align:right; color:#1a237e; }
        .inv-meta { font-size:12px; text-align:right; }
        .parties { display:flex; gap:20px; margin-bottom:14px; }
        .party-box { flex:1; border:1px solid #ccc; padding:10px; border-radius:4px; }
        .party-label { font-size:10px; font-weight:700; text-transform:uppercase; color:#666; margin-bottom:4px; }
        .party-name { font-size:15px; font-weight:700; }
        .party-info { font-size:11px; color:#444; }
        table.inv-table { width:100%; border-collapse:collapse; margin-bottom:10px; }
        .inv-table th { background:#1a237e; color:#fff; padding:8px 10px; text-align:left; font-size:12px; }
        .inv-table td { padding:8px 10px; border-bottom:1px solid #eee; font-size:12px; }
        .inv-table .num { text-align:right; }
        .totals { display:flex; justify-content:flex-end; margin-bottom:10px; }
        .totals table { border-collapse:collapse; min-width:280px; }
        .totals td { padding:4px 12px; font-size:12px; }
        .totals tr.grand td { border-top:2px solid #000; font-weight:800; font-size:14px; }
        .words-box { background:#f5f5f5; padding:8px 12px; border-radius:4px; font-size:11px; font-style:italic; margin-bottom:12px; }
        .footer { border-top:1px solid #ccc; padding-top:8px; display:flex; justify-content:space-between; font-size:11px; color:#555; }
        .sig-line { border-top:1px solid #000; width:160px; text-align:center; padding-top:4px; font-size:11px; margin-top:30px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <div class="inv-wrap">${content}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleDownloadEInvoice = async () => {
    try {
      const json = await api.getEInvoiceJson(saleId);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `e-invoice-${data?.invoice?.invoiceNumber || saleId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading E-Invoice JSON: ' + err.message);
    }
  };

  const handleDownloadEWayBill = async () => {
    try {
      const json = await api.getEWayBillJson(saleId);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `e-waybill-${data?.invoice?.invoiceNumber || saleId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading E-Way Bill JSON: ' + err.message);
    }
  };

  if (!saleId) return null;

  const invoiceItems = data?.items && data.items.length > 0 ? data.items : (data?.item ? [{
    product_name: data.item.description || 'Plastic Tarpaulin / Tripal',
    hsn_code: data.item.hsnCode || '3926',
    quantity: data.item.quantityKg,
    rate: data.item.ratePerKg,
    taxable_amount: data.item.taxableAmount,
    unit: 'KG'
  }] : []);

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '24px', overflowY: 'auto' }}>
      <div className="modal-content" style={{ maxWidth: '840px', width: '100%' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} /> GST Tax Invoice</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={handleDownloadEInvoice} disabled={loading || !!error} title="Download official NIC E-Invoice JSON v1.1">
              <FileText size={13} /> E-Invoice JSON
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleDownloadEWayBill} disabled={loading || !!error} title="Download official NIC E-Way Bill JSON">
              <Download size={13} /> E-Way Bill JSON
            </button>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={loading || !!error}>
              <Printer size={13} /> Print / PDF
            </button>
            <button className="modal-close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}><RefreshCw size={20} className="animate-spin" /></div>
          ) : error ? (
            <div style={{ color: 'var(--rose)', padding: '20px' }}>{error}</div>
          ) : data ? (
            <div ref={printRef}>
              {/* Header */}
              <div className="inv-header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1a237e', paddingBottom: '14px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#1a237e' }}>{data.company?.company_name || 'TRIPAL MANUFACTURING'}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    {data.company?.company_address || ''}<br />
                    GSTIN: <strong>{data.company?.company_gstin || 'N/A'}</strong> | State: {data.company?.company_state || 'Gujarat'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a237e' }}>TAX INVOICE</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    <strong>Invoice #:</strong> {data.invoice?.invoiceNumber}<br />
                    <strong>Date:</strong> {data.invoice?.date}<br />
                    <strong>Sales Type:</strong> {data.invoice?.salesType || 'GST'} | <strong>Mode:</strong> {data.invoice?.paymentType}
                  </div>
                </div>
              </div>

              {/* Party details */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#666', marginBottom: '4px' }}>Bill To</div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{data.customer?.name}</div>
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>
                    {data.customer?.billingAddress && <div>{data.customer.billingAddress}</div>}
                    {data.customer?.phone && <div>Ph: {data.customer.phone}</div>}
                    <div>GSTIN: {data.customer?.gstin || 'Unregistered'}</div>
                    <div>State: {data.customer?.state || 'Gujarat'}</div>
                  </div>
                </div>
                <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#666', marginBottom: '4px' }}>Ship To / Consignee</div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{data.customer?.name}</div>
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>
                    <div>{data.customer?.shippingAddress || data.customer?.billingAddress || 'Same as billing'}</div>
                    <div>GSTIN: {data.customer?.gstin || 'Unregistered'}</div>
                    <div>Billed By: {data.invoice?.managerName}</div>
                  </div>
                </div>
              </div>

              {/* Item table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#1a237e', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>HSN</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '8px 10px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '600' }}>
                        {it.product_name} {it.gsm ? `(${it.gsm} GSM${it.size ? `, ${it.size}` : ''})` : ''}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.hsn_code || '3926'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                        {Number(it.quantity || 0).toLocaleString()} {it.unit || 'KG'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{Number(it.rate || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                        ₹{Number(it.taxable_amount || (it.quantity * it.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '300px', fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 12px', color: '#555' }}>Taxable Amount</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: '600' }}>
                        ₹{(data.invoice?.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {data.invoice?.cgstAmount > 0 && (
                      <>
                        <tr>
                          <td style={{ padding: '4px 12px', color: '#555' }}>CGST</td>
                          <td style={{ padding: '4px 12px', textAlign: 'right' }}>₹{data.invoice.cgstAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 12px', color: '#555' }}>SGST</td>
                          <td style={{ padding: '4px 12px', textAlign: 'right' }}>₹{data.invoice.sgstAmount.toFixed(2)}</td>
                        </tr>
                      </>
                    )}
                    {data.invoice?.igstAmount > 0 && (
                      <tr>
                        <td style={{ padding: '4px 12px', color: '#555' }}>IGST</td>
                        <td style={{ padding: '4px 12px', textAlign: 'right' }}>₹{data.invoice.igstAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    {data.invoice?.discountAmount > 0 && (
                      <tr>
                        <td style={{ padding: '4px 12px', color: 'var(--emerald)' }}>Discount</td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', color: 'var(--emerald)' }}>-₹{data.invoice.discountAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    {data.invoice?.roundOff !== 0 && (
                      <tr>
                        <td style={{ padding: '4px 12px', color: '#555' }}>Round Off</td>
                        <td style={{ padding: '4px 12px', textAlign: 'right' }}>₹{data.invoice.roundOff.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: '2px solid #000', fontWeight: '800', fontSize: '15px' }}>
                      <td style={{ padding: '6px 12px' }}>Invoice Total</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: '#1a237e' }}>
                        ₹{(data.invoice?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in words */}
              <div style={{ background: '#f5f5f5', padding: '8px 14px', borderRadius: '4px', fontSize: '11px', fontStyle: 'italic', marginBottom: '16px', color: '#333' }}>
                Amount in Words: <strong>{data.amountInWords}</strong>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>Bank Details:</div>
                  <div>Bank: {data.company?.bank_name || 'State Bank of India'} | A/C: {data.company?.bank_account_no || '382910482910'}</div>
                  <div>IFSC: {data.company?.bank_ifsc || 'SBIN0001234'} | Branch: {data.company?.bank_branch || 'Vatva Branch'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #000', width: '160px', paddingTop: '4px', fontSize: '11px' }}>
                    Authorised Signatory<br />for {data.company?.company_name || 'TRIPAL MANUFACTURING'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── LEDGER SUB-COMPONENT ──────────────────────────────────────────────────────
function LedgerView({ type, parties, customers, suppliers, onAddPayment }) {
  const [partyId, setPartyId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceSaleId, setInvoiceSaleId] = useState(null);

  // Auto-select first party when list loads or type switches
  useEffect(() => {
    setLedger(null);
    setError('');
    if (parties && parties.length > 0) {
      setPartyId(String(parties[0].id));
    } else {
      setPartyId('');
    }
  }, [type, parties]);

  const load = async () => {
    if (!partyId) return setError('Please select a party first.');
    setLoading(true); setError('');
    try {
      const data = type === 'CUSTOMER'
        ? await api.getCustomerLedger(partyId, dateFrom, dateTo)
        : await api.getSupplierLedger(partyId, dateFrom, dateTo);
      setLedger(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLedger = () => {
    if (!ledger) return;
    const win = window.open('', '_blank');
    const party = ledger.customer || ledger.supplier;
    const rows = ledger.transactions.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.doc_no || '—'}</td>
        <td><span style="background:${t.type === 'INVOICE' || t.type === 'BILL' ? '#e8f5e9' : '#e3f2fd'};padding:2px 6px;border-radius:4px;font-size:11px;">${t.type}</span></td>
        <td>${t.description}</td>
        <td style="text-align:right;color:${t.debit > 0 ? '#c62828' : '#666'}">${t.debit > 0 ? '₹' + t.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
        <td style="text-align:right;color:${t.credit > 0 ? '#2e7d32' : '#666'}">${t.credit > 0 ? '₹' + t.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
        <td style="text-align:right;font-weight:700;color:${t.balance >= 0 ? '#c62828' : '#2e7d32'}">₹${Math.abs(t.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${t.balance > 0 ? (type === 'CUSTOMER' ? 'Dr' : 'Cr') : t.balance < 0 ? (type === 'CUSTOMER' ? 'Cr' : 'Dr') : ''}</td>
      </tr>
    `).join('');

    win.document.write(`<html><head><title>Account Statement</title>
      <style>* { box-sizing:border-box; } body { font-family:Arial; margin:20px; font-size:12px; }
      h2 { color:#1a237e; } table { width:100%; border-collapse:collapse; }
      th { background:#1a237e; color:#fff; padding:8px; } td { padding:7px; border-bottom:1px solid #ddd; }
      .summary { display:flex; gap:20px; margin:12px 0; }
      .sum-box { flex:1; border:1px solid #ccc; padding:10px; border-radius:4px; }
      @media print { * { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <h2>Account Statement — ${party.name}</h2>
      <p>${party.address || ''} | ${type} | GSTIN: ${party.gst_number || '—'}</p>
      ${(dateFrom || dateTo) ? `<p>Period: ${dateFrom || 'Beginning'} to ${dateTo || 'Today'}</p>` : ''}
      <div class="summary">
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Opening Balance</div><div style="font-size:16px;font-weight:700">₹${ledger.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Total Debit</div><div style="font-size:16px;font-weight:700;color:#c62828">₹${ledger.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Total Credit</div><div style="font-size:16px;font-weight:700;color:#2e7d32">₹${ledger.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Closing Balance</div><div style="font-size:16px;font-weight:700;color:${ledger.closingBalance >= 0 ? '#c62828' : '#2e7d32'}">₹${Math.abs(ledger.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${ledger.closingBalance > 0 ? (type === 'CUSTOMER' ? '(Receivable)' : '(Payable)') : ledger.closingBalance < 0 ? (type === 'CUSTOMER' ? '(Advance/Overpaid)' : '(Advance Paid)') : '(Clear)'}</div></div>
      </div>
      <table><thead><tr><th>Date</th><th>Doc #</th><th>Type</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '18px', background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>{type === 'CUSTOMER' ? 'Customer' : 'Supplier'} *</label>
          <select className="form-select" value={partyId} onChange={e => { setPartyId(e.target.value); setLedger(null); }}>
            <option value="">Select {type === 'CUSTOMER' ? 'Customer' : 'Supplier'}…</option>
            {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>From</label>
          <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>To</label>
          <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={!partyId || loading}>
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <BookOpen size={14} />} View Statement
        </button>
        {ledger && (
          <>
            <button className="btn btn-outline" onClick={handlePrintLedger}><Printer size={14} /> Print</button>
            <button className="btn btn-outline" style={{ borderColor: 'var(--emerald)', color: 'var(--emerald)' }}
              onClick={() => onAddPayment(type, partyId)}>
              <Plus size={14} /> {type === 'CUSTOMER' ? 'Record Receipt' : 'Record Payment'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {ledger && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Opening Balance', value: fmtINR(ledger.openingBalance), color: 'var(--amber)' },
              { label: type === 'CUSTOMER' ? 'Total Invoiced (Dr)' : 'Total Bills (Cr)', value: fmtINR(ledger.totalDebit + ledger.totalCredit - (type === 'CUSTOMER' ? ledger.totalCredit : ledger.totalDebit)), color: 'var(--rose)' },
              { label: type === 'CUSTOMER' ? 'Receipts (Cr)' : 'Payments (Dr)', value: fmtINR(type === 'CUSTOMER' ? ledger.totalCredit : ledger.totalDebit), color: 'var(--emerald)' },
              { label: type === 'CUSTOMER' ? 'Outstanding (Receivable)' : 'Outstanding (Payable)', value: fmtINR(Math.abs(ledger.closingBalance)), color: ledger.closingBalance > 0 ? 'var(--rose)' : 'var(--emerald)' },
            ].map((c, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Ledger Table */}
          <div className="table-container">
            {ledger.openingBalance !== 0 && (
              <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--amber)', fontWeight: '600' }}>
                Opening Balance: {fmtINR(Math.abs(ledger.openingBalance))} {ledger.openingBalance > 0 ? (type === 'CUSTOMER' ? '(Dr)' : '(Cr)') : (type === 'CUSTOMER' ? '(Cr)' : '(Dr)')}
              </div>
            )}
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Doc #</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Debit ₹</th>
                  <th style={{ textAlign: 'right' }}>Credit ₹</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  {type === 'CUSTOMER' && <th>Invoice</th>}
                </tr>
              </thead>
              <tbody>
                {ledger.transactions.length === 0 ? (
                  <tr><td colSpan={type === 'CUSTOMER' ? 8 : 7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No transactions in this period</td></tr>
                ) : ledger.transactions.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '12px' }}>{t.date}</td>
                    <td><span className="num-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.doc_no || '—'}</span></td>
                    <td>
                      <span className={`pill ${t.type === 'INVOICE' ? 'pill-rose' : t.type === 'BILL' ? 'pill-amber' : t.type === 'RECEIPT' ? 'pill-emerald' : 'pill-cyan'}`} style={{ fontSize: '10px' }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.description}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: t.debit > 0 ? 'var(--rose)' : 'var(--text-dim)', fontWeight: t.debit > 0 ? '600' : '400' }}>
                      {t.debit > 0 ? fmtINR(t.debit) : '—'}
                    </td>
                    <td className="num-mono" style={{ textAlign: 'right', color: t.credit > 0 ? 'var(--emerald)' : 'var(--text-dim)', fontWeight: t.credit > 0 ? '600' : '400' }}>
                      {t.credit > 0 ? fmtINR(t.credit) : '—'}
                    </td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: t.balance > 0 ? 'var(--rose)' : t.balance < 0 ? 'var(--emerald)' : 'var(--text-dim)' }}>
                      {fmtINR(Math.abs(t.balance))} {t.balance > 0 ? (type === 'CUSTOMER' ? 'Dr' : 'Cr') : t.balance < 0 ? (type === 'CUSTOMER' ? 'Cr' : 'Dr') : ''}
                    </td>
                    {type === 'CUSTOMER' && (
                      <td>
                        {t.type === 'INVOICE' && (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '10px', padding: '2px 8px' }}
                            onClick={() => {
                              const id = t.id.replace('sale-', '');
                              setInvoiceSaleId(id);
                            }}
                          >
                            <FileText size={10} /> GST
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Closing row */}
            {ledger.transactions.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '24px', fontWeight: '700', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>Closing Balance:</span>
                <span style={{ color: ledger.closingBalance > 0 ? 'var(--rose)' : 'var(--emerald)', fontSize: '15px' }}>
                  {fmtINR(Math.abs(ledger.closingBalance))} {ledger.closingBalance > 0 ? (type === 'CUSTOMER' ? 'Dr (Receivable)' : 'Cr (Payable)') : ledger.closingBalance < 0 ? (type === 'CUSTOMER' ? 'Cr (Advance)' : 'Dr (Advance)') : 'Clear'}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {invoiceSaleId && (
        <InvoiceModal saleId={invoiceSaleId} onClose={() => setInvoiceSaleId(null)} />
      )}
    </div>
  );
}

// ── PAYMENTS REGISTER ─────────────────────────────────────────────────────────
function PaymentsRegister({ customers, suppliers, onAddPayment, onEditPayment, refreshKey }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ partyType: '', mode: '', dateFrom: '', dateTo: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filter.partyType) p.append('partyType', filter.partyType);
      if (filter.mode) p.append('paymentMode', filter.mode);
      if (filter.dateFrom) p.append('dateFrom', filter.dateFrom);
      if (filter.dateTo) p.append('dateTo', filter.dateTo);
      setPayments(await api.getPayments(p.toString()));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deletePayment(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess('Payment deleted.');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
        <select className="form-select" style={{ width: '170px', padding: '7px 10px' }} value={filter.partyType} onChange={e => setFilter({ ...filter, partyType: e.target.value })}>
          <option value="">All Types</option>
          <option value="CUSTOMER">Customer Receipts</option>
          <option value="SUPPLIER">Supplier Payments</option>
          <option value="EXPENSE">Expense Payments</option>
          <option value="INCOME">Side Incomes</option>
        </select>
        <select className="form-select" style={{ width: '140px', padding: '7px 10px' }} value={filter.mode} onChange={e => setFilter({ ...filter, mode: e.target.value })}>
          <option value="">All Modes</option>
          <option value="Cash">Cash</option>
          <option value="Bank">Bank</option>
          <option value="Cheque">Cheque</option>
          <option value="UPI">UPI</option>
          <option value="NEFT">NEFT</option>
          <option value="RTGS">RTGS</option>
        </select>
        <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={filter.dateFrom} onChange={e => setFilter({ ...filter, dateFrom: e.target.value })} />
        <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={filter.dateTo} onChange={e => setFilter({ ...filter, dateTo: e.target.value })} />
        <button className="btn btn-primary" onClick={load}><Filter size={14} /> Apply</button>
        <button className="btn btn-outline" onClick={() => { setFilter({ partyType: '', mode: '', dateFrom: '', dateTo: '' }); }}>Clear</button>
        <button className="btn btn-outline" style={{ marginLeft: 'auto', borderColor: 'var(--emerald)', color: 'var(--emerald)' }} onClick={() => onAddPayment()}>
          <Plus size={14} /> Record Payment/Receipt
        </button>
        <button className="btn btn-outline" onClick={() => exportCSV(payments, 'payments-register.csv')}>
          <Download size={14} /> Export
        </button>
      </div>

      {success && <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>✓ {success}</div>}
      {error && <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{error}<button onClick={() => setError('')} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}>✕</button></div>}

      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><RefreshCw size={20} className="animate-spin" /></div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Date</th>
                <th>Type</th>
                <th>Party / Head</th>
                <th>Mode</th>
                <th>Reference #</th>
                <th style={{ textAlign: 'right' }}>Amount ₹</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No payment entries found</td></tr>
              ) : payments.map(p => {
                const isIncome = p.party_type === 'CUSTOMER' || p.party_type === 'INCOME';
                const typeBadge = p.party_type === 'CUSTOMER'
                  ? 'pill-emerald'
                  : p.party_type === 'INCOME'
                    ? 'pill-emerald'
                    : p.party_type === 'EXPENSE'
                      ? 'pill-rose'
                      : 'pill-amber';
                const typeLabel = p.party_type === 'CUSTOMER'
                  ? 'Customer Receipt'
                  : p.party_type === 'INCOME'
                    ? 'Side Income'
                    : p.party_type === 'EXPENSE'
                      ? 'Expense'
                      : 'Supplier Pmt';

                return (
                  <tr key={p.id}>
                    <td><span className={`pill ${typeBadge} num-mono`} style={{ fontSize: '10px' }}>{p.payment_code}</span></td>
                    <td>{p.date}</td>
                    <td><span className={`pill ${typeBadge}`} style={{ fontSize: '10px' }}>{typeLabel}</span></td>
                    <td style={{ fontWeight: '600' }}>{p.party_name}</td>
                    <td><span className="pill pill-cyan" style={{ fontSize: '10px' }}>{p.payment_mode || 'Bank'}</span></td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.reference_no || '—'}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: isIncome ? 'var(--emerald)' : 'var(--rose)' }}>
                      {fmtINR(p.amount)}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.remarks || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <ActionBtn icon={<Edit2 size={12} />} color="var(--blue)" title="Edit" onClick={() => onEditPayment && onEditPayment(p)} />
                        <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => setDeleteTarget({ id: p.id, label: p.payment_code })} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {payments.length > 0 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '13px', fontWeight: '700' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>{payments.length} entries</span>
            <span>Total: <span style={{ color: 'var(--emerald)' }}>{fmtINR(total)}</span></span>
          </div>
        )}
      </div>

      <ConfirmDeleteModal isOpen={!!deleteTarget} itemLabel={deleteTarget?.label} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading} />
    </div>
  );
}

// ── EXPENSE & INCOME LEDGER SUB-COMPONENT ────────────────────────────────────
function ExpenseLedgerView({ onAddPayment }) {
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [selectedHeadId, setSelectedHeadId] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '' for all, 'EXPENSE', 'INCOME'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHeads = async () => {
    try {
      const data = await api.getExpenseHeads();
      setExpenseHeads(data || []);
      if (data && data.length > 0 && !selectedHeadId) {
        setSelectedHeadId(String(data[0].id));
      }
    } catch {}
  };

  useEffect(() => { loadHeads(); }, []);

  const loadLedger = async () => {
    if (!selectedHeadId) return setError('Please select an Expense or Income head.');
    setLoading(true); setError('');
    try {
      const data = await api.getExpenseLedger(selectedHeadId, dateFrom, dateTo, typeFilter);
      setLedger(data);
    } catch (err) {
      setError(err.message || 'Failed to load expense ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedHeadId) {
      loadLedger();
    }
  }, [selectedHeadId, typeFilter]);

  const filteredHeads = typeFilter
    ? expenseHeads.filter(h => h.type === typeFilter)
    : expenseHeads;

  const handlePrint = () => {
    const h = ledger?.head || ledger?.expenseHead;
    if (!ledger || !h) return;
    const win = window.open('', '_blank');
    const isInc = h.type === 'INCOME';
    const rows = (ledger.transactions || []).map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.doc_no || t.voucher_no || '—'}</td>
        <td>${t.payment_mode || 'Bank'}</td>
        <td>${t.bank_name || (t.payment_mode === 'Cash' ? 'Cash in Hand' : '—')}</td>
        <td>${t.reference_no || '—'}</td>
        <td>${t.description || t.remarks || '—'}</td>
        <td style="text-align:right;font-weight:700;color:${isInc ? '#2e7d32' : '#c62828'}">₹${Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    win.document.write(`<html><head><title>Ledger — ${h.name}</title>
      <style>* { box-sizing:border-box; } body { font-family:Arial; margin:20px; font-size:12px; }
      h2 { color:#1a237e; margin-bottom:4px; } table { width:100%; border-collapse:collapse; margin-top:14px; }
      th { background:#1a237e; color:#fff; padding:8px; text-align:left; } td { padding:7px; border-bottom:1px solid #ddd; }
      .summary { display:flex; gap:16px; margin:14px 0; }
      .sum-box { flex:1; border:1px solid #ccc; padding:10px; border-radius:4px; }
      @media print { * { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <h2>${isInc ? 'Income Ledger' : 'Expense Ledger'} — ${h.name} (${h.code})</h2>
      <p style="color:#555;">Category: <strong>${h.category || 'General'}</strong> | Type: <strong>${h.type}</strong></p>
      ${(dateFrom || dateTo) ? `<p>Period: ${dateFrom || 'Beginning'} to ${dateTo || 'Today'}</p>` : ''}
      <div class="summary">
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Total ${isInc ? 'Received' : 'Incurred'}</div><div style="font-size:16px;font-weight:700;color:${isInc ? '#2e7d32' : '#c62828'}">₹${(ledger.summary?.totalIncurred ?? ledger.summary?.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Cash ${isInc ? 'Inflow' : 'Outflow'}</div><div style="font-size:16px;font-weight:700">₹${(ledger.summary?.totalCash ?? ledger.summary?.cashTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Bank ${isInc ? 'Inflow' : 'Outflow'}</div><div style="font-size:16px;font-weight:700">₹${(ledger.summary?.totalBank ?? ledger.summary?.bankTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Total Vouchers</div><div style="font-size:16px;font-weight:700">${ledger.summary?.totalCount ?? ledger.summary?.count ?? 0}</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Voucher #</th><th>Mode</th><th>Account</th><th>Ref / Cheque #</th><th>Remarks</th><th style="text-align:right">Amount (₹)</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="7" style="text-align:center;padding:20px;">No entries recorded</td></tr>'}</tbody>
      </table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const headInfo = ledger?.head || ledger?.expenseHead;
  const isIncomeHead = headInfo?.type === 'INCOME';

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '18px', background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ minWidth: '130px' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>Head Type</label>
          <select className="form-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); }}>
            <option value="">All (Expense & Income)</option>
            <option value="EXPENSE">Expenses Only</option>
            <option value="INCOME">Incomes Only</option>
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>Expense / Income Head *</label>
          <select className="form-select" value={selectedHeadId} onChange={e => { setSelectedHeadId(e.target.value); setLedger(null); }}>
            <option value="">Select Expense / Income Head…</option>
            {filteredHeads.map(h => (
              <option key={h.id} value={h.id}>
                [{h.code}] {h.name} — {h.category} ({h.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>From</label>
          <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>To</label>
          <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={loadLedger} disabled={!selectedHeadId || loading}>
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <BookOpen size={14} />} View Statement
        </button>
        {ledger && (
          <>
            <button className="btn btn-outline" onClick={handlePrint}><Printer size={14} /> Print</button>
            <button className="btn btn-outline" onClick={() => exportCSV(ledger.transactions, `${headInfo?.code || 'expense'}-ledger.csv`)}><Download size={14} /> Export</button>
          </>
        )}
        <button
          className="btn btn-outline"
          style={{ marginLeft: 'auto', borderColor: 'var(--emerald)', color: 'var(--emerald)' }}
          onClick={() => onAddPayment && onAddPayment(isIncomeHead ? 'INCOME' : 'EXPENSE', selectedHeadId)}
        >
          <Plus size={14} /> {isIncomeHead ? '+ Record Income' : '+ Record Expense'}
        </button>
      </div>

      {error && <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}

      {ledger && headInfo && (
        <>
          {/* Head Info Card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 20px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{headInfo.name}</h3>
                <span className={`pill ${isIncomeHead ? 'pill-emerald' : 'pill-rose'}`} style={{ fontSize: '11px' }}>
                  {headInfo.type}
                </span>
                <span className="pill pill-blue num-mono" style={{ fontSize: '11px' }}>{headInfo.code}</span>
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                Category: <strong>{headInfo.category || 'General'}</strong> {headInfo.description ? `• ${headInfo.description}` : ''}
              </p>
            </div>
            {(dateFrom || dateTo) && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
                Period: <strong>{dateFrom || 'Beginning'}</strong> to <strong>{dateTo || 'Today'}</strong>
              </div>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div className="stat-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Total {isIncomeHead ? 'Income (Receipts)' : 'Expense (Payments)'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: isIncomeHead ? 'var(--emerald)' : 'var(--rose)', marginTop: '4px' }}>
                {fmtINR(ledger.summary?.totalIncurred ?? ledger.summary?.totalAmount ?? 0)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Cash {isIncomeHead ? 'Inflow' : 'Outflow'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--amber)', marginTop: '4px' }}>
                {fmtINR(ledger.summary?.totalCash ?? ledger.summary?.cashTotal ?? 0)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Bank {isIncomeHead ? 'Inflow' : 'Outflow'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                {fmtINR(ledger.summary?.totalBank ?? ledger.summary?.bankTotal ?? 0)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Total Vouchers
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px' }}>
                {ledger.summary?.totalCount ?? ledger.summary?.count ?? 0}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher #</th>
                  <th>Mode</th>
                  <th>Bank / Account</th>
                  <th>Reference / Cheque #</th>
                  <th>Remarks / Description</th>
                  <th style={{ textAlign: 'right' }}>Amount ₹</th>
                </tr>
              </thead>
              <tbody>
                {!ledger.transactions || ledger.transactions.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No expense / payment entries recorded in this period.</td></tr>
                ) : ledger.transactions.map((t, i) => (
                  <tr key={t.id || i}>
                    <td>{t.date}</td>
                    <td><span className={`pill ${isIncomeHead ? 'pill-emerald' : 'pill-rose'} num-mono`} style={{ fontSize: '10px' }}>{t.doc_no || '—'}</span></td>
                    <td><span className="pill pill-cyan" style={{ fontSize: '10px' }}>{t.payment_mode || 'Bank'}</span></td>
                    <td style={{ fontSize: '12px' }}>{t.bank_name || (t.payment_mode === 'Cash' ? 'Cash in Hand' : '—')}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.reference_no || '—'}</td>
                    <td style={{ fontSize: '12px' }}>{t.description || t.remarks || '—'}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: isIncomeHead ? 'var(--emerald)' : 'var(--rose)' }}>
                      {fmtINR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.transactions && ledger.transactions.length > 0 && (
              <div style={{ padding: '10px 16px', background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '24px', fontWeight: '700', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>Total {ledger.transactions.length} Vouchers:</span>
                <span style={{ color: isIncomeHead ? 'var(--emerald)' : 'var(--rose)', fontSize: '16px' }}>
                  {fmtINR(ledger.summary?.totalIncurred || 0)}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── EXPORT / CA TOOLS ─────────────────────────────────────────────────────────
function ExportPage() {
  const [exportType, setExportType] = useState('sales-register');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleExport = async (action = 'preview') => {
    setLoading(true); setError(''); setPreview(null);
    try {
      const data = await api.getExportData(exportType, dateFrom, dateTo, '');
      if (action === 'download') {
        const filenames = {
          'sales-register': 'sales-register.csv',
          'purchase-register': 'purchase-register.csv',
          'gst-data': 'gst-data.csv',
        };
        exportCSV(data, filenames[exportType] || 'export.csv');
      } else {
        setPreview(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportTypeOptions = [
    { value: 'sales-register', label: '1. Sales Register (GST)', desc: 'All B2B/B2C GST sales invoices with full tax breakup' },
    { value: 'sales-register-nongst', label: '2. Sales Register (Non-GST)', desc: 'Retail and non-taxable finished goods sales' },
    { value: 'purchase-register', label: '3. Purchase Register (GST)', desc: 'All GST raw material purchases with ITC details' },
    { value: 'purchase-register-nongst', label: '4. Purchase Register (Non-GST)', desc: 'Direct cash and unregistered vendor purchases' },
    { value: 'customer-receipts', label: '5. Customer Receipts Register', desc: 'All payment receipts from customers (Bank/Cash/UPI)' },
    { value: 'supplier-payments', label: '6. Supplier Payments Register', desc: 'All raw material supplier payments' },
    { value: 'cash-book', label: '7. Cash Book', desc: 'Chronological cash inflows and outflows with cash in hand' },
    { value: 'bank-book', label: '8. Bank Book', desc: 'Bank statement reconciling sales, receipts, purchases and payments' },
    { value: 'rm-consumption', label: '9. Raw Material Consumption Register', desc: 'Batch-wise raw materials issued to production lines' },
    { value: 'production-yield', label: '10. Production & Yield Register', desc: 'Batch-wise output, yield percentage, and wastage percentage' },
    { value: 'wastage-register', label: '11. Wastage Register', desc: 'Detailed log of scrap, edge trim, and machine waste' },
    { value: 'customer-outstanding', label: '12. Customer Outstanding Summary', desc: 'Closing receivables balance for all customers' },
    { value: 'supplier-outstanding', label: '13. Supplier Outstanding Summary', desc: 'Closing payables balance for all suppliers' },
    { value: 'gst-data', label: '14. Consolidated GST Summary (GSTR-1/3B)', desc: 'Combined GST sales and purchase data for filing' },
    { value: 'rm-stock-ledger', label: '15. RM Stock Movement Ledger', desc: 'Audit trail of all raw material receipts, issues, and adjustments' },
    { value: 'fg-stock-ledger', label: '16. FG Stock Movement Ledger', desc: 'Audit trail of all finished goods production, sales dispatches, and adjustments' },
  ];

  return (
    <div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '700' }}>CA & Audit Export Registers</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>Register / Report Type</label>
            <select className="form-select" style={{ minWidth: '300px' }} value={exportType} onChange={e => { setExportType(e.target.value); setPreview(null); }}>
              {exportTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>From Date</label>
            <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>To Date</label>
            <input type="date" className="form-input" style={{ padding: '7px 10px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-outline" onClick={() => handleExport('preview')} disabled={loading}>
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />} Preview
          </button>
          <button className="btn btn-primary" onClick={() => handleExport('download')} disabled={loading}>
            <Download size={14} /> Download CSV
          </button>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-dim)' }}>
          {exportTypeOptions.find(o => o.value === exportType)?.desc}
        </div>
      </div>

      {error && <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}

      {preview && preview.length > 0 && (
        <div>
          <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>{preview.length} rows returned</div>
          <div className="table-container" style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
            <table className="custom-table" style={{ minWidth: '900px', fontSize: '11.5px' }}>
              <thead>
                <tr>{Object.keys(preview[0]).map(k => <th key={k} style={{ whiteSpace: 'nowrap' }}>{k}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{v ?? '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {preview && preview.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data found for the selected period.</div>
      )}
    </div>
  );
}

// ── CASH & BANK BOOKS VIEW ───────────────────────────────────────────────────
function CashBankView() {
  const [bookType, setBookType] = useState('cash'); // 'cash' or 'bank'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState({ transactions: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const res = bookType === 'cash' ? await api.getCashLedger(dateFrom, dateTo) : await api.getBankLedger(dateFrom, dateTo);
      setData(res || { transactions: [], summary: {} });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [bookType, dateFrom, dateTo]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button className={`mode-btn ${bookType === 'cash' ? 'active' : ''}`} onClick={() => setBookType('cash')}>
            💵 Cash Book
          </button>
          <button className={`mode-btn ${bookType === 'bank' ? 'active' : ''}`} onClick={() => setBookType('bank')}>
            🏦 Bank Book
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>to</span>
          <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={loadData}>
            <RefreshCw size={13} />
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(data.transactions, `${bookType}-book.csv`)}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Inflows</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--emerald)', marginTop: '4px' }}>
            {fmtINR(data.summary?.totalInflow || 0)}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Outflows</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--rose)', marginTop: '4px' }}>
            {fmtINR(data.summary?.totalOutflow || 0)}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {bookType === 'cash' ? 'Net Cash in Hand' : 'Net Bank Balance'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: (data.summary?.netCashInHand ?? data.summary?.netBankBalance) >= 0 ? '#38bdf8' : 'var(--rose)', marginTop: '4px' }}>
            {fmtINR(data.summary?.netCashInHand ?? data.summary?.netBankBalance ?? 0)}
          </div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}

      {/* Transactions Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="custom-table" style={{ minWidth: '850px' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Doc / Voucher #</th>
              <th>Category</th>
              <th>Description / Particulars</th>
              {bookType === 'bank' && <th>Mode</th>}
              <th style={{ textAlign: 'right' }}>Inflow (Debit ₹)</th>
              <th style={{ textAlign: 'right' }}>Outflow (Credit ₹)</th>
              <th style={{ textAlign: 'right' }}>Running Balance ₹</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}><RefreshCw size={20} className="animate-spin" /></td></tr>
            ) : data.transactions.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No transactions found for the selected period.</td></tr>
            ) : data.transactions.map((tx, idx) => (
              <tr key={idx}>
                <td>{tx.date}</td>
                <td><span className="pill pill-blue num-mono" style={{ fontSize: '10px' }}>{tx.doc_no || '—'}</span></td>
                <td><span className={`pill ${tx.type === 'INFLOW' ? 'pill-emerald' : 'pill-amber'}`} style={{ fontSize: '10px' }}>{tx.category}</span></td>
                <td style={{ fontSize: '12px' }}>{tx.description}</td>
                {bookType === 'bank' && <td><span className="pill pill-cyan" style={{ fontSize: '10px' }}>{tx.mode || 'Bank'}</span></td>}
                <td className="num-mono" style={{ textAlign: 'right', color: tx.inflow > 0 ? 'var(--emerald)' : 'inherit', fontWeight: tx.inflow > 0 ? '700' : 'normal' }}>
                  {tx.inflow > 0 ? fmtINR(tx.inflow) : '—'}
                </td>
                <td className="num-mono" style={{ textAlign: 'right', color: tx.outflow > 0 ? 'var(--rose)' : 'inherit', fontWeight: tx.outflow > 0 ? '700' : 'normal' }}>
                  {tx.outflow > 0 ? fmtINR(tx.outflow) : '—'}
                </td>
                <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: tx.balance >= 0 ? 'var(--text-main)' : 'var(--rose)' }}>
                  {fmtINR(tx.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── OUTSTANDING SUMMARIES VIEW ───────────────────────────────────────────────
function OutstandingView({ onSelectParty }) {
  const [type, setType] = useState('CUSTOMER'); // 'CUSTOMER' or 'SUPPLIER'
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const res = type === 'CUSTOMER' ? await api.getCustomerOutstanding() : await api.getSupplierOutstanding();
      setRows(res.rows || []);
      setSummary(res.summary || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [type]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button className={`mode-btn ${type === 'CUSTOMER' ? 'active' : ''}`} onClick={() => setType('CUSTOMER')}>
            <Users size={14} style={{ marginRight: '6px' }} /> Customer Receivables
          </button>
          <button className={`mode-btn ${type === 'SUPPLIER' ? 'active' : ''}`} onClick={() => setType('SUPPLIER')}>
            <UserCheck size={14} style={{ marginRight: '6px' }} /> Supplier Payables
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={loadData}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(rows, `${type.toLowerCase()}-outstanding.csv`)}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Parties</div>
          <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px' }}>
            {summary.totalCount || rows.length}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {type === 'CUSTOMER' ? 'Total Receivables' : 'Total Payables'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: type === 'CUSTOMER' ? 'var(--emerald)' : 'var(--rose)', marginTop: '4px' }}>
            {fmtINR(type === 'CUSTOMER' ? (summary.totalReceivable || 0) : (summary.totalPayable || 0))}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Advance Balances</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--amber)', marginTop: '4px' }}>
            {fmtINR(summary.totalAdvance || 0)}
          </div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="custom-table" style={{ minWidth: '950px' }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Party Name</th>
              <th>Phone</th>
              <th>GSTIN</th>
              <th style={{ textAlign: 'right' }}>Opening Balance</th>
              <th style={{ textAlign: 'right' }}>{type === 'CUSTOMER' ? 'Total Invoiced' : 'Total Billed'}</th>
              <th style={{ textAlign: 'right' }}>{type === 'CUSTOMER' ? 'Total Received' : 'Total Paid'}</th>
              <th style={{ textAlign: 'right' }}>Closing Net Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}><RefreshCw size={20} className="animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No parties found.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td><span className="pill pill-blue num-mono" style={{ fontSize: '10px' }}>{r.code}</span></td>
                <td style={{ fontWeight: '700' }}>{r.name}</td>
                <td style={{ fontSize: '12px' }}>{r.phone || '—'}</td>
                <td style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{r.gstin || 'URP'}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{fmtINR(r.openingBalance)}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{fmtINR(type === 'CUSTOMER' ? r.totalInvoiced : r.totalBilled)}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{fmtINR(type === 'CUSTOMER' ? r.totalReceived : r.totalPaid)}</td>
                <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: r.closingBalance > 0 ? (type === 'CUSTOMER' ? 'var(--emerald)' : 'var(--rose)') : (r.closingBalance < 0 ? 'var(--amber)' : 'var(--text-dim)') }}>
                  {fmtINR(r.closingBalance)}
                </td>
                <td>
                  <span className={`pill ${r.status === 'RECEIVABLE' ? 'pill-emerald' : r.status === 'PAYABLE' ? 'pill-rose' : r.status === 'ADVANCE' ? 'pill-amber' : 'pill-blue'}`} style={{ fontSize: '10px' }}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => onSelectParty(type, r.id)}
                  >
                    View Ledger →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── DEBIT / CREDIT NOTES VIEW ─────────────────────────────────────────────────
function DebitCreditNotesView({ customers, suppliers }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    noteType: 'DEBIT_NOTE', partyType: 'CUSTOMER', partyId: '',
    date: new Date().toISOString().split('T')[0],
    taxableAmount: '', gstPercent: '18', referenceInvoice: '', reason: '', remarks: ''
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let q = [];
      if (filterType) q.push(`noteType=${filterType}`);
      if (filterParty) q.push(`partyType=${filterParty}`);
      const data = await api.getDebitCreditNotes(q.join('&'));
      setNotes(data || []);
    } catch (e) { setNotes([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterType, filterParty]);

  const openAdd = () => {
    setEditNote(null);
    setForm({ noteType: 'DEBIT_NOTE', partyType: 'CUSTOMER', partyId: '', date: new Date().toISOString().split('T')[0], taxableAmount: '', gstPercent: '18', referenceInvoice: '', reason: '', remarks: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (n) => {
    setEditNote(n);
    setForm({
      noteType: n.note_type, partyType: n.party_type, partyId: String(n.party_id),
      date: n.date, taxableAmount: String(n.taxable_amount), gstPercent: String(n.gst_percent),
      referenceInvoice: n.reference_invoice || '', reason: n.reason || '', remarks: n.remarks || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.partyId || !form.taxableAmount || Number(form.taxableAmount) <= 0) {
      return setFormError('Party and taxable amount are required.');
    }
    setSaving(true); setFormError('');
    try {
      const payload = {
        noteType: form.noteType, partyType: form.partyType, partyId: Number(form.partyId),
        date: form.date, taxableAmount: Number(form.taxableAmount), gstPercent: Number(form.gstPercent),
        referenceInvoice: form.referenceInvoice, reason: form.reason, remarks: form.remarks
      };
      if (editNote) await api.updateDebitCreditNote(editNote.id, payload);
      else await api.createDebitCreditNote(payload);
      setShowModal(false);
      load();
    } catch (err) { setFormError(err.message || 'Failed to save note'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await api.deleteDebitCreditNote(deleteTarget.id); setDeleteTarget(null); load(); } catch {}
    setDeleting(false);
  };

  const taxable = Number(form.taxableAmount) || 0;
  const gstPct = Number(form.gstPercent) || 0;
  const gstAmt = Number((taxable * gstPct / 100).toFixed(2));
  const totalAmt = Number((taxable + gstAmt).toFixed(2));

  const partyList = form.partyType === 'CUSTOMER' ? customers : suppliers;

  const noteTypeLabel = (t) => ({
    DEBIT_NOTE: 'Debit Note', CREDIT_NOTE: 'Credit Note'
  }[t] || t);

  const partyTypeLabel = (p) => ({
    CUSTOMER: 'Customer', SUPPLIER: 'Supplier'
  }[p] || p);

  const noteColor = (t) => t === 'DEBIT_NOTE' ? 'var(--rose)' : 'var(--emerald)';

  return (
    <div>
      {/* Filters + Add */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: '180px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Note Types</option>
          <option value="DEBIT_NOTE">Debit Notes</option>
          <option value="CREDIT_NOTE">Credit Notes</option>
        </select>
        <select className="form-select" style={{ width: '160px' }} value={filterParty} onChange={e => setFilterParty(e.target.value)}>
          <option value="">All Parties</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SUPPLIER">Suppliers</option>
        </select>
        <button className="btn btn-outline" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
        <button className="btn btn-primary" onClick={openAdd} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Note
        </button>
      </div>

      {/* Notes Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Note #</th>
              <th>Type</th>
              <th>Party</th>
              <th>Party Type</th>
              <th>Reference Invoice</th>
              <th>Reason</th>
              <th style={{ textAlign: 'right' }}>Taxable ₹</th>
              <th style={{ textAlign: 'right' }}>GST %</th>
              <th style={{ textAlign: 'right' }}>Total ₹</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>Loading…</td></tr>
            ) : notes.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>No debit/credit notes found.</td></tr>
            ) : notes.map(n => (
              <tr key={n.id}>
                <td>{n.date}</td>
                <td><strong style={{ color: noteColor(n.note_type) }}>{n.note_code}</strong></td>
                <td><span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: n.note_type === 'DEBIT_NOTE' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: noteColor(n.note_type) }}>{noteTypeLabel(n.note_type)}</span></td>
                <td>{n.party_name || '—'}</td>
                <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{partyTypeLabel(n.party_type)}</td>
                <td style={{ fontSize: '12px' }}>{n.reference_invoice || '—'}</td>
                <td style={{ fontSize: '12px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.reason || '—'}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{fmtINR(n.taxable_amount)}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{n.gst_percent}%</td>
                <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: noteColor(n.note_type) }}>{fmtINR(n.total_amount)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit(n)} />
                    <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => setDeleteTarget(n)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editNote ? `Edit Note (${editNote.note_code})` : '+ New Debit / Credit Note'}</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formError && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>{formError}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Note Type *</label>
                    <select className="form-select" value={form.noteType} onChange={e => setForm({ ...form, noteType: e.target.value })}>
                      <option value="DEBIT_NOTE">Debit Note</option>
                      <option value="CREDIT_NOTE">Credit Note</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Party Type *</label>
                    <select className="form-select" value={form.partyType} onChange={e => setForm({ ...form, partyType: e.target.value, partyId: '' })}>
                      <option value="CUSTOMER">Customer</option>
                      <option value="SUPPLIER">Supplier</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{form.partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'} *</label>
                    <select className="form-select" value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })} required>
                      <option value="">Select party…</option>
                      {partyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taxable Amount (₹) *</label>
                    <input type="number" className="form-input" value={form.taxableAmount} onChange={e => setForm({ ...form, taxableAmount: e.target.value })} placeholder="e.g. 10000" required min="0.01" step="0.01" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST % *</label>
                    <select className="form-select" value={form.gstPercent} onChange={e => setForm({ ...form, gstPercent: e.target.value })}>
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference Invoice</label>
                    <input type="text" className="form-input" value={form.referenceInvoice} onChange={e => setForm({ ...form, referenceInvoice: e.target.value })} placeholder="e.g. INV-2026-000012" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason</label>
                    <input type="text" className="form-input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Goods returned, Rate difference…" />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Remarks</label>
                    <input type="text" className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Internal remarks" />
                  </div>
                </div>
                {/* GST Preview */}
                {taxable > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-alt)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taxable</div>
                      <div style={{ fontWeight: '700', fontSize: '16px' }}>{fmtINR(taxable)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GST ({gstPct}%)</div>
                      <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--amber)' }}>{fmtINR(gstAmt)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</div>
                      <div style={{ fontWeight: '700', fontSize: '18px', color: form.noteType === 'DEBIT_NOTE' ? 'var(--rose)' : 'var(--emerald)' }}>{fmtINR(totalAmt)}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editNote ? 'Update Note' : 'Create Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> Confirm Delete</h3>
              <button className="modal-close-btn" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Delete note <strong style={{ color: 'var(--text-main)' }}>{deleteTarget.note_code}</strong>? This will affect the party ledger balance.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn" style={{ background: 'var(--rose)', color: '#fff' }} onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OPENING BALANCES VIEW ─────────────────────────────────────────────────────
function OpeningBalancesView({ customers, suppliers }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editBal, setEditBal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfMsg, setCfMsg] = useState('');
  const [form, setForm] = useState({
    financialYear: '', entityType: 'CUSTOMER', entityId: '',
    openingDate: new Date().toISOString().split('T')[0],
    amount: '', balanceType: 'Dr', quantity: '', unit: 'KG', rate: '', remarks: ''
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = filterType ? `entityType=${filterType}` : '';
      const data = await api.getOpeningBalances(q);
      setBalances(data || []);
    } catch { setBalances([]); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.getRawMaterials && api.getRawMaterials().then(setRawMaterials).catch(() => {});
    api.getFinishedGoods && api.getFinishedGoods().then(setFinishedGoods).catch(() => {});
    api.getBankAccounts && api.getBankAccounts().then(setBankAccounts).catch(() => {});
    api.getFinancialYears && api.getFinancialYears().then(setFinancialYears).catch(() => {});
  }, [filterType]);

  const entityOptions = () => {
    switch (form.entityType) {
      case 'CUSTOMER': return customers;
      case 'SUPPLIER': return suppliers;
      case 'RAW_MATERIAL': case 'RM':
        return rawMaterials.map(rm => ({
          id: rm.id,
          name: `[${rm.code || rm.id}] ${rm.name || ''}`.trim()
        }));
      case 'FINISHED_GOOD': case 'FG':
        return finishedGoods.map(fg => {
          const cleanName = (fg.product_name || '')
            .replace(/BENGAL STOCK\s*/i, '')
            .trim();
          const label = cleanName
            ? `[${fg.product_code || fg.id}] ${cleanName}`
            : `[${fg.product_code || fg.id}] ${fg.gsm ? fg.gsm + 'GSM ' : ''}${fg.width_size || ''} ${fg.colour || ''}`.trim();
          return {
            id: fg.id,
            name: label
          };
        });
      case 'BANK': return bankAccounts.map(b => ({ id: b.id, name: b.account_name || b.bank_name }));
      default: return [];
    }
  };

  const isStock = ['RAW_MATERIAL', 'RM', 'FINISHED_GOOD', 'FG'].includes(form.entityType);
  const isCash = form.entityType === 'CASH';
  const needsParty = !isCash;

  // Entity search state for searchable dropdown
  const [entitySearch, setEntitySearch] = React.useState('');

  const openAdd = () => {
    setEditBal(null);
    setEntitySearch('');
    setForm({ financialYear: financialYears.find(f => f.is_active)?.name || '', entityType: 'CUSTOMER', entityId: '', openingDate: new Date().toISOString().split('T')[0], amount: '', balanceType: 'Dr', quantity: '', unit: 'KG', rate: '', remarks: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditBal(b);
    setForm({
      financialYear: b.financial_year, entityType: b.entity_type,
      entityId: String(b.entity_id || ''), openingDate: b.opening_date,
      amount: String(b.amount || ''), balanceType: b.balance_type || 'Dr',
      quantity: String(b.quantity || ''), unit: b.unit || 'KG', rate: String(b.rate || ''), remarks: b.remarks || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.financialYear) return setFormError('Financial Year is required.');
    if (needsParty && !form.entityId) return setFormError('Entity is required.');
    setSaving(true); setFormError('');
    try {
      const payload = {
        financialYear: form.financialYear, entityType: form.entityType,
        entityId: isCash ? 0 : Number(form.entityId),
        openingDate: form.openingDate, amount: Number(form.amount) || 0,
        balanceType: form.balanceType,
        ...(isStock ? { quantity: Number(form.quantity), unit: form.unit, rate: Number(form.rate) || 0 } : {}),
        remarks: form.remarks
      };
      if (editBal) await api.updateOpeningBalance(editBal.id, payload);
      else await api.createOpeningBalance(payload);
      setShowModal(false);
      load();
    } catch (err) { setFormError(err.message || 'Failed to save opening balance'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await api.deleteOpeningBalance(deleteTarget.id); setDeleteTarget(null); load(); } catch {}
    setDeleting(false);
  };

  const handleCarryForward = async () => {
    const srcFy = financialYears.find(f => f.is_active);
    if (!srcFy) { setCfMsg('No active Financial Year found.'); return; }
    const allFys = financialYears.filter(f => !f.is_active);
    const targetName = prompt(`Carry-forward from: ${srcFy.name}\nEnter Target Financial Year name (e.g. FY 2027-28):`);
    if (!targetName) return;
    const openingDate = prompt('Enter Opening Date for new FY (YYYY-MM-DD):', `${new Date().getFullYear() + 1}-04-01`);
    if (!openingDate) return;
    setCfLoading(true); setCfMsg('');
    try {
      const result = await api.carryForwardFinancialYear({ sourceYear: srcFy.name, targetYear: targetName.trim(), openingDate });
      setCfMsg(`✓ ${result.message} Customers: ${result.results?.customers}, Suppliers: ${result.results?.suppliers}, RM: ${result.results?.rawMaterials}, FG: ${result.results?.finishedGoods}`);
      load();
    } catch (err) { setCfMsg(`✗ ${err.message}`); }
    setCfLoading(false);
  };

  const etLabel = (t) => ({ CUSTOMER: 'Customer', SUPPLIER: 'Supplier', RAW_MATERIAL: 'Raw Material', RM: 'Raw Material', FINISHED_GOOD: 'Finished Good', FG: 'Finished Good', CASH: 'Cash', BANK: 'Bank' }[t] || t);

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: '200px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Entity Types</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SUPPLIER">Suppliers</option>
          <option value="RAW_MATERIAL">Raw Materials</option>
          <option value="FINISHED_GOOD">Finished Goods</option>
          <option value="CASH">Cash</option>
          <option value="BANK">Bank</option>
        </select>
        <button className="btn btn-outline" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
        <button
          className="btn btn-outline"
          onClick={handleCarryForward}
          disabled={cfLoading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--amber)', color: 'var(--amber)' }}
        >
          <ChevronRight size={14} /> {cfLoading ? 'Processing…' : 'FY Carry Forward'}
        </button>
        <button className="btn btn-primary" onClick={openAdd} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Add Opening Balance
        </button>
      </div>

      {cfMsg && (
        <div style={{ padding: '10px 14px', marginBottom: '14px', borderRadius: '8px', background: cfMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: cfMsg.startsWith('✓') ? 'var(--emerald)' : 'var(--rose)', border: `1px solid ${cfMsg.startsWith('✓') ? 'var(--emerald)' : 'var(--rose)'}`, fontSize: '13px' }}>
          {cfMsg}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>FY</th>
              <th>Opening Date</th>
              <th>Type</th>
              <th>Entity</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Amount ₹</th>
              <th>Dr/Cr</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>Loading…</td></tr>
            ) : balances.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>No opening balances found.</td></tr>
            ) : balances.map(b => (
              <tr key={b.id}>
                <td style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary)' }}>{b.financial_year}</td>
                <td>{b.opening_date}</td>
                <td><span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', background: 'var(--bg-alt)', color: 'var(--text-muted)', fontWeight: '500' }}>{etLabel(b.entity_type)}</span></td>
                <td>{b.entity_name || (b.entity_type === 'CASH' ? 'Cash in Hand' : `ID: ${b.entity_id}`)}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{b.quantity ? Number(b.quantity).toLocaleString('en-IN') : '—'}</td>
                <td style={{ fontSize: '12px' }}>{b.unit || '—'}</td>
                <td className="num-mono" style={{ textAlign: 'right' }}>{b.amount ? fmtINR(b.amount) : '—'}</td>
                <td>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: b.balance_type === 'Dr' ? 'var(--rose)' : 'var(--emerald)' }}>
                    {b.balance_type}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.remarks || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit(b)} />
                    <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => setDeleteTarget(b)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editBal ? 'Edit Opening Balance' : '+ Add Opening Balance'}</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formError && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>{formError}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Financial Year *</label>
                    {financialYears.length > 0 ? (
                      <select className="form-select" value={form.financialYear} onChange={e => setForm({ ...form, financialYear: e.target.value })} required>
                        <option value="">Select FY…</option>
                        {financialYears.map(fy => <option key={fy.name} value={fy.name}>{fy.name}{fy.is_active ? ' (Active)' : ''}</option>)}
                      </select>
                    ) : (
                      <input type="text" className="form-input" value={form.financialYear} onChange={e => setForm({ ...form, financialYear: e.target.value })} placeholder="e.g. FY 2026-27" required />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Opening Date *</label>
                    <input type="date" className="form-input" value={form.openingDate} onChange={e => setForm({ ...form, openingDate: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Entity Type *</label>
                    <select className="form-select" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value, entityId: '' })}>
                      <option value="CUSTOMER">Customer</option>
                      <option value="SUPPLIER">Supplier</option>
                      <option value="RAW_MATERIAL">Raw Material (Stock)</option>
                      <option value="FINISHED_GOOD">Finished Good (Stock)</option>
                      <option value="CASH">Cash in Hand</option>
                      <option value="BANK">Bank Account</option>
                    </select>
                  </div>
                  {needsParty && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">{etLabel(form.entityType)} *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`Search ${etLabel(form.entityType)}…`}
                        value={entitySearch}
                        onChange={e => { setEntitySearch(e.target.value); setForm(f => ({ ...f, entityId: '' })); }}
                        style={{ marginBottom: '6px' }}
                      />
                      <select
                        className="form-select"
                        value={form.entityId}
                        onChange={e => { setForm({ ...form, entityId: e.target.value }); setEntitySearch(''); }}
                        required
                      >
                        <option value="">Select…</option>
                        {entityOptions()
                          .filter(p => !entitySearch || (p.name || '').toLowerCase().includes(entitySearch.toLowerCase()))
                          .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                        }
                      </select>
                    </div>
                  )}
                  {isStock && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Quantity *</label>
                        <input type="number" className="form-input" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="e.g. 5000" min="0" step="0.001" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Unit</label>
                        <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                          <option value="KG">KG</option>
                          <option value="MT">MT</option>
                          <option value="PCS">PCS</option>
                          <option value="ROLLS">ROLLS</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Rate per Unit (₹)</label>
                        <input type="number" className="form-input" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} placeholder="e.g. 100" min="0" step="0.01" />
                      </div>
                    </>
                  )}
                  {!isStock && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Amount (₹) *</label>
                        <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 150000" min="0" step="0.01" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Balance Type *</label>
                        <select className="form-select" value={form.balanceType} onChange={e => setForm({ ...form, balanceType: e.target.value })}>
                          <option value="Dr">Dr (Debit)</option>
                          <option value="Cr">Cr (Credit)</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="form-group full-width">
                    <label className="form-label">Remarks</label>
                    <input type="text" className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="e.g. Opening as per audit report" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editBal ? 'Update' : 'Add Opening Balance'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> Confirm Delete</h3>
              <button className="modal-close-btn" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Delete this opening balance entry for <strong style={{ color: 'var(--text-main)' }}>{deleteTarget.financial_year}</strong>? Stock/balance movements will be reversed.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn" style={{ background: 'var(--rose)', color: '#fff' }} onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ACCOUNTS PAGE ────────────────────────────────────────────────────────
const TABS = [
  { id: 'customer-ledger', label: 'Customer Ledger', icon: <Users size={14} /> },
  { id: 'supplier-ledger', label: 'Supplier Ledger', icon: <UserCheck size={14} /> },
  { id: 'cash-bank', label: 'Cash & Bank Books', icon: <DollarSign size={14} /> },
  { id: 'expense-ledger', label: 'Expense & Income Ledger', icon: <TrendingDown size={14} /> },
  { id: 'outstanding', label: 'Outstanding Summaries', icon: <TrendingUp size={14} /> },
  { id: 'payments', label: 'Payments Register', icon: <CreditCard size={14} /> },
  { id: 'debit-credit-notes', label: 'Debit / Credit Notes', icon: <FileCheck size={14} /> },
  { id: 'opening-balances', label: 'Opening Balances', icon: <Archive size={14} /> },
  { id: 'export', label: 'Export / CA Tools', icon: <Download size={14} /> },
];

export default function AccountsPage() {
  const [tab, setTab] = useState('customer-ledger');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentDefaultType, setPaymentDefaultType] = useState('CUSTOMER');
  const [paymentDefaultPartyId, setPaymentDefaultPartyId] = useState('');
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(() => {});
    api.getSuppliers().then(setSuppliers).catch(() => {});
    api.getExpenseHeads().then(setExpenseHeads).catch(() => {});
    api.getBankAccounts && api.getBankAccounts().then(setBankAccounts).catch(() => {});
  }, []);

  const openAddPayment = (type = 'CUSTOMER', partyId = '') => {
    setEditingPayment(null);
    setPaymentDefaultType(type);
    setPaymentDefaultPartyId(String(partyId));
    setShowPaymentModal(true);
  };

  const openEditPayment = (payment) => {
    setEditingPayment(payment);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentsRefreshKey(k => k + 1);
  };

  const handleSelectPartyFromOutstanding = (partyType, partyId) => {
    setTab(partyType === 'CUSTOMER' ? 'customer-ledger' : 'supplier-ledger');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Accounts & Ledger</h2>
          <p>Customer / Supplier ledgers, Expense / Income statements, Cash & Bank books, and CA registers</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => openAddPayment()}>
            <Plus size={14} /> Record Payment / Receipt
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`mode-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'customer-ledger' && (
        <LedgerView
          type="CUSTOMER"
          parties={customers}
          customers={customers}
          suppliers={suppliers}
          onAddPayment={openAddPayment}
        />
      )}
      {tab === 'supplier-ledger' && (
        <LedgerView
          type="SUPPLIER"
          parties={suppliers}
          customers={customers}
          suppliers={suppliers}
          onAddPayment={openAddPayment}
        />
      )}
      {tab === 'cash-bank' && <CashBankView />}
      {tab === 'expense-ledger' && (
        <ExpenseLedgerView onAddPayment={openAddPayment} />
      )}
      {tab === 'outstanding' && <OutstandingView onSelectParty={handleSelectPartyFromOutstanding} />}
      {tab === 'payments' && (
        <PaymentsRegister
          customers={customers}
          suppliers={suppliers}
          onAddPayment={openAddPayment}
          onEditPayment={openEditPayment}
          refreshKey={paymentsRefreshKey}
        />
      )}
      {tab === 'debit-credit-notes' && (
        <DebitCreditNotesView customers={customers} suppliers={suppliers} />
      )}
      {tab === 'opening-balances' && (
        <OpeningBalancesView customers={customers} suppliers={suppliers} />
      )}
      {tab === 'export' && <ExportPage />}

      {/* Add / Edit Payment Modal */}
      <AddPaymentModal
        isOpen={showPaymentModal}
        initialPayment={editingPayment}
        customers={customers}
        suppliers={suppliers}
        expenseHeads={expenseHeads}
        bankAccounts={bankAccounts}
        defaultPartyType={paymentDefaultType}
        defaultPartyId={paymentDefaultPartyId}
        onClose={() => {
          setShowPaymentModal(false);
          setEditingPayment(null);
        }}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
