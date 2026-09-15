import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, Search } from 'lucide-react';
import { api } from '../../api';

// ─── Searchable Select Dropdown (Portaled to prevent table clipping) ──────────
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  required = false,
  allowCustom = false,
  style = {},
  inputStyle = {}
}) {
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
        width: Math.max(rect.width, 160)
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
  const displayLabel = matchedOpt ? matchedOpt.label : (allowCustom ? (value || '') : '');

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    updateCoords();
    if (allowCustom) {
      onChange(val);
    }
  };

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
          onChange={handleInputChange}
          onFocus={() => { setOpen(true); setQuery(''); updateCoords(); }}
          placeholder={placeholder}
          required={required && !value}
          className="form-input"
          style={{ paddingRight: '28px', fontSize: '12px', padding: '6px 28px 6px 8px', ...inputStyle }}
        />
        <ChevronDown
          size={13}
          color="var(--text-dim)"
          style={{
            position: 'absolute', right: '8px', top: '50%',
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
          {filtered.length === 0 && allowCustom && query && (
            <div
              onMouseDown={() => handleSelect(query)}
              style={{
                padding: '8px 10px', fontSize: '12px', color: 'var(--cyan, #38bdf8)',
                cursor: 'pointer', fontStyle: 'italic', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))'
              }}
            >
              ✚ Use "{query}"
            </div>
          )}
          {filtered.length === 0 && (!allowCustom || !query) && (
            <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
              No matches found
            </div>
          )}
          {filtered.map(opt => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(String(opt.value))}
              style={{
                padding: '7px 10px', cursor: 'pointer', fontSize: '12px',
                color: String(opt.value) === String(value) ? 'var(--cyan, #38bdf8)' : 'var(--text-main, #f8fafc)',
                background: String(opt.value) === String(value) ? 'rgba(56,189,248,0.12)' : 'transparent',
                borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = String(opt.value) === String(value) ? 'rgba(56,189,248,0.12)' : 'transparent'}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function PurchaseEntryModal({ isOpen, onClose, onSuccess, managerProfile, initialPurchase = null }) {
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Invoice Header States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseType, setPurchaseType] = useState('GST'); // 'GST' or 'NON_GST'
  const [paymentMode, setPaymentMode] = useState('Credit'); // 'Credit', 'Cash', 'Bank'
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [remarks, setRemarks] = useState('');
  const [taxModeOverride, setTaxModeOverride] = useState(null); // null = auto, 'INTER', or 'INTRA'

  // EL / Extra Charges (Freight, Loading, etc.)
  const [elCharges, setElCharges] = useState([]);

  // Multi-Item Lines
  // item: { id, rawMaterialId, quantity, unit, rate, discount, hsnCode, gstPercent }
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadMasters();
      setError('');
    }
  }, [isOpen, initialPurchase]);

  async function loadMasters() {
    setLoading(true);
    try {
      const [supps, rms] = await Promise.all([
        api.getSuppliers(),
        api.getRawMaterials()
      ]);
      const activeSupps = (supps || []).filter(s => s.status === 'active');
      const activeRMs = (rms || []).filter(r => r.status === 'active');
      setSuppliers(activeSupps);
      setRawMaterials(activeRMs);

      if (initialPurchase) {
        // Edit Mode
        setDate(initialPurchase.date || new Date().toISOString().split('T')[0]);
        setSupplierId(String(initialPurchase.supplier_id || ''));
        setPurchaseType(initialPurchase.purchase_type || 'GST');
        setPaymentMode(initialPurchase.payment_mode || 'Credit');
        setInvoiceNumber(initialPurchase.invoice_number || '');
        setDiscountAmount(String(initialPurchase.discount_amount || ''));
        setOtherCharges(String(initialPurchase.other_charges || ''));
        setRoundOff(String(initialPurchase.round_off || ''));
        setRemarks(initialPurchase.remarks || '');
        setTaxModeOverride(
          parseFloat(initialPurchase.igst_amount || 0) > 0 ? 'INTER' :
          (parseFloat(initialPurchase.cgst_amount || 0) > 0 ? 'INTRA' : null)
        );

        let parsedEl = [];
        try {
          parsedEl = typeof initialPurchase.el_charges === 'string'
            ? JSON.parse(initialPurchase.el_charges)
            : (Array.isArray(initialPurchase.el_charges) ? initialPurchase.el_charges : []);
        } catch (e) {
          parsedEl = [];
        }
        setElCharges(parsedEl.map((c, idx) => ({
          id: c.id || Date.now() + idx,
          label: c.label || 'Freight Charges',
          amount: String(c.amount !== undefined ? c.amount : ''),
          gstPercent: String(c.gstPercent !== undefined ? c.gstPercent : (initialPurchase.purchase_type === 'NON_GST' ? 0 : 18))
        })));

        if (initialPurchase.items && initialPurchase.items.length > 0) {
          setItems(initialPurchase.items.map((it, idx) => ({
            id: it.id || idx + 1,
            rawMaterialId: String(it.raw_material_id),
            quantity: String(it.quantity || it.quantity_kg || ''),
            unit: it.unit || 'KG',
            rate: String(it.rate || it.rate_per_kg || ''),
            discount: String(it.discount || 0),
            hsnCode: it.hsn_code || '',
            gstPercent: String(it.gst_percent !== undefined ? it.gst_percent : 18)
          })));
        } else {
          setItems([{
            id: Date.now(),
            rawMaterialId: String(initialPurchase.raw_material_id || activeRMs[0]?.id || ''),
            quantity: String(initialPurchase.quantity_kg || ''),
            unit: 'KG',
            rate: String(initialPurchase.rate_per_kg || ''),
            discount: '0',
            hsnCode: '3901',
            gstPercent: String(initialPurchase.gst_percent || 18)
          }]);
        }
      } else {
        // New Mode
        setDate(new Date().toISOString().split('T')[0]);
        setSupplierId(activeSupps.length > 0 ? String(activeSupps[0].id) : '');
        setPurchaseType('GST');
        setPaymentMode('Credit');
        setInvoiceNumber('');
        setDiscountAmount('');
        setOtherCharges('');
        setRoundOff('');
        setRemarks('');
        setTaxModeOverride(null);
        setElCharges([]);

        if (activeRMs.length > 0) {
          const first = activeRMs[0];
          setItems([{
            id: Date.now(),
            rawMaterialId: String(first.id),
            quantity: '',
            unit: first.unit || 'KG',
            rate: '',
            discount: '0',
            hsnCode: first.hsn_code || '3901',
            gstPercent: String(first.gst_percent || 18)
          }]);
        } else {
          setItems([]);
        }
      }
    } catch (err) {
      setError('Failed to load form masters: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Add Item Line
  const handleAddItem = () => {
    const first = rawMaterials[0];
    setItems([
      ...items,
      {
        id: Date.now() + Math.random(),
        rawMaterialId: first ? String(first.id) : '',
        quantity: '',
        unit: first ? (first.unit || 'KG') : 'KG',
        rate: '',
        discount: '0',
        hsnCode: first ? (first.hsn_code || '3901') : '3901',
        gstPercent: purchaseType === 'GST' ? String(first?.gst_percent || 18) : '0'
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
      if (field === 'rawMaterialId') {
        const rm = rawMaterials.find(r => String(r.id) === String(value));
        if (rm) {
          updated.unit = rm.unit || 'KG';
          updated.hsnCode = rm.hsn_code || '3901';
          if (purchaseType === 'GST') {
            updated.gstPercent = String(rm.gst_percent !== undefined ? rm.gst_percent : 18);
          } else {
            updated.gstPercent = '0';
          }
        }
      }
      return updated;
    }));
  };

  // Update GST rates when purchaseType switches
  const handlePurchaseTypeChange = (newType) => {
    setPurchaseType(newType);
    setItems(items.map(it => {
      if (newType === 'NON_GST') {
        return { ...it, gstPercent: '0' };
      } else {
        const rm = rawMaterials.find(r => String(r.id) === String(it.rawMaterialId));
        return { ...it, gstPercent: String(rm?.gst_percent || 18) };
      }
    }));
    setElCharges(elCharges.map(c => ({
      ...c,
      gstPercent: newType === 'NON_GST' ? '0' : (c.gstPercent === '0' ? '18' : c.gstPercent)
    })));
  };

  // Helper to detect Interstate supplier from GSTIN state code or state name
  const detectIsInterState = (supp) => {
    if (!supp) return false;
    const cleanGstin = String(supp.gst_number || '').trim();
    if (cleanGstin.length >= 2 && /^\d{2}/.test(cleanGstin)) {
      return cleanGstin.substring(0, 2) !== '24';
    }
    if (supp.state && supp.state.trim()) {
      return supp.state.trim().toLowerCase() !== 'gujarat';
    }
    return false;
  };

  // Calculations
  const isGST = (purchaseType === 'GST');
  const selectedSupplier = suppliers.find(s => String(s.id) === String(supplierId));
  const autoIsInterState = detectIsInterState(selectedSupplier);
  const isInterState = isGST && (taxModeOverride !== null ? (taxModeOverride === 'INTER') : autoIsInterState);

  let totalItemTaxable = 0;
  let totalItemGst = 0;

  const calculatedLines = items.map(it => {
    const q = parseFloat(it.quantity) || 0;
    const r = parseFloat(it.rate) || 0;
    const disc = parseFloat(it.discount) || 0;
    const taxable = Math.max(0, (q * r) - disc);
    const gstPct = isGST ? (parseFloat(it.gstPercent) || 0) : 0;
    const gstAmt = taxable * (gstPct / 100);
    const lineTotal = taxable + gstAmt;

    totalItemTaxable += taxable;
    totalItemGst += gstAmt;

    return {
      ...it,
      taxable,
      gstAmt,
      lineTotal
    };
  });

  // Calculate Extra Charges with GST
  let totalChargeTaxable = 0;
  let totalChargeGst = 0;

  const calculatedCharges = elCharges.map(c => {
    const amt = parseFloat(c.amount) || 0;
    const gstPct = isGST ? (parseFloat(c.gstPercent !== undefined ? c.gstPercent : 18) || 0) : 0;
    const gstAmt = amt * (gstPct / 100);
    totalChargeTaxable += amt;
    totalChargeGst += gstAmt;
    return {
      ...c,
      taxable: amt,
      gstPct,
      gstAmt,
      total: amt + gstAmt
    };
  });

  const totalTaxable = totalItemTaxable + totalChargeTaxable;
  const totalGst = totalItemGst + totalChargeGst;

  const billDiscount = parseFloat(discountAmount) || 0;
  const billOther = parseFloat(otherCharges) || 0;
  const billRound = parseFloat(roundOff) || 0;

  const grandTotal = Math.max(0, totalTaxable + totalGst + billOther - billDiscount + billRound);

  // EL Charges helpers
  const handleAddElCharge = () => {
    setElCharges([
      ...elCharges,
      {
        id: Date.now() + Math.random(),
        label: 'Freight Charges',
        amount: '',
        gstPercent: isGST ? '18' : '0'
      }
    ]);
  };
  const handleRemoveElCharge = (id) => setElCharges(elCharges.filter(c => c.id !== id));
  const handleElChargeChange = (id, field, val) => setElCharges(elCharges.map(c => c.id === id ? { ...c, [field]: val } : c));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supplierId) {
      setError('Please select a Supplier.');
      return;
    }
    if (items.length === 0) {
      setError('At least one purchase item is required.');
      return;
    }

    for (const it of items) {
      const q = parseFloat(it.quantity) || 0;
      const r = parseFloat(it.rate) || 0;
      if (!it.rawMaterialId || q <= 0 || r <= 0) {
        const rm = rawMaterials.find(rItem => String(rItem.id) === String(it.rawMaterialId));
        setError(`Please enter a valid Quantity (>0) and Rate (>0) for item "${rm ? rm.name : 'Selected Raw Material'}".`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        date,
        supplierId: parseInt(supplierId),
        purchaseType,
        paymentMode,
        invoiceNumber: invoiceNumber.trim(),
        discountAmount: billDiscount,
        otherCharges: billOther,
        roundOff: billRound,
        isInterState,
        elCharges: calculatedCharges.filter(c => c.label && c.taxable > 0).map(c => ({
          id: c.id,
          label: c.label.trim(),
          amount: c.taxable,
          gstPercent: isGST ? (parseFloat(c.gstPercent) || 0) : 0,
          taxableAmount: c.taxable,
          gstAmount: c.gstAmt,
          totalAmount: c.total
        })),
        remarks,
        managerName: managerProfile?.name || 'Admin',
        managerId: managerProfile?.id || null,
        deviceId: managerProfile?.deviceId || localStorage.getItem('tripal_device_id') || '',
        items: items.map(it => ({
          rawMaterialId: parseInt(it.rawMaterialId),
          quantity: parseFloat(it.quantity),
          unit: it.unit || 'KG',
          rate: parseFloat(it.rate),
          discount: parseFloat(it.discount) || 0,
          hsnCode: it.hsnCode || '3901',
          gstPercent: isGST ? (parseFloat(it.gstPercent) || 0) : 0
        }))
      };

      if (initialPurchase && initialPurchase.id) {
        await api.updatePurchase(initialPurchase.id, payload);
      } else {
        await api.createPurchase(payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save purchase invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
      <div className="modal-content" style={{ maxWidth: '960px', width: '95%' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.15))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px' }}>
                {initialPurchase ? 'Edit Multi-Item Raw Material Purchase' : 'New Multi-Item Raw Material Purchase'}
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Entered By: <strong style={{ color: 'var(--cyan)' }}>{managerProfile?.name || 'Admin'}</strong>
                {initialPurchase?.purchase_code ? ` | Invoice: ${initialPurchase.purchase_code}` : ''}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px' }}>
            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="animate-spin" /> Loading masters...
              </div>
            ) : (
              <>
                {/* INVOICE HEADER DETAILS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px', background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <label className="form-label">Purchase Date *</label>
                    <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>

                  <div>
                    <label className="form-label">Supplier *</label>
                    <SearchableSelect
                      value={supplierId}
                      onChange={v => {
                        setSupplierId(v);
                        setTaxModeOverride(null);
                      }}
                      options={[
                        { value: '', label: 'Select Supplier...' },
                        ...suppliers.map(s => {
                          const isInter = detectIsInterState(s);
                          return {
                            value: String(s.id),
                            label: `${s.name} (${s.gst_number || 'URP'})${isInter ? ' ✈ [IGST]' : ' 📍 [CGST+SGST]'}`
                          };
                        })
                      ]}
                      placeholder="Search supplier..."
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Supplier Bill / Invoice #</label>
                    <input type="text" className="form-input" placeholder="e.g. INV-1001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                  </div>

                  <div>
                    <label className="form-label">Purchase Type *</label>
                    <select className="form-select" value={purchaseType} onChange={e => handlePurchaseTypeChange(e.target.value)}>
                      <option value="GST">GST Purchase (Taxable)</option>
                      <option value="NON_GST">Non-GST Purchase (0% Tax)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Payment Mode *</label>
                    <select className="form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                      <option value="Credit">Credit (On Account)</option>
                      <option value="Bank">Bank Transfer / UPI / Cheque</option>
                      <option value="Cash">Cash in Hand</option>
                    </select>
                  </div>
                </div>

                {/* PURCHASE ITEMS LINE BUILDER */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Raw Material Items</span>
                      <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '10px' }}>
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </span>
                    </h4>
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItem} style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)' }}>
                      <Plus size={13} /> Add Raw Material Line
                    </button>
                  </div>

                  <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table className="custom-table" style={{ fontSize: '12px', minWidth: '820px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                          <th style={{ width: '28%' }}>Raw Material Item *</th>
                          <th style={{ width: '13%' }}>Quantity *</th>
                          <th style={{ width: '10%' }}>Unit</th>
                          <th style={{ width: '14%' }}>Rate ₹ *</th>
                          {isGST && <th style={{ width: '10%' }}>GST %</th>}
                          <th style={{ width: '13%', textAlign: 'right' }}>Taxable ₹</th>
                          <th style={{ width: '14%', textAlign: 'right' }}>Line Total ₹</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedLines.map((it, idx) => {
                          const rm = rawMaterials.find(r => String(r.id) === String(it.rawMaterialId));
                          return (
                            <tr key={it.id}>
                               <td>
                                <SearchableSelect
                                  value={it.rawMaterialId}
                                  onChange={v => handleItemChange(it.id, 'rawMaterialId', v)}
                                  options={[
                                    { value: '', label: 'Select Item...' },
                                    ...rawMaterials.map(r => ({ value: String(r.id), label: `${r.name} [${r.unit}]` }))
                                  ]}
                                  placeholder="Search raw material..."
                                  required
                                />
                                {rm?.hsn_code && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                    HSN: {rm.hsn_code} | Cat: {rm.category}
                                  </div>
                                )}
                               </td>

                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  placeholder="e.g. 100"
                                  step="any"
                                  min="0"
                                  value={it.quantity}
                                  onChange={e => handleItemChange(it.id, 'quantity', e.target.value)}
                                  required
                                />
                              </td>

                              <td>
                                <span className={`pill ${it.unit === 'PCS' ? 'pill-amber' : 'pill-cyan'}`} style={{ fontWeight: '700', fontSize: '11px' }}>
                                  {it.unit}
                                </span>
                              </td>

                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  placeholder="Rate/unit"
                                  step="any"
                                  min="0"
                                  value={it.rate}
                                  onChange={e => handleItemChange(it.id, 'rate', e.target.value)}
                                  required
                                />
                              </td>

                              {isGST && (
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
                              )}

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

                {/* SUMMARY / TOTALS BAR */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Remarks / Note</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional notes, truck #, freight details..."
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />

                    {/* EL / Extra Charges Section */}
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className="form-label" style={{ margin: 0, color: 'var(--amber)', fontWeight: '700' }}>
                          ⚡ EL / Extra Charges
                        </label>
                        <button
                          type="button"
                          onClick={handleAddElCharge}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                            borderRadius: '6px', padding: '3px 8px', color: 'var(--amber)',
                            fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                          }}
                        >
                          <Plus size={11} /> Add Charge
                        </button>
                      </div>

                      {elCharges.length === 0 && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                          No extra charges added. Click "Add Charge" for Freight, Loading, etc.
                        </div>
                      )}

                      {elCharges.map((c, idx) => {
                        const amt = parseFloat(c.amount) || 0;
                        const gstP = isGST ? (parseFloat(c.gstPercent !== undefined ? c.gstPercent : 18) || 0) : 0;
                        const taxPart = amt * (gstP / 100);
                        return (
                          <div key={c.id} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <SearchableSelect
                              value={c.label}
                              onChange={v => handleElChargeChange(c.id, 'label', v)}
                              options={[
                                { value: 'Freight Charges', label: 'Freight Charges' },
                                { value: 'Loading Charges', label: 'Loading Charges' },
                                { value: 'Unloading Charges', label: 'Unloading Charges' },
                                { value: 'Transport Charges', label: 'Transport Charges' },
                                { value: 'Packing Charges', label: 'Packing Charges' },
                                { value: 'Handling Charges', label: 'Handling Charges' },
                                { value: 'Insurance Charges', label: 'Insurance Charges' },
                                { value: 'Other Charges', label: 'Other Charges' },
                              ]}
                              placeholder="Charge name (e.g. Freight)..."
                              allowCustom={true}
                              style={{ flex: '2 1 140px' }}
                            />
                            <input
                              type="number"
                              className="form-input"
                              style={{ flex: '1 1 80px', padding: '6px 8px', fontSize: '12px' }}
                              placeholder="Amount ₹"
                              step="any"
                              min="0"
                              value={c.amount}
                              onChange={e => handleElChargeChange(c.id, 'amount', e.target.value)}
                            />
                            {isGST && (
                              <select
                                className="form-select"
                                style={{ width: '80px', padding: '6px 4px', fontSize: '11px', flexShrink: 0 }}
                                value={c.gstPercent !== undefined ? c.gstPercent : '18'}
                                onChange={e => handleElChargeChange(c.id, 'gstPercent', e.target.value)}
                                title="GST % on charge"
                              >
                                <option value="0">GST 0%</option>
                                <option value="5">GST 5%</option>
                                <option value="12">GST 12%</option>
                                <option value="18">GST 18%</option>
                                <option value="28">GST 28%</option>
                              </select>
                            )}
                            {isGST && amt > 0 && (
                              <div style={{ fontSize: '10.5px', color: 'var(--amber)', whiteSpace: 'nowrap' }}>
                                +Tax ₹{taxPart.toFixed(2)}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveElCharge(c.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                              title="Delete charge"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ fontSize: '12.5px', lineHeight: '1.8' }}>
                    {isGST && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '5px 10px', borderRadius: '6px', background: isInterState ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isInterState ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>GST Mode:</span>
                        <button
                          type="button"
                          onClick={() => setTaxModeOverride(isInterState ? 'INTRA' : 'INTER')}
                          style={{ background: 'none', border: 'none', color: isInterState ? 'var(--rose)' : 'var(--emerald)', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Click to switch between IGST and CGST+SGST"
                        >
                          <span>{isInterState ? '✈ Inter-State (IGST 100%)' : '📍 Intra-State (CGST + SGST 50:50)'}</span>
                          <span style={{ fontSize: '10px', textDecoration: 'underline', opacity: 0.75 }}>[Switch]</span>
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>Items Taxable:</span>
                      <span className="num-mono">₹{totalItemTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    {totalChargeTaxable > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--amber)' }}>
                        <span>Extra Charges Taxable:</span>
                        <span className="num-mono">₹{totalChargeTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', borderTop: totalChargeTaxable > 0 ? '1px dashed var(--border-color)' : 'none', paddingTop: totalChargeTaxable > 0 ? '4px' : '0', marginTop: totalChargeTaxable > 0 ? '4px' : '0' }}>
                      <span>Total Taxable Amount:</span>
                      <strong style={{ color: 'var(--text-main)' }}>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>

                    {isGST && (
                      <>
                        {isInterState ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--rose)' }}>
                            <span>IGST (Items + Charges):</span>
                            <span className="num-mono" style={{ fontWeight: '700' }}>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                              <span>CGST ({(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):</span>
                              <span className="num-mono">₹{(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                              <span>SGST ({(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):</span>
                              <span className="num-mono">₹{(totalGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Round Off */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', gap: '8px', marginTop: '4px' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Round Off (±):</span>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '100px', padding: '3px 8px', fontSize: '12px', textAlign: 'right' }}
                        placeholder="e.g. -0.50"
                        step="any"
                        value={roundOff}
                        onChange={e => setRoundOff(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', marginTop: '8px', paddingTop: '8px', fontSize: '15px', fontWeight: '800' }}>
                      <span style={{ color: 'var(--text-main)' }}>Grand Total:</span>
                      <span style={{ color: 'var(--emerald)' }}>
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || loading}>
              {submitting ? 'Saving Purchase...' : (initialPurchase ? 'Update Purchase' : 'Save Multi-Item Purchase')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
