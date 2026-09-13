import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, CreditCard, FileText, Download, RefreshCw, Plus, Trash2,
  AlertTriangle, ChevronRight, Printer, Filter, Users, UserCheck, X,
  TrendingUp, TrendingDown, DollarSign
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
function AddPaymentModal({ isOpen, initialPayment, customers, suppliers, defaultPartyType, defaultPartyId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    partyType: defaultPartyType || 'CUSTOMER',
    partyId: defaultPartyId || '',
    amount: '',
    paymentMode: 'Bank',
    referenceNo: '',
    remarks: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialPayment) {
        setForm({
          date: initialPayment.date || new Date().toISOString().split('T')[0],
          partyType: initialPayment.party_type || defaultPartyType || 'CUSTOMER',
          partyId: initialPayment.party_id || defaultPartyId || '',
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

  const partyList = form.partyType === 'CUSTOMER' ? customers : suppliers;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.partyId || !form.amount || Number(form.amount) <= 0) {
      return setError('Party and a valid amount are required.');
    }
    try {
      setLoading(true); setError('');
      const payload = {
        date: form.date,
        partyType: form.partyType,
        partyId: Number(form.partyId),
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
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>
            {initialPayment
              ? `Edit ${initialPayment.party_type === 'CUSTOMER' ? 'Receipt' : 'Payment'} (${initialPayment.payment_code})`
              : form.partyType === 'CUSTOMER' ? '+ Record Receipt' : '+ Record Payment'}
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
                <label className="form-label">Party Type *</label>
                <select className="form-select" value={form.partyType} onChange={e => setForm({ ...form, partyType: e.target.value, partyId: '' })}>
                  <option value="CUSTOMER">Customer (Receipt)</option>
                  <option value="SUPPLIER">Supplier (Payment)</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">{form.partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'} *</label>
                <select className="form-select" value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })} required>
                  <option value="">Select party…</option>
                  {partyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 50000" required min="0.01" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Mode *</label>
                <select className="form-select" value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Cheque #</label>
                <input type="text" className="form-input" value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} placeholder="UTR / Cheque No." />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Remarks</label>
                <input type="text" className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Optional note" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (form.partyType === 'CUSTOMER' ? 'Record Receipt' : 'Record Payment')}
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
        <td style="text-align:right;font-weight:700;color:${t.balance >= 0 ? '#c62828' : '#2e7d32'}">₹${Math.abs(t.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${t.balance >= 0 ? 'Dr' : 'Cr'}</td>
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
        <div class="sum-box"><div style="font-size:10px;color:#666;text-transform:uppercase">Closing Balance</div><div style="font-size:16px;font-weight:700;color:${ledger.closingBalance >= 0 ? '#c62828' : '#2e7d32'}">₹${Math.abs(ledger.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${ledger.closingBalance >= 0 ? '(Receivable)' : '(Overpaid)'}</div></div>
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
                Opening Balance: {fmtINR(ledger.openingBalance)} {ledger.openingBalance > 0 ? '(Dr)' : '(Cr)'}
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
                      {fmtINR(Math.abs(t.balance))} {t.balance > 0 ? 'Dr' : t.balance < 0 ? 'Cr' : ''}
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
                  {fmtINR(Math.abs(ledger.closingBalance))} {ledger.closingBalance > 0 ? 'Dr (Receivable)' : 'Cr (Advance)'}
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
        <select className="form-select" style={{ width: '160px', padding: '7px 10px' }} value={filter.partyType} onChange={e => setFilter({ ...filter, partyType: e.target.value })}>
          <option value="">All Types</option>
          <option value="CUSTOMER">Receipts (Customer)</option>
          <option value="SUPPLIER">Payments (Supplier)</option>
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
                <th>Party</th>
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
              ) : payments.map(p => (
                <tr key={p.id}>
                  <td><span className={`pill ${p.party_type === 'CUSTOMER' ? 'pill-emerald' : 'pill-amber'} num-mono`} style={{ fontSize: '10px' }}>{p.payment_code}</span></td>
                  <td>{p.date}</td>
                  <td><span className={`pill ${p.party_type === 'CUSTOMER' ? 'pill-emerald' : 'pill-amber'}`} style={{ fontSize: '10px' }}>{p.party_type === 'CUSTOMER' ? 'Receipt' : 'Payment'}</span></td>
                  <td style={{ fontWeight: '600' }}>{p.party_name}</td>
                  <td><span className="pill pill-cyan" style={{ fontSize: '10px' }}>{p.payment_mode || 'Bank'}</span></td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.reference_no || '—'}</td>
                  <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: p.party_type === 'CUSTOMER' ? 'var(--emerald)' : 'var(--amber)' }}>
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
              ))}
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

// ── MAIN ACCOUNTS PAGE ────────────────────────────────────────────────────────
const TABS = [
  { id: 'customer-ledger', label: 'Customer Ledger', icon: <Users size={14} /> },
  { id: 'supplier-ledger', label: 'Supplier Ledger', icon: <UserCheck size={14} /> },
  { id: 'cash-bank', label: 'Cash & Bank Books', icon: <DollarSign size={14} /> },
  { id: 'outstanding', label: 'Outstanding Summaries', icon: <TrendingUp size={14} /> },
  { id: 'payments', label: 'Payments Register', icon: <CreditCard size={14} /> },
  { id: 'export', label: 'Export / CA Tools', icon: <Download size={14} /> },
];

export default function AccountsPage() {
  const [tab, setTab] = useState('customer-ledger');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentDefaultType, setPaymentDefaultType] = useState('CUSTOMER');
  const [paymentDefaultPartyId, setPaymentDefaultPartyId] = useState('');
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(() => {});
    api.getSuppliers().then(setSuppliers).catch(() => {});
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
          <p>Customer / Supplier ledgers, Cash & Bank books, Outstanding summaries, and CA registers</p>
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
      {tab === 'export' && <ExportPage />}

      {/* Add / Edit Payment Modal */}
      <AddPaymentModal
        isOpen={showPaymentModal}
        initialPayment={editingPayment}
        customers={customers}
        suppliers={suppliers}
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
