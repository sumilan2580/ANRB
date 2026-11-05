import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Truck, Plus, Trash2, CheckCircle2, AlertCircle, ShieldAlert, MapPin, FileText, ChevronDown } from 'lucide-react';
import { api } from '../../api';

// ─── Indian GST State Code Directory ─────────────────────────────────────────
const GST_STATE_MAP = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory'
};

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
          style={{ paddingRight: '28px', fontSize: '12.5px', ...inputStyle }}
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
                  padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
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
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Invoice Header
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

  // Multi-item Line Items
  // item: { id, finishedProductId, quantityKg, ratePerKg, gstPercent, unit }
  const [items, setItems] = useState([]);
  const [taxModeOverride, setTaxModeOverride] = useState(null); // null = auto, 'INTRA', or 'INTER'

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [paymentType, setPaymentType] = useState('Credit');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMasters();
      setError('');
    }
  }, [isOpen, initialSale]);

  async function loadMasters() {
    setLoading(true);
    try {
      const [custs, fgs, comp] = await Promise.all([
        api.getCustomers(),
        api.getFinishedGoods(),
        api.getCompanySettings ? api.getCompanySettings().catch(err => {
          console.warn('Failed to fetch company settings:', err.message);
          return null;
        }) : Promise.resolve(null)
      ]);
      const activeCusts = (custs || []).filter(c => c.status === 'active');
      const activeFGs = (fgs || []).filter(f => f.status === 'active');
      setCustomers(activeCusts);
      setFinishedGoods(activeFGs);
      setCompanySettings(comp);

      if (initialSale) {
        // Edit Mode
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
        setInvoiceNumber(initialSale.invoice_number || '');
        setRoundOff(initialSale.round_off !== undefined && initialSale.round_off !== null && Number(initialSale.round_off) !== 0 ? String(initialSale.round_off) : '');
        setPaymentType(initialSale.payment_type || 'Credit');
        setRemarks(initialSale.remarks || '');
        setTaxModeOverride(
          parseFloat(initialSale.igst_amount || 0) > 0 ? 'INTER' :
          (parseFloat(initialSale.cgst_amount || 0) > 0 ? 'INTRA' : null)
        );

        if (initialSale.items && initialSale.items.length > 0) {
          setItems(initialSale.items.map((it, idx) => ({
            id: it.id || Date.now() + idx,
            finishedProductId: String(it.finished_product_id || it.finishedProductId || ''),
            quantityKg: String(it.quantity || it.quantity_kg || ''),
            ratePerKg: String(it.rate || it.rate_per_kg || ''),
            gstPercent: String(it.gst_percent !== undefined ? it.gst_percent : (it.gstPercent !== undefined ? it.gstPercent : 18)),
            unit: it.unit || 'KG'
          })));
        } else {
          setItems([{
            id: Date.now(),
            finishedProductId: String(initialSale.finished_product_id || activeFGs[0]?.id || ''),
            quantityKg: String(initialSale.quantity_kg || ''),
            ratePerKg: String(initialSale.rate_per_kg || ''),
            gstPercent: String(initialSale.gst_percent || 18),
            unit: 'KG'
          }]);
        }
      } else {
        // New Sale Mode
        setDate(new Date().toISOString().split('T')[0]);
        setReverseCharge('No');
        setSameAsBilled(true);
        setTermsConditions(DEFAULT_TERMS);
        setInvoiceNumber('');
        setRoundOff('');
        setPaymentType('Credit');
        setRemarks('');
        setTaxModeOverride(null);

        if (activeCusts.length > 0) {
          const firstC = activeCusts[0];
          setCustomerId(String(firstC.id));
          const autoCode = firstC.state_code || (firstC.gst_number && /^\d{2}/.test(firstC.gst_number) ? firstC.gst_number.slice(0, 2) : '24');
          setStateCode(autoCode);
          setBillingAddress(firstC.billing_address || firstC.address || '');
          setCustomerGstin(firstC.gst_number || '');
          setShippingName(firstC.name || '');
          setShippingAddress(firstC.shipping_address || firstC.billing_address || firstC.address || '');
        } else {
          setCustomerId('');
          setStateCode('24');
          setBillingAddress('');
          setCustomerGstin('');
          setShippingName('');
          setShippingAddress('');
        }

        if (activeFGs.length > 0) {
          const firstFG = activeFGs[0];
          setItems([{
            id: Date.now(),
            finishedProductId: String(firstFG.id),
            quantityKg: '',
            ratePerKg: '',
            gstPercent: String(firstFG.gst_percent !== undefined ? firstFG.gst_percent : 18),
            unit: firstFG.unit || 'KG'
          }]);
        } else {
          setItems([{
            id: Date.now(),
            finishedProductId: '',
            quantityKg: '',
            ratePerKg: '',
            gstPercent: '18',
            unit: 'KG'
          }]);
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
      const code = c.state_code || (c.gst_number && /^\d{2}/.test(c.gst_number) ? c.gst_number.slice(0, 2) : '24');
      setStateCode(code);
      setBillingAddress(c.billing_address || c.address || '');
      setCustomerGstin(c.gst_number || '');
      setShippingName(c.name || '');
      setShippingAddress(c.shipping_address || c.billing_address || c.address || '');
      setTaxModeOverride(null); // auto-adapt to customer state
    }
  };

  // Add Item Line
  const handleAddItem = () => {
    const firstFG = finishedGoods[0];
    setItems([
      ...items,
      {
        id: Date.now() + Math.random(),
        finishedProductId: firstFG ? String(firstFG.id) : '',
        quantityKg: '',
        ratePerKg: '',
        gstPercent: String(firstFG?.gst_percent !== undefined ? firstFG.gst_percent : 18),
        unit: firstFG?.unit || 'KG'
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
      if (field === 'finishedProductId') {
        const fg = finishedGoods.find(f => String(f.id) === String(value));
        if (fg) {
          updated.unit = fg.unit || 'KG';
          if (fg.gst_percent !== undefined && fg.gst_percent !== null) {
            updated.gstPercent = String(fg.gst_percent);
          }
        }
      }
      return updated;
    }));
  };

  // State Code & Inter-State GST Logic
  const companyStateCode = String(companySettings?.company_state_code || companySettings?.stateCode || '24').trim();
  const cleanStateCode = String(stateCode || '').trim();
  const stateCodePadded = cleanStateCode.padStart(2, '0');
  const compCodePadded = companyStateCode.padStart(2, '0');

  // Auto detect if supply is Inter-State
  const autoIsInterState = cleanStateCode ? (stateCodePadded !== compCodePadded) : false;
  const isInterState = taxModeOverride !== null ? (taxModeOverride === 'INTER') : autoIsInterState;

  // Admin override: Admin can proceed even if stock is low or 0
  const isAdmin = managerProfile?.name === 'Admin' || managerProfile?.deviceId === 'admin-portal';

  // Calculate lines with stock validation and GST split
  const calculatedLines = items.map(it => {
    const fg = finishedGoods.find(f => String(f.id) === String(it.finishedProductId));
    const currentStock = fg ? Number(fg.current_stock_kg || 0) : 0;
    const minStock = fg ? Number(fg.min_stock_alert || 0) : 0;

    // In edit mode, add back initial quantity of this product
    const initialQty = (initialSale?.items || []).find(oi => String(oi.finished_product_id) === String(it.finishedProductId))?.quantity
      || (String(initialSale?.finished_product_id) === String(it.finishedProductId) ? Number(initialSale?.quantity_kg || 0) : 0);
    const availableStock = currentStock + Number(initialQty || 0);

    const q = parseFloat(it.quantityKg) || 0;
    const r = parseFloat(it.ratePerKg) || 0;
    const taxable = Math.max(0, q * r);
    const gstPct = parseFloat(it.gstPercent) || 0;
    const gstAmt = (taxable * gstPct) / 100;
    const lineTotal = taxable + gstAmt;

    const isNoStock = fg && availableStock <= 0;
    const isLowStock = fg && !isNoStock && minStock > 0 && availableStock <= minStock;
    const isInsufficientStock = q > 0 && q > availableStock;

    return {
      ...it,
      fg,
      availableStock,
      isNoStock,
      isLowStock,
      isInsufficientStock,
      taxable,
      gstPct,
      gstAmt,
      lineTotal
    };
  });

  const totalTaxable = calculatedLines.reduce((acc, l) => acc + l.taxable, 0);
  const totalGst = calculatedLines.reduce((acc, l) => acc + l.gstAmt, 0);

  // GST Split into Output CGST & SGST (Intra-State) or Output IGST (Inter-State)
  const outputCgst = isInterState ? 0 : Number((totalGst / 2).toFixed(2));
  const outputSgst = isInterState ? 0 : Number((totalGst - outputCgst).toFixed(2));
  const outputIgst = isInterState ? Number(totalGst.toFixed(2)) : 0;

  const subTotal = totalTaxable + totalGst;
  const billRound = parseFloat(roundOff) || 0;
  const totalAmount = Math.max(0, subTotal + billRound);

  const handleAutoRoundOff = () => {
    if (subTotal <= 0) return;
    const rounded = Math.round(subTotal);
    const diff = Number((rounded - subTotal).toFixed(2));
    setRoundOff(diff === 0 ? '0.00' : (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)));
  };

  // Check if any line violates stock rules (managers blocked; admins can override)
  const hasNoStockLine = calculatedLines.some(l => l.isNoStock);
  const hasInsufficientStockLine = calculatedLines.some(l => l.isInsufficientStock);
  const isBlockedByStock = !isAdmin && (hasNoStockLine || hasInsufficientStockLine);
  const hasInvalidLines = calculatedLines.length === 0 || calculatedLines.some(l => !l.finishedProductId || (parseFloat(l.quantityKg) || 0) <= 0 || (parseFloat(l.ratePerKg) || 0) <= 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerId) {
      setError('Please select a customer.');
      return;
    }

    if (hasInvalidLines) {
      setError('Please ensure each finished good line has an item, valid quantity (>0), and rate (>0).');
      return;
    }

    if (!isAdmin && hasNoStockLine) {
      setError('One or more selected products have no stock available. Cannot proceed with sale.');
      return;
    }

    if (!isAdmin && hasInsufficientStockLine) {
      setError('One or more quantities exceed available stock.');
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
        stateCode: stateCode.trim() || '24',
        reverseCharge,
        billingAddress: billingAddress.trim() || (selCust?.address || ''),
        shippingAddress: finalShipAddr.trim(),
        shippingName: finalShipName.trim(),
        customerGstin: customerGstin.trim() || (selCust?.gst_number || ''),
        termsConditions: termsConditions.trim(),
        invoiceNumber: invoiceNumber.trim(),
        roundOff: billRound,
        paymentType,
        remarks,
        isInterState,
        managerName: managerProfile?.name || 'Admin',
        managerId: managerProfile?.id || null,
        deviceId: managerProfile?.deviceId || localStorage.getItem('tripal_device_id') || '',
        // Multi-item payload
        items: calculatedLines.map(l => ({
          finishedProductId: parseInt(l.finishedProductId),
          quantity: parseFloat(l.quantityKg),
          quantityKg: parseFloat(l.quantityKg),
          rate: parseFloat(l.ratePerKg),
          ratePerKg: parseFloat(l.ratePerKg),
          gstPercent: parseFloat(l.gstPercent),
          unit: l.unit || l.fg?.unit || 'KG',
          discount: 0,
          gsm: l.fg?.gsm,
          size: l.fg?.width_size,
          hsnCode: l.fg?.hsn_code || '3926'
        })),
        // Legacy fallback fields for backward compatibility
        finishedProductId: parseInt(calculatedLines[0]?.finishedProductId),
        quantityKg: calculatedLines.reduce((acc, l) => acc + (parseFloat(l.quantityKg) || 0), 0),
        ratePerKg: calculatedLines[0]?.ratePerKg ? parseFloat(calculatedLines[0].ratePerKg) : 0,
        gstPercent: calculatedLines[0]?.gstPercent ? parseFloat(calculatedLines[0].gstPercent) : 18
      };

      if (initialSale && initialSale.id) {
        await api.updateSale(initialSale.id, payload);
      } else {
        await api.createSale(payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Error recording sales entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const stateName = GST_STATE_MAP[stateCodePadded] || 'Other / Special Territory';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1000px', width: '95vw' }}>
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
                {initialSale ? 'Modify sale details, multiple item lines, rates and GST breakdown' : 'GST Tax Invoice & Goods Delivery Note (Multi-Item Supported)'}
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
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
                        ...customers.map(c => ({ value: String(c.id), label: `${c.name} ${c.gst_number ? `(${c.gst_number})` : ''}` }))
                      ]}
                      placeholder="Search customer..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State Code (Place of Supply) *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="form-input num-mono"
                        placeholder="e.g. 24"
                        value={stateCode}
                        onChange={e => {
                          setStateCode(e.target.value);
                          setTaxModeOverride(null); // auto re-evaluate on state code change
                        }}
                        required
                        style={{ paddingRight: '120px' }}
                      />
                      <span style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: isInterState ? 'var(--rose)' : 'var(--emerald)',
                        pointerEvents: 'none'
                      }}>
                        {stateName}
                      </span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reverse Charge</label>
                    <select className="form-select" value={reverseCharge} onChange={e => setReverseCharge(e.target.value)}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mode of Payment</label>
                    <select className="form-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                      <option value="Credit">Credit (On Account)</option>
                      <option value="Cash">Cash in Hand</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="RTGS/NEFT">RTGS/NEFT</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Invoice Number</label>
                    <input type="text" className="form-input" placeholder="Leave blank for auto-generate" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                  </div>
                </div>

                {/* GST State Mode Banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  background: isInterState ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${isInterState ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ fontWeight: '800', color: isInterState ? 'var(--rose)' : 'var(--emerald)' }}>
                      {isInterState ? '✈ INTER-STATE SALE' : '📍 INTRA-STATE SALE'}
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>|</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '11.5px' }}>
                      Place of Supply: <strong>Code {stateCodePadded} ({stateName})</strong>
                      {isInterState ? ' → Applicable Tax: Output IGST (100%)' : ' → Applicable Tax: Output CGST (50%) + Output SGST (50%)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaxModeOverride(isInterState ? 'INTRA' : 'INTER')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isInterState ? 'var(--cyan)' : 'var(--amber)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    title="Override tax type if special GST rule applies"
                  >
                    Switch to {isInterState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                  </button>
                </div>

                {/* MULTI-ITEM FINISHED GOODS TABLE */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Finished Goods Items</span>
                      <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 7px', borderRadius: '10px' }}>
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </span>
                    </h4>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleAddItem}
                      style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={13} /> Add Finished Good Line
                    </button>
                  </div>

                  <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table className="custom-table" style={{ fontSize: '12px', minWidth: '860px', width: '100%' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                          <th style={{ width: '38%' }}>Finished Good Specification *</th>
                          <th style={{ width: '13%' }}>Quantity (KG) *</th>
                          <th style={{ width: '14%' }}>Rate / KG ₹ *</th>
                          <th style={{ width: '10%' }}>GST %</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Taxable ₹</th>
                          <th style={{ width: '13%', textAlign: 'right' }}>Line Total ₹</th>
                          <th style={{ width: '36px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedLines.map((it) => {
                          const fgOptions = finishedGoods.map(fg => {
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
                          });

                          return (
                            <tr key={it.id}>
                              <td>
                                <SearchableSelect
                                  value={it.finishedProductId}
                                  onChange={v => handleItemChange(it.id, 'finishedProductId', v)}
                                  options={[
                                    { value: '', label: 'Select Finished Product...' },
                                    ...fgOptions
                                  ]}
                                  placeholder="Search product..."
                                  required
                                />
                                {it.fg && (
                                  <div style={{ marginTop: '4px' }}>
                                    {it.isNoStock ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: '700', color: 'var(--rose)' }}>
                                        <AlertCircle size={11} /> ⛔ No Stock Available
                                        {isAdmin && <span style={{ fontWeight: '400', opacity: 0.8 }}>(Admin override)</span>}
                                      </span>
                                    ) : it.isLowStock ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: '700', color: 'var(--amber)' }}>
                                        <AlertCircle size={11} /> ⚠️ Low Stock: {it.availableStock.toLocaleString()} KG
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '10.5px', fontWeight: '600', color: it.isInsufficientStock ? 'var(--rose)' : 'var(--emerald)' }}>
                                        ✓ Stock: {it.availableStock.toLocaleString()} KG
                                        {it.isInsufficientStock && ` (Short: ${(parseFloat(it.quantityKg || 0) - it.availableStock).toLocaleString()} KG!)`}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  className="form-input num-mono"
                                  style={{
                                    padding: '6px 8px',
                                    fontSize: '12px',
                                    ...(!isAdmin && it.isInsufficientStock ? { borderColor: 'var(--rose)', background: 'rgba(244,63,94,0.06)' } : {})
                                  }}
                                  placeholder="Qty (KG)"
                                  value={it.quantityKg}
                                  onChange={e => handleItemChange(it.id, 'quantityKg', e.target.value)}
                                  required
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  className="form-input num-mono"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  placeholder="Rate ₹"
                                  value={it.ratePerKg}
                                  onChange={e => handleItemChange(it.id, 'ratePerKg', e.target.value)}
                                  required
                                />
                              </td>

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

                {/* GST CALCULATION SUMMARY PANEL */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  margin: '8px 0 16px'
                }}>
                  {/* Taxable Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '700' }}>Taxable Amount</span>
                    <span className="num-mono" style={{ fontWeight: '700', fontSize: '13px' }}>
                      ₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Intra-State Tax Split: Output CGST + Output SGST */}
                  {!isInterState && totalGst > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: 'var(--amber)' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '600' }}>Output CGST (Central Tax 50%)</span>
                        <span className="num-mono">₹{outputCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: 'var(--amber)' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '600' }}>Output SGST (State Tax 50%)</span>
                        <span className="num-mono">₹{outputSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}

                  {/* Inter-State Tax: Output IGST */}
                  {isInterState && totalGst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: 'var(--rose)' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '700' }}>Output IGST (Integrated Tax 100%)</span>
                      <span className="num-mono" style={{ fontWeight: '700' }}>
                        ₹{outputIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {totalGst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                      <span>Subtotal (Taxable + GST)</span>
                      <span className="num-mono">₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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

                  {/* Invoice Grand Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main)' }}>Invoice Total</span>
                    <span className="num-mono" style={{ fontSize: '22px', fontWeight: '900', color: 'var(--emerald)' }}>
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Remarks */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Remarks / Dispatch Note</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Optional notes, transporter name, LR number, etc."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>

                {/* Receiver & Consignee Details (Billed To & Shipped To) */}
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

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-emerald"
              disabled={submitting || loading || isBlockedByStock || hasInvalidLines || !customerId}
              title={isBlockedByStock ? (hasNoStockLine ? 'Product stock unavailable' : 'Quantity exceeds available stock') : ''}
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Saving...' : initialSale ? 'Save Changes' : `Save Sales Entry (${calculatedLines.length} ${calculatedLines.length === 1 ? 'Item' : 'Items'})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}