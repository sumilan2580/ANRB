import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Truck, CheckCircle2, AlertCircle, ShieldAlert, MapPin, FileText, ChevronDown } from 'lucide-react';
import { api } from '../../api';

// ─── Searchable Select Dropdown (Portaled) ─────────────────────────────
function SearchableSelect({ value, onChange, options, placeholder = 'Search...', required = false, style = {}, inputStyle = {} }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 220;
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setCoords({
        top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200)
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      const handleScroll = (e) => {
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
        updateCoords();
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || String(o.value).toLowerCase().includes(query.toLowerCase()))
    : options;

  const matchedOpt = options.find(o => String(o.value) === String(value));
  const displayLabel = matchedOpt ? matchedOpt.label : '';

  const handleSelect = (optVal) => {
    onChange(optVal);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={open ? query : displayLabel}
          onChange={e => { setQuery(e.target.value); setOpen(true); updateCoords(); }}
          onFocus={() => { setOpen(true); setQuery(''); updateCoords(); }}
          placeholder={placeholder}
          required={required && !value}
          className="form-input"
          style={{ paddingRight: '28px', fontSize: '13px', ...inputStyle }}
        />
        <ChevronDown
          size={14}
          color="var(--text-dim)"
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
            transition: 'transform 0.15s ease',
            pointerEvents: 'none'
          }}
        />
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999,
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
            borderRadius: '8px',
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 16px 40px rgba(0,0,0,0.65)'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
              No matches found
            </div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt.value}
                onMouseDown={() => handleSelect(String(opt.value))}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px',
                  color: String(opt.value) === String(value) ? 'var(--cyan, #38bdf8)' : 'var(--text-main, #f8fafc)',
                  background: String(opt.value) === String(value) ? 'rgba(56,189,248,0.12)' : 'transparent',
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = String(opt.value) === String(value) ? 'rgba(56,189,248,0.12)' : 'transparent'}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

const DEFAULT_TERMS = `1. Goods once sold will not be taken back or exchanged.
2. Payment terms: Subject to realization of Cheque / RTGS.
3. Subject to local jurisdiction only.`;

