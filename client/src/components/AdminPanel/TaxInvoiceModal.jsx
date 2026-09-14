import React, { useState, useEffect } from 'react';
import { Printer, Download, X, FileText, CheckCircle2, AlertCircle, MessageCircle } from 'lucide-react';
import { api } from '../../api';

export default function TaxInvoiceModal({ isOpen, saleId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadingEInv, setDownloadingEInv] = useState(false);
  const [downloadingEWay, setDownloadingEWay] = useState(false);

  useEffect(() => {
    if (isOpen && saleId) {
      loadInvoice();
    }
  }, [isOpen, saleId]);

  async function loadInvoice() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getInvoice(saleId);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load tax invoice.');
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const downloadJson = (obj, filename) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', filename);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleDownloadEInvoice = async () => {
    if (!saleId) return;
    try {
      setDownloadingEInv(true);
      const json = await api.getEInvoiceJson(saleId);
      const filename = `einvoice_${data?.invoice?.invoiceNumber || saleId}.json`;
      downloadJson(json, filename);
    } catch (err) {
      alert('Failed to download E-Invoice JSON: ' + err.message);
    } finally {
      setDownloadingEInv(false);
    }
  };

  const handleDownloadEWayBill = async () => {
    if (!saleId) return;
    try {
      setDownloadingEWay(true);
      const json = await api.getEWayBillJson(saleId);
      const filename = `ewaybill_${data?.invoice?.invoiceNumber || saleId}.json`;
      downloadJson(json, filename);
    } catch (err) {
      alert('Failed to download E-Way Bill JSON: ' + err.message);
    } finally {
      setDownloadingEWay(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!data) return;
    const phone = (cust?.phone || '').replace(/[^0-9]/g, '');
    let msg = `*TAX INVOICE — ANRB*\n`;
    msg += `*Invoice No:* ${inv?.invoiceNumber || ''}\n`;
    msg += `*Date:* ${inv?.date || ''}\n`;
    msg += `*Customer:* ${cust?.name || ''}\n`;
    if (cust?.gstNumber) msg += `*GSTIN:* ${cust.gstNumber}\n`;
    msg += `---------------------------\n`;
    items.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.productName} - ${item.quantity} ${item.unit || 'KG'} @ ₹${item.ratePerKg} = ₹${Number(item.taxableAmount || 0).toLocaleString('en-IN')}\n`;
    });
    msg += `---------------------------\n`;
    msg += `*Taxable Value:* ₹${Number(inv?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    const gstTotal = Number(inv?.cgst || 0) + Number(inv?.sgst || 0) + Number(inv?.igst || 0);
    msg += `*Total GST:* ₹${gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    msg += `*Grand Total:* ₹${Number(inv?.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    if (comp?.bankName) {
      msg += `\n*Bank Details:*\nBank: ${comp.bankName}\nA/C: ${comp.accountNumber}\nIFSC: ${comp.ifscCode}\n`;
    }
    msg += `\n_Thank you for your business!_`;
    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/91${phone.slice(-10)}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  const inv = data?.invoice;
  const comp = data?.company;
  const cust = data?.customer;
  const items = data?.items || [];

  return (
    <div className="invoice-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(7, 11, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', overflowY: 'auto'
    }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .invoice-printable-area, .invoice-printable-area * {
            visibility: visible !important;
          }
          .invoice-modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            display: block !important;
          }
          .invoice-actions-bar {
            display: none !important;
          }
          .invoice-paper {
            box-shadow: none !important;
            border: 1px solid #111 !important;
            border-radius: 0 !important;
            padding: 20px !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: '860px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Actions Bar */}
        <div className="invoice-actions-bar" style={{
          background: '#0f172a',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderTopLeftRadius: '14px', borderTopRightRadius: '14px',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: '700', fontSize: '15px' }}>
            <FileText size={18} />
            <span>Tax Invoice: {inv?.invoiceNumber || 'Loading...'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              disabled={loading || !data}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff', border: 'none', borderRadius: '8px',
                padding: '8px 14px', fontSize: '12.5px', fontWeight: '700',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(2,132,199,0.3)'
              }}
            >
              <Printer size={15} />
              Print / Save PDF
            </button>

            <button
              onClick={handleDownloadEInvoice}
              disabled={loading || downloadingEInv || !data}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(16, 185, 129, 0.15)', color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px',
                padding: '8px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              <Download size={14} />
              {downloadingEInv ? 'Downloading...' : 'E-Invoice JSON'}
            </button>

            <button
              onClick={handleDownloadEWayBill}
              disabled={loading || downloadingEWay || !data}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px',
                padding: '8px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              <Download size={14} />
              {downloadingEWay ? 'Downloading...' : 'E-Way Bill JSON'}
            </button>

            <button
              onClick={handleWhatsAppShare}
              disabled={loading || !data}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(37, 211, 102, 0.15)', color: '#25D366',
                border: '1px solid rgba(37, 211, 102, 0.3)', borderRadius: '8px',
                padding: '8px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              <MessageCircle size={14} />
              WhatsApp Bill
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)', color: '#94a3b8',
                border: 'none', borderRadius: '8px', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Paper Body */}
        <div style={{
          background: '#ffffff',
          color: '#0f172a',
          overflowY: 'auto',
          borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px',
          padding: '30px 36px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              Loading tax invoice details...
            </div>
          ) : error ? (
            <div style={{
              background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c',
              padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : data ? (
            <div className="invoice-printable-area" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {/* Header Title */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#0284c7' }}>
                  Tax Invoice
                </span>
                <h1 style={{ margin: '4px 0 2px', fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                  {comp?.companyName || comp?.company_name}
                </h1>
                <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                  {comp?.address || comp?.company_address}<br />
                  <strong>GSTIN:</strong> {comp?.gstNumber || comp?.company_gstin} | <strong>State:</strong> {comp?.state || comp?.company_state} (Code: {comp?.stateCode || comp?.company_state_code}) | <strong>Phone:</strong> {comp?.phone || comp?.company_phone}
                </p>
              </div>

              {/* Invoice Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '11.5px', background: '#f8fafc' }}>
                <div>
                  <div style={{ marginBottom: '4px' }}><strong>Invoice Number:</strong> <span style={{ fontWeight: '800', color: '#0284c7' }}>{inv?.invoiceNumber}</span></div>
                  <div style={{ marginBottom: '4px' }}><strong>Date:</strong> {inv?.date}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Sale Code:</strong> {inv?.saleCode}</div>
                  <div><strong>Payment Mode:</strong> {inv?.paymentType}</div>
                </div>
                <div>
                  <div style={{ marginBottom: '4px' }}><strong>State Code (Place of Supply):</strong> {inv?.stateCode || cust?.stateCode || comp?.stateCode || '24'}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Reverse Charge:</strong> {inv?.reverseCharge || 'No'}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Sales Type:</strong> {inv?.salesType || 'GST'}</div>
                  <div><strong>Prepared By:</strong> {inv?.managerName || 'Admin'}</div>
                </div>
              </div>

              {/* Buyer & Consignee: BILLED TO & SHIPPED TO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '11.5px' }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                    Details of Receiver | Billed To
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
                    {cust?.name}
                  </div>
                  <div style={{ color: '#475569', lineHeight: 1.4 }}>
                    <div><strong>Address:</strong> {inv?.billingAddress && inv.billingAddress !== '—' ? inv.billingAddress : (cust?.billingAddress && cust.billingAddress !== '—' ? cust.billingAddress : (cust?.address || '—'))}</div>
                    <div><strong>City / Pincode:</strong> {cust?.city || '—'} {cust?.pincode ? `(${cust.pincode})` : ''}</div>
                    <div><strong>GSTIN / UIN:</strong> <span style={{ fontWeight: '700', color: '#0f172a' }}>{inv?.customerGstin && inv.customerGstin !== 'Unregistered' ? inv.customerGstin : (cust?.gstin || 'Unregistered')}</span></div>
                    <div><strong>State:</strong> {cust?.state || '—'} (Code: {inv?.stateCode || cust?.stateCode || '24'})</div>
                    {cust?.phone && cust.phone !== '—' && <div><strong>Contact:</strong> {cust.phone}</div>}
                  </div>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                    Details of Consignee | Shipped To
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
                    {inv?.shippingName || cust?.name}
                  </div>
                  <div style={{ color: '#475569', lineHeight: 1.4 }}>
                    <div><strong>Address:</strong> {inv?.shippingAddress && inv.shippingAddress !== '—' ? inv.shippingAddress : (cust?.shippingAddress && cust.shippingAddress !== '—' ? cust.shippingAddress : (inv?.billingAddress || cust?.address || '—'))}</div>
                    <div><strong>City / Pincode:</strong> {cust?.city || '—'} {cust?.pincode ? `(${cust.pincode})` : ''}</div>
                    <div><strong>State:</strong> {cust?.state || '—'} (Code: {inv?.stateCode || cust?.stateCode || '24'})</div>
                    {cust?.phone && cust.phone !== '—' && <div><strong>Contact:</strong> {cust.phone}</div>}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#fff' }}>
                    <th style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #0f172a', width: '32px' }}>#</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', border: '1px solid #0f172a' }}>Description of Goods</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #0f172a', width: '60px' }}>HSN/SAC</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', border: '1px solid #0f172a', width: '65px' }}>Qty</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', border: '1px solid #0f172a', width: '65px' }}>Rate (₹)</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', border: '1px solid #0f172a', width: '80px' }}>Taxable (₹)</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #0f172a', width: '50px' }}>GST %</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', border: '1px solid #0f172a', width: '85px' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: '600' }}>
                        {item.product_name || 'Tarpaulin / Finished Goods'}
                        {item.size && <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>({item.size})</span>}
                        {item.gsm && <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>{item.gsm} GSM</span>}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #cbd5e1' }}>{item.hsn_code || '3926'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #cbd5e1', fontWeight: '700' }}>
                        {item.quantity} {item.unit || 'KG'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #cbd5e1' }}>
                        ₹{Number(item.rate).toFixed(2)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #cbd5e1' }}>
                        ₹{Number(item.taxable_amount || item.taxableAmount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                        {item.gst_percent || 0}%
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #cbd5e1', fontWeight: '800' }}>
                        ₹{Number(item.total_amount || item.totalAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Tax Breakup & Grand Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', fontSize: '11px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Bank Account Details
                  </div>
                  <div><strong>Bank:</strong> {comp?.bankName || comp?.bank_name}</div>
                  <div><strong>A/C No:</strong> {comp?.bankAccountNo || comp?.bank_account_no}</div>
                  <div><strong>IFSC:</strong> {comp?.bankIfsc || comp?.bank_ifsc}</div>
                  <div><strong>Branch:</strong> {comp?.bankBranch || comp?.bank_branch}</div>
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                    <strong>Amount in Words:</strong><br />
                    <span style={{ fontStyle: 'italic', fontWeight: '700', color: '#0f172a' }}>{data?.amountInWords}</span>
                  </div>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: '#64748b' }}>Taxable Amount:</span>
                    <strong style={{ fontFamily: 'monospace' }}>₹{Number(inv?.taxableAmount || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: '#64748b' }}>CGST:</span>
                    <strong style={{ fontFamily: 'monospace' }}>₹{Number(inv?.cgstAmount || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: '#64748b' }}>SGST:</span>
                    <strong style={{ fontFamily: 'monospace' }}>₹{Number(inv?.sgstAmount || 0).toFixed(2)}</strong>
                  </div>
                  {Number(inv?.igstAmount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ color: '#64748b' }}>IGST:</span>
                      <strong style={{ fontFamily: 'monospace' }}>₹{Number(inv?.igstAmount).toFixed(2)}</strong>
                    </div>
                  )}
                  {Number(inv?.discountAmount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#059669' }}>
                      <span>Discount:</span>
                      <strong style={{ fontFamily: 'monospace' }}>-₹{Number(inv?.discountAmount).toFixed(2)}</strong>
                    </div>
                  )}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderTop: '2px solid #0f172a', marginTop: '6px', paddingTop: '6px',
                    fontSize: '13px', fontWeight: '900', color: '#0284c7'
                  }}>
                    <span>Grand Total:</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{Number(inv?.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Terms & Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', borderTop: '1px solid #cbd5e1', paddingTop: '12px', fontSize: '10px', color: '#475569' }}>
                <div>
                  <strong>Terms & Conditions:</strong>
                  {inv?.termsConditions ? (
                    <div style={{ margin: '4px 0 0', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                      {inv.termsConditions}
                    </div>
                  ) : (
                    <ol style={{ margin: '4px 0 0', paddingLeft: '16px', lineHeight: 1.3 }}>
                      <li>Goods once sold will not be taken back or exchanged.</li>
                      <li>Payment terms: Subject to realization of Cheque / RTGS.</li>
                      <li>Subject to local jurisdiction only.</li>
                    </ol>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: '800', color: '#0f172a' }}>For {comp?.companyName || comp?.company_name}</div>
                  <div style={{ marginTop: '36px', borderTop: '1px solid #94a3b8', display: 'inline-block', paddingTop: '4px' }}>
                    Authorized Signatory
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