export default function SalesEntryModal({ isOpen, initialSale, onClose, onSuccess, managerProfile }) {
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [stateCode, setStateCode] = useState('24');
  const [reverseCharge, setReverseCharge] = useState('No');
  const [billingAddress, setBillingAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [sameAsBilled, setSameAsBilled] = useState(true);
  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [termsConditions, setTermsConditions] = useState(DEFAULT_TERMS);

  const [finishedProductId, setFinishedProductId] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [gstPercent, setGstPercent] = useState('18');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [paymentType, setPaymentType] = useState('Credit');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMasters();
      setError('');
      if (initialSale) {
        setDate(initialSale.date || new Date().toISOString().split('T')[0]);
        setCustomerId(String(initialSale.customer_id || ''));
        setStateCode(initialSale.state_code || '24');
        setReverseCharge(initialSale.reverse_charge || 'No');
        setBillingAddress(initialSale.billing_address || '');
        setCustomerGstin(initialSale.customer_gstin || '');
        setShippingName(initialSale.shipping_name || '');
        setShippingAddress(initialSale.shipping_address || '');
        setSameAsBilled(!initialSale.shipping_address || initialSale.shipping_address === initialSale.billing_address);
        setTermsConditions(initialSale.terms_conditions !== undefined && initialSale.terms_conditions !== null ? initialSale.terms_conditions : DEFAULT_TERMS);

        setFinishedProductId(String(initialSale.finished_product_id || initialSale.items?.[0]?.finished_product_id || ''));
        setQuantityKg(String(initialSale.quantity_kg || initialSale.items?.[0]?.quantity || ''));
        setRatePerKg(String(initialSale.rate_per_kg || initialSale.items?.[0]?.rate || ''));
        setGstPercent(String(initialSale.gst_percent || initialSale.items?.[0]?.gst_percent || '18'));
        setInvoiceNumber(initialSale.invoice_number || '');
        setRoundOff(initialSale.round_off !== undefined && initialSale.round_off !== null && Number(initialSale.round_off) !== 0 ? String(initialSale.round_off) : '');
        setPaymentType(initialSale.payment_type || 'Cash');
        setRemarks(initialSale.remarks || '');
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setStateCode('24');
        setReverseCharge('No');
        setBillingAddress('');
        setCustomerGstin('');
        setSameAsBilled(true);
        setShippingName('');
        setShippingAddress('');
        setTermsConditions(DEFAULT_TERMS);

        setQuantityKg('');
        setRatePerKg('');
        setInvoiceNumber('');
        setRoundOff('');
        setPaymentType('Credit');
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
        if (activeCusts.length > 0) {
          const firstC = activeCusts[0];
          setCustomerId(String(firstC.id));
          setStateCode(firstC.state_code || '24');
          setBillingAddress(firstC.billing_address || firstC.address || '');
          setCustomerGstin(firstC.gst_number || '');
          setShippingName(firstC.name || '');
          setShippingAddress(firstC.shipping_address || firstC.billing_address || firstC.address || '');
        } else {
          setCustomerId('');
        }

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

  const handleCustomerChange = (cId) => {
    setCustomerId(cId);
    const c = customers.find(item => String(item.id) === String(cId));
    if (c) {
      setStateCode(c.state_code || '24');
      setBillingAddress(c.billing_address || c.address || '');
      setCustomerGstin(c.gst_number || '');
      setShippingName(c.name || '');
      setShippingAddress(c.shipping_address || c.billing_address || c.address || '');
    }
  };

  const handleFGChange = (id) => {
    setFinishedProductId(id);
    const fg = finishedGoods.find(f => String(f.id) === String(id));
    if (fg) setGstPercent(String(fg.gst_percent || 18));
  };

  // Admin panel: no stock restrictions. Manager: stock rules enforced.
  const isAdmin = managerProfile?.name === 'Admin' || managerProfile?.deviceId === 'admin-portal';

  const selectedFG = finishedGoods.find(f => String(f.id) === String(finishedProductId));
  const currentFGStock = selectedFG ? Number(selectedFG.current_stock_kg || 0) : 0;
  const minStockAlert = selectedFG ? Number(selectedFG.min_stock_alert || 0) : 0;
  const initialQty = initialSale ? Number(initialSale.quantity_kg || initialSale.items?.[0]?.quantity || 0) : 0;
  const availableStock = currentFGStock + initialQty;
  const numQty = parseFloat(quantityKg) || 0;
  const numRate = parseFloat(ratePerKg) || 0;
  const numGst = parseFloat(gstPercent) || 0;
  const taxableAmount = numQty * numRate;
  const gstAmount = (taxableAmount * numGst) / 100;
  const subTotal = taxableAmount + gstAmount;
  const billRound = parseFloat(roundOff) || 0;
  const totalAmount = Math.max(0, subTotal + billRound);

  const handleAutoRoundOff = () => {
    if (subTotal <= 0) return;
    const rounded = Math.round(subTotal);
    const diff = Number((rounded - subTotal).toFixed(2));
    setRoundOff(diff === 0 ? '0.00' : (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)));
  };

  // Stock status flags
  const isNoStock = selectedFG && availableStock <= 0;
  const isLowStock = selectedFG && !isNoStock && minStockAlert > 0 && availableStock <= minStockAlert;
  const isInsufficientStock = numQty > 0 && numQty > availableStock;
  // Only managers are blocked; admin can always proceed
  const isBlockedByStock = !isAdmin && (isNoStock || isInsufficientStock);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerId || !finishedProductId || numQty <= 0 || numRate <= 0) {
      setError('Please select customer, finished product, quantity (>0), and rate (>0).');
      return;
    }

    if (!isAdmin && isNoStock) {
      setError('No stock available for this product. Cannot proceed with sale.');
      return;
    }

    if (!isAdmin && isInsufficientStock) {
      setError('Quantity exceeds available stock.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const selCust = customers.find(c => String(c.id) === String(customerId));
      const finalShipAddr = sameAsBilled ? (billingAddress || selCust?.address || '') : (shippingAddress || billingAddress || '');
      const finalShipName = sameAsBilled ? (selCust?.name || '') : (shippingName || selCust?.name || '');

      const payload = {
        date,
        customerId: parseInt(customerId),
        finishedProductId: parseInt(finishedProductId),
        quantityKg: numQty,
        ratePerKg: numRate,
        gstPercent: numGst,
        roundOff: billRound,
        invoiceNumber: invoiceNumber.trim(),
        stateCode: stateCode.trim() || '24',
        reverseCharge,
        billingAddress: billingAddress.trim() || (selCust?.address || ''),
        shippingAddress: finalShipAddr.trim(),
        shippingName: finalShipName.trim(),
        customerGstin: customerGstin.trim() || (selCust?.gst_number || ''),
        termsConditions: termsConditions.trim(),
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
      setRoundOff('');
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
      <div className="modal-content" style={{ maxWidth: '660px' }}>
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
          <div className="modal-body" style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
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
                {/* Basic Invoice Information */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Sale Date *</label>
                    <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer *</label>
                    <SearchableSelect
                      value={customerId}
                      onChange={v => handleCustomerChange(v)}
                      options={[
                        { value: '', label: 'Select Customer...' },
                        ...customers.map(c => ({ value: String(c.id), label: c.name }))
                      ]}
                      placeholder="Search customer..."
                      required
                    />
                  </div>
                </div>

                {/* State Code & Reverse Charge */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">State Code (Place of Supply) *</label>
                    <input
                      type="text"
                      className="form-input num-mono"
                      placeholder="e.g. 24"
                      value={stateCode}
                      onChange={e => setStateCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reverse Charge</label>
                    <select className="form-select" value={reverseCharge} onChange={e => setReverseCharge(e.target.value)}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>

                {/* Product Selection */}
                <div className="form-group">
                  <label className="form-label">Finished Good Specification *</label>
                  <SearchableSelect
                    value={finishedProductId}
                    onChange={v => handleFGChange(v)}
                    options={[
                      { value: '', label: 'Select Finished Product...' },
                      ...finishedGoods.map(fg => {
                        const fgStock = Number(fg.current_stock_kg || 0);
                        const outOfStock = fgStock <= 0;
                        const fgLow = !outOfStock && fg.min_stock_alert > 0 && fgStock <= fg.min_stock_alert;
                        const stockLabel = outOfStock
                          ? ' — ⛔ No Stock'
                          : fgLow
                            ? ' | ⚠️ Low Stock'
                            : ` | Stock: ${fgStock.toLocaleString()} KG`;
                        return {
                          value: String(fg.id),
                          label: `${fg.product_code}: ${fg.product_name} — ${fg.gsm} GSM, ${fg.width_size}, ${fg.colour} (${fg.grade})${stockLabel}`
                        };
                      })
                    ]}
                    placeholder="Search product code, name, colour, gsm..."
                    required
                  />
                  {selectedFG && (
                    <div style={{ marginTop: '6px' }}>
                      {isNoStock ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--rose)', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', padding: '4px 10px' }}>
                          <AlertCircle size={12} /> ⛔ No Stock Available
                          {isAdmin && <span style={{ fontWeight: '400', opacity: 0.7, marginLeft: '4px' }}>(Admin override — sale can proceed)</span>}
                        </span>
                      ) : isLowStock ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '4px 10px' }}>
                          <AlertCircle size={12} /> ⚠️ Low Stock
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: '600', color: isInsufficientStock ? 'var(--rose)' : 'var(--emerald)' }}>
                          ✓ Available Stock: <strong>{availableStock.toLocaleString()} KG</strong>
                          {isInsufficientStock && ` — Short by ${(numQty - availableStock).toLocaleString()} KG!`}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Qty & Rate */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Quantity Sold (KG) *</label>
                    <input
                      type="number" step="any" className="form-input num-mono"
                      placeholder="e.g. 500" value={quantityKg}
                      onChange={e => setQuantityKg(e.target.value)} required
                      style={!isAdmin && isInsufficientStock ? { borderColor: 'var(--rose)', background: 'rgba(244,63,94,0.05)' } : {}}
                    />
                    {!isAdmin && isInsufficientStock && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--rose)', fontWeight: '600' }}>
                        ⚠️ Quantity exceeds available stock
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate per KG (₹) *</label>
                    <input type="number" step="any" className="form-input num-mono" placeholder="e.g. 145.00" value={ratePerKg} onChange={e => setRatePerKg(e.target.value)} required />
                  </div>
                </div>

                {/* GST & Invoice Number */}
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
                  {numGst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                      <span>Subtotal (Taxable + GST)</span>
                      <span className="num-mono">₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {/* Round Off Input & Auto Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Round Off (±)</span>
                      <button
                        type="button"
                        onClick={handleAutoRoundOff}
                        style={{
                          background: 'rgba(56,189,248,0.15)',
                          border: '1px solid rgba(56,189,248,0.3)',
                          color: '#38bdf8',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Auto calculate nearest integer round off"
                      >
                        Auto Round
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        step="any"
                        className="form-input num-mono"
                        placeholder="e.g. -0.40"
                        value={roundOff}
                        onChange={e => setRoundOff(e.target.value)}
                        style={{ width: '105px', padding: '4px 8px', fontSize: '12.5px', textAlign: 'right' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Invoice Total</span>
                    <span className="num-mono" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--emerald)' }}>
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Mode of Payment & Remarks */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Mode of Payment</label>
                    <select className="form-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="RTGS/NEFT">RTGS/NEFT</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remarks / Note</label>
                    <input type="text" className="form-input" placeholder="Optional note" value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </div>
                </div>

                {/* Billed To & Shipped To Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#38bdf8', marginBottom: '10px' }}>
                    <MapPin size={14} /> Receiver & Consignee Details (Billed To & Shipped To)
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Billed To Address</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Billing address"
                        value={billingAddress}
                        onChange={e => setBillingAddress(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Customer GSTIN / UIN</label>
                      <input
                        type="text"
                        className="form-input num-mono"
                        placeholder="GSTIN (leave blank if unregistered)"
                        value={customerGstin}
                        onChange={e => setCustomerGstin(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ margin: '8px 0 10px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                      <input
                        type="checkbox"
                        checked={sameAsBilled}
                        onChange={e => setSameAsBilled(e.target.checked)}
                      />
                      Shipped To is same as Billed To
                    </label>
                  </div>

                  {!sameAsBilled && (
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Shipped To Name (Consignee)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Consignee / Party name"
                          value={shippingName}
                          onChange={e => setShippingName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Shipping Address</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Delivery / Shipping destination address"
                          value={shippingAddress}
                          onChange={e => setShippingAddress(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Terms & Conditions Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#f59e0b', marginBottom: '8px' }}>
                    <FileText size={14} /> Terms & Conditions
                  </div>
                  <textarea
                    className="form-input"
                    rows="3"
                    style={{ resize: 'vertical', fontSize: '11.5px', fontFamily: 'inherit', lineHeight: '1.4' }}
                    placeholder="Invoice terms and conditions..."
                    value={termsConditions}
                    onChange={e => setTermsConditions(e.target.value)}
                  />
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
              disabled={submitting || loading || isBlockedByStock || numQty <= 0 || !finishedProductId || !customerId}
              title={isBlockedByStock ? (isNoStock ? 'Stock nahi hai — sale allowed nahi' : 'Quantity exceeds available stock') : ''}
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
