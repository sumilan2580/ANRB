import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Factory, Truck, ChevronDown, ChevronRight, RefreshCw,
  Filter, Edit2, Trash2, AlertTriangle, Plus, Layers, FileText,
  CheckCircle, XCircle, Clock
} from 'lucide-react';
import { api } from '../../api';
import PurchaseEntryModal from '../ManagerApp/PurchaseEntryModal';
import ProductionEntryModal from '../ManagerApp/ProductionEntryModal';
import SalesEntryModal from '../ManagerApp/SalesEntryModal';
import TaxInvoiceModal from './TaxInvoiceModal';

function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const lines = rows.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Small icon action button
function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        background: 'none',
        border: `1px solid ${color}44`,
        borderRadius: '6px',
        color,
        width: '28px',
        height: '28px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = `${color}44`; }}
    >
      {icon}
    </button>
  );
}

// Confirm Delete Modal
function ConfirmDeleteModal({ isOpen, itemLabel, onClose, onConfirm, loading }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '380px' }}>
        <div className="modal-header">
          <h3 style={{ color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} /> Confirm Delete / Void
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Void transaction <strong style={{ color: 'var(--text-main)' }}>{itemLabel}</strong>?
            <br />
            <span style={{ fontSize: '12px', color: 'var(--amber)' }}>
              Stock ledger and financial accounts will be automatically reversed.
            </span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--rose)', color: '#fff' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Customer Production Order Modal
function AddOrderModal({ isOpen, customers, finishedGoods, onClose, onSuccess }) {
  const [form, setForm] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    customerId: '',
    customerOrderNo: '',
    finishedProductId: '',
    gsm: 120,
    size: '12 FT x 100 M',
    requiredQuantity: 1000,
    unit: 'KG',
    deliveryDate: '',
    remarks: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({
        orderDate: new Date().toISOString().split('T')[0],
        customerId: customers[0]?.id || '',
        customerOrderNo: '',
        finishedProductId: finishedGoods[0]?.id || '',
        gsm: finishedGoods[0]?.gsm || 120,
        size: finishedGoods[0]?.width_size || '12 FT x 100 M',
        requiredQuantity: 1000,
        unit: 'KG',
        deliveryDate: '',
        remarks: ''
      });
      setError('');
    }
  }, [isOpen, customers, finishedGoods]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.createProductionOrder({
        ...form,
        customerId: Number(form.customerId),
        finishedProductId: Number(form.finishedProductId),
        requiredQuantity: Number(form.requiredQuantity),
        gsm: form.gsm ? Number(form.gsm) : null
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create production order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} /> New Customer Production Order
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: 'var(--rose)', background: 'var(--rose-bg)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Order Date *</label>
                <input type="date" className="form-input" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Order / Ref #</label>
                <input type="text" className="form-input" placeholder="e.g. PO-CUST-88" value={form.customerOrderNo} onChange={e => setForm({ ...form, customerOrderNo: e.target.value })} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Customer *</label>
                <select className="form-select" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select Customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.gst_number ? `(${c.gst_number})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Target Finished Good *</label>
                <select className="form-select" value={form.finishedProductId} onChange={e => {
                  const fg = finishedGoods.find(f => String(f.id) === e.target.value);
                  setForm({
                    ...form,
                    finishedProductId: e.target.value,
                    gsm: fg?.gsm || form.gsm,
                    size: fg?.width_size || form.size
                  });
                }} required>
                  <option value="">Select Finished Good…</option>
                  {finishedGoods.map(fg => (
                    <option key={fg.id} value={fg.id}>
                      [${fg.product_code || fg.id}] {(fg.product_name || '').replace(/BENGAL STOCK\s*/i, '').trim() || `${fg.gsm || ''}GSM ${fg.width_size || ''} ${fg.colour || ''}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">GSM</label>
                <input type="number" className="form-input" value={form.gsm} onChange={e => setForm({ ...form, gsm: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Size / Width</label>
                <input type="text" className="form-input" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="e.g. 12 FT x 100 M" />
              </div>
              <div className="form-group">
                <label className="form-label">Target Quantity *</label>
                <input type="number" className="form-input" value={form.requiredQuantity} onChange={e => setForm({ ...form, requiredQuantity: e.target.value })} required min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Expected Delivery Date</label>
                <input type="date" className="form-input" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Remarks / Special Specs</label>
                <input type="text" className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Special export packing, UV additive instructions, etc." />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating Order…' : 'Create Production Order'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Material Consumption Issue Batch Modal (Supports KG & PCS per item)
function AddConsumptionModal({ isOpen, orders, machines, shifts, rawMaterials, onClose, onSuccess }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productionOrderId, setProductionOrderId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([{ rawMaterialId: '', quantity: '', unit: 'KG', batchLot: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setProductionOrderId('');
      setMachineId(machines[0]?.id || '');
      setShiftId(shifts[0]?.id || '');
      setRemarks('');
      const firstRM = rawMaterials[0];
      setItems([{
        rawMaterialId: firstRM?.id || '',
        quantity: '',
        unit: firstRM?.unit || 'KG',
        batchLot: ''
      }]);
      setError('');
    }
  }, [isOpen, machines, shifts, rawMaterials]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const firstRM = rawMaterials[0];
    setItems([...items, {
      rawMaterialId: firstRM?.id || '',
      quantity: '',
      unit: firstRM?.unit || 'KG',
      batchLot: ''
    }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    if (field === 'rawMaterialId') {
      const rm = rawMaterials.find(r => String(r.id) === String(value));
      if (rm && rm.unit) {
        next[index].unit = rm.unit;
      }
    }
    setItems(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (let i = 0; i < items.length; i++) {
      const q = Number(items[i].quantity);
      if (!items[i].rawMaterialId || isNaN(q) || q <= 0) {
        setError(`Please enter a valid raw material and quantity (>0) for item #${i + 1}.`);
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      await api.createConsumptionBatch({
        date,
        productionOrderId: productionOrderId ? Number(productionOrderId) : null,
        machineId: machineId ? Number(machineId) : null,
        shiftId: shiftId ? Number(shiftId) : null,
        status: 'Issued',
        items: items.map(it => ({
          rawMaterialId: Number(it.rawMaterialId),
          quantity: Number(it.quantity),
          unit: it.unit || 'KG',
          batchLot: it.batchLot || null
        })),
        remarks: remarks || ''
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to issue material consumption batch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} /> Issue Material Consumption Batch
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: 'var(--rose)', background: 'var(--rose-bg)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Issue Date *</label>
                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Link Production Order (Optional)</label>
                <select className="form-select" value={productionOrderId} onChange={e => setProductionOrderId(e.target.value)}>
                  <option value="">-- General Issue (No Order) --</option>
                  {orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').map(o => (
                    <option key={o.id} value={o.id}>{o.order_no} — {o.customer_name} ({o.product_name}, {o.required_quantity} {o.unit})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Machine *</label>
                <select className="form-select" value={machineId} onChange={e => setMachineId(e.target.value)} required>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Shift *</label>
                <select className="form-select" value={shiftId} onChange={e => setShiftId(e.target.value)} required>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Items table */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ fontWeight: '700', color: '#38bdf8' }}>Raw Materials to Issue (KG & PCS Supported)</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItem}>
                  <Plus size={12} /> Add Item
                </button>
              </div>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr 2fr 30px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <select className="form-select" value={it.rawMaterialId} onChange={e => handleItemChange(idx, 'rawMaterialId', e.target.value)} required>
                    {rawMaterials.map(rm => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.unit || 'KG'})
                      </option>
                    ))}
                  </select>
                  <input type="number" className="form-input" placeholder="Qty *" value={it.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} required min="0.01" step="any" />
                  <select
                    className="form-select"
                    value={it.unit || 'KG'}
                    onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                    style={{ fontSize: '11px', padding: '6px 4px', textAlign: 'center' }}
                  >
                    <option value="KG">KG</option>
                    <option value="PCS">PCS</option>
                    <option value="METER">Meter</option>
                    <option value="ROLL">Roll</option>
                  </select>
                  <input type="text" className="form-input" placeholder="Lot / Silo #" value={it.batchLot} onChange={e => handleItemChange(idx, 'batchLot', e.target.value)} />
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="form-group full-width" style={{ marginTop: '12px' }}>
              <label className="form-label">Floor Remarks</label>
              <input type="text" className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Line 1 Extruder Batch #1" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Issuing Materials…' : 'Confirm Issue & Deduct Stock'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransactionsPage({ defaultTab = 'orders' }) {
  const [tab, setTab] = useState(defaultTab);
  const [orders, setOrders] = useState([]);
  const [consumptionBatches, setConsumptionBatches] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [productions, setProductions] = useState([]);
  const [sales, setSales] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [managers, setManagers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [txError, setTxError] = useState('');

  // Modals state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);

  // Edit and Link state
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [prodBatchIdToOpen, setProdBatchIdToOpen] = useState(null);
  const [invoiceSaleIdToView, setInvoiceSaleIdToView] = useState(null);

  // Delete & expand state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [expandedConsumption, setExpandedConsumption] = useState(null);
  const [expandedPurchase, setExpandedPurchase] = useState(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [managerFilter, setManagerFilter] = useState('');

  useEffect(() => {
    Promise.all([
      api.getCustomers().catch(() => []),
      api.getFinishedGoods().catch(() => []),
      api.getRawMaterials().catch(() => []),
      api.getMachines().catch(() => []),
      api.getShifts().catch(() => []),
      api.getManagers().catch(() => [])
    ]).then(([c, fg, rm, m, s, mgrs]) => {
      setCustomers(c);
      setFinishedGoods(fg);
      setRawMaterials(rm);
      setMachines(m);
      setShifts(s);
      setManagers(mgrs);
    });
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [tab, dateFrom, dateTo, managerFilter]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (managerFilter) params.append('managerName', managerFilter);
      const queryStr = params.toString();

      if (tab === 'orders') {
        const data = await api.getProductionOrders(queryStr);
        setOrders(data || []);
      } else if (tab === 'consumption') {
        const data = await api.getConsumptionBatches(queryStr);
        setConsumptionBatches(data || []);
      } else if (tab === 'purchases') {
        const data = await api.getPurchases(queryStr);
        setPurchases((data || []).filter(p => !p.is_voided));
      } else if (tab === 'production') {
        const data = await api.getProductions(queryStr);
        setProductions((data || []).filter(p => !p.is_voided));
      } else if (tab === 'sales') {
        const data = await api.getSales(queryStr);
        setSales((data || []).filter(s => !s.is_voided));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.updateProductionOrderStatus(orderId, newStatus);
      showSuccess(`Order status updated to ${newStatus}`);
      loadTransactions();
    } catch (err) {
      setTxError(err.message);
    }
  };

  const handleUpdateConsumptionStatus = async (batchId, newStatus) => {
    try {
      await api.updateConsumptionBatchStatus(batchId, newStatus);
      showSuccess(`Consumption batch status updated to ${newStatus}`);
      loadTransactions();
    } catch (err) {
      setTxError(err.message);
    }
  };

  const handleEditSale = async (s) => {
    try {
      const full = await api.getInvoice(s.id);
      setEditingSale({
        ...s,
        items: full.items || [],
        customer_id: s.customer_id || full.customer?.id,
        finished_product_id: s.finished_product_id || full.items?.[0]?.finished_product_id,
        quantity_kg: s.quantity_kg || full.items?.[0]?.quantity,
        rate_per_kg: s.rate_per_kg || full.items?.[0]?.rate,
        gst_percent: s.gst_percent || full.items?.[0]?.gst_percent
      });
      setShowSalesModal(true);
    } catch {
      setEditingSale(s);
      setShowSalesModal(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'order') await api.deleteProductionOrder(deleteTarget.id);
      if (deleteTarget.type === 'consumption') await api.deleteConsumptionBatch(deleteTarget.id);
      if (deleteTarget.type === 'purchase') await api.deletePurchase(deleteTarget.id);
      if (deleteTarget.type === 'production') await api.deleteProduction(deleteTarget.id);
      if (deleteTarget.type === 'sale') await api.deleteSale(deleteTarget.id);
      setDeleteTarget(null);
      await loadTransactions();
      showSuccess('Transaction deleted and stock / accounts reversed.');
    } catch (err) {
      setTxError(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const TABS = [
    { id: 'orders', label: '1. Production Orders', icon: <FileText size={14} />, count: orders.length },
    { id: 'consumption', label: '2. Material Issue Batches', icon: <Layers size={14} />, count: consumptionBatches.length },
    { id: 'purchases', label: '3. RM Purchases', icon: <ShoppingBag size={14} />, count: purchases.filter(p => !p.is_voided).length },
    { id: 'production', label: '4. Manufacturing & Wastage', icon: <Factory size={14} />, count: productions.filter(p => !p.is_voided).length },
    { id: 'sales', label: '5. Sales & Invoices', icon: <Truck size={14} />, count: sales.filter(s => !s.is_voided).length },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Manufacturing & Billing Operations</h2>
          <p>Workflow: Orders &rarr; Material Issue Batches &rarr; Production Entry (Auto-Filled) &rarr; Dispatch</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadTransactions}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-outline btn-sm" onClick={() => {
            if (tab === 'orders') exportCSV(orders, 'production-orders.csv');
            if (tab === 'consumption') exportCSV(consumptionBatches, 'consumption-batches.csv');
            if (tab === 'purchases') exportCSV(purchases, 'purchases.csv');
            if (tab === 'production') exportCSV(productions, 'production.csv');
            if (tab === 'sales') exportCSV(sales, 'sales.csv');
          }}>
            Export CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (tab === 'orders') setShowOrderModal(true);
              else if (tab === 'consumption') setShowConsumptionModal(true);
              else if (tab === 'purchases') {
                setEditingPurchase(null);
                setShowPurchaseModal(true);
              }
              else if (tab === 'production') {
                setProdBatchIdToOpen(null);
                setShowProductionModal(true);
              }
              else if (tab === 'sales') setShowSalesModal(true);
            }}
          >
            <Plus size={14} />
            {tab === 'orders' ? 'New Production Order'
              : tab === 'consumption' ? 'Issue Raw Materials'
              : tab === 'purchases' ? 'New Purchase'
              : tab === 'production' ? '+ New Manufacturing Entry'
              : 'Record Sale'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
          ✓ {successMsg}
        </div>
      )}
      {txError && (
        <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
          {txError}
          <button onClick={() => setTxError('')} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Tab + Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`mode-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: '10px' }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <Filter size={14} color="var(--text-dim)" />
          <input type="date" className="form-input" style={{ width: '145px', padding: '6px 10px', fontSize: '12px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>to</span>
          <input type="date" className="form-input" style={{ width: '145px', padding: '6px 10px', fontSize: '12px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {managers.length > 0 && (
            <select className="form-select" style={{ width: '140px', padding: '6px 10px', fontSize: '12px' }} value={managerFilter} onChange={e => setManagerFilter(e.target.value)}>
              <option value="">All Managers</option>
              {managers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Main Tables Container */}
      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="animate-spin" /> Loading records...
          </div>
        ) : tab === 'orders' ? (
          /* 1. Production Orders Table */
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>GSM</th>
                  <th>Size</th>
                  <th style={{ textAlign: 'right' }}>Target Qty</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Update Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No production orders found. Click "+ New Production Order" to create one.</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id}>
                    <td><span className="pill pill-blue num-mono">{o.order_no}</span></td>
                    <td>{o.order_date}</td>
                    <td style={{ fontWeight: '700' }}>{o.customer_name}</td>
                    <td style={{ fontWeight: '600' }}>{o.product_name}</td>
                    <td className="num-mono">{o.gsm || '—'}</td>
                    <td>{o.size || '—'}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: 'var(--emerald)' }}>
                      {Number(o.required_quantity).toLocaleString()} {o.unit}
                    </td>
                    <td>{o.delivery_date || '—'}</td>
                    <td>
                      <span className={`pill ${o.status === 'Completed' ? 'pill-emerald' : o.status === 'In Production' ? 'pill-blue' : o.status === 'Cancelled' ? 'pill-rose' : 'pill-amber'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        value={o.status}
                        onChange={e => handleUpdateOrderStatus(o.id, e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Production">In Production</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => setDeleteTarget({ id: o.id, label: o.order_no, type: 'order' })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'consumption' ? (
          /* 2. Material Consumption Batches Table (Clear path to Manufacturing Entry) */
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Issue Batch #</th>
                  <th>Date</th>
                  <th>Linked Order</th>
                  <th>Machine</th>
                  <th>Shift</th>
                  <th>Issued Materials</th>
                  <th>Issue Status</th>
                  <th>Issued By</th>
                  <th>Action / Workflow</th>
                </tr>
              </thead>
              <tbody>
                {consumptionBatches.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No material issue batches found. Click "+ Issue Raw Materials" to log an issue batch.</td></tr>
                ) : consumptionBatches.map(cb => {
                  const isExpanded = expandedConsumption === cb.id;
                  const isReadyForProd = cb.status === 'Issued' && cb.production_status !== 'Completed';
                  const isDone = cb.production_status === 'Completed' || cb.status === 'Completed';
                  return (
                    <React.Fragment key={cb.id}>
                      <tr onClick={() => setExpandedConsumption(isExpanded ? null : cb.id)} style={{ cursor: 'pointer' }}>
                        <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td><span className="pill pill-cyan num-mono">{cb.batch_no}</span></td>
                        <td>{cb.date}</td>
                        <td style={{ fontWeight: '600' }}>{cb.production_order_no || 'General Floor Issue'}</td>
                        <td>{cb.machine_name || '—'}</td>
                        <td><span className="pill pill-blue" style={{ fontSize: '10px' }}>{cb.shift_name || '—'}</span></td>
                        <td><span style={{ fontWeight: '700', color: '#38bdf8' }}>{cb.items?.length || 0} Materials</span></td>
                        <td>
                          <span className={`pill ${isDone ? 'pill-indigo' : cb.status === 'Issued' ? 'pill-emerald' : cb.status === 'Cancelled' ? 'pill-rose' : 'pill-amber'}`}>
                            {isDone ? 'Completed' : cb.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{cb.manager_name}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {cb.status === 'Draft' && (
                              <button className="btn btn-outline btn-sm" style={{ fontSize: '11px', color: 'var(--emerald)' }} onClick={() => handleUpdateConsumptionStatus(cb.id, 'Issued')}>
                                <CheckCircle size={12} /> Confirm Issue
                              </button>
                            )}
                            {isReadyForProd && (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '11px', padding: '4px 10px', background: 'linear-gradient(135deg, #10b981, #059669)', borderColor: '#059669', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                onClick={() => {
                                  setProdBatchIdToOpen(cb.id);
                                  setShowProductionModal(true);
                                }}
                                title="Use this Batch to Record Manufacturing Output"
                              >
                                <Factory size={12} /> Create Production &rarr;
                              </button>
                            )}
                            {isDone && (
                              <span className="pill pill-emerald" style={{ fontSize: '10.5px' }}>
                                ✓ Production Done
                              </span>
                            )}
                            {cb.status === 'Issued' && !isDone && (
                              <button className="btn btn-outline btn-sm" style={{ fontSize: '11px', color: 'var(--rose)', padding: '3px 6px' }} onClick={() => handleUpdateConsumptionStatus(cb.id, 'Cancelled')} title="Cancel Issue">
                                <XCircle size={12} />
                              </button>
                            )}
                            {cb.status === 'Cancelled' && (
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Cancelled</span>
                            )}
                            {cb.status !== 'Completed' && (
                              <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete Batch" onClick={() => setDeleteTarget({ id: cb.id, label: cb.batch_no, type: 'consumption' })} />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && cb.items && cb.items.length > 0 && (
                        <tr style={{ background: 'rgba(56, 189, 248, 0.04)' }}>
                          <td></td>
                          <td colSpan="9" style={{ padding: '12px 20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>
                              Materials Issued in {cb.batch_no}:
                            </div>
                            <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Raw Material</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Quantity</th>
                                  <th style={{ textAlign: 'center', padding: '4px 8px' }}>Unit</th>
                                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Batch Lot</th>
                                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cb.items.map((it, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: '600' }}>{it.raw_material_name}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: 'var(--cyan)' }}>{Number(it.quantity).toLocaleString()}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                      <span className={`pill ${it.unit === 'PCS' ? 'pill-amber' : 'pill-cyan'}`} style={{ fontSize: '10px' }}>{it.unit}</span>
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>{it.batch_lot || '—'}</td>
                                    <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{it.remarks || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : tab === 'purchases' ? (
          /* 3. Multi-Item Purchases Table */
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Purchase Code</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Raw Materials</th>
                  <th style={{ textAlign: 'right' }}>Taxable ₹</th>
                  <th style={{ textAlign: 'right' }}>Total GST ₹</th>
                  <th style={{ textAlign: 'right' }}>Grand Total ₹</th>
                  <th>Invoice #</th>
                  <th>Type</th>
                  <th>Entered By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.filter(p => !p.is_voided).map(p => {
                  const isExpanded = expandedPurchase === p.id;
                  const itemCount = p.items && p.items.length > 0 ? p.items.length : 1;
                  return (
                    <React.Fragment key={p.id}>
                      <tr onClick={() => setExpandedPurchase(isExpanded ? null : p.id)} style={{ cursor: 'pointer' }}>
                        <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td><span className="pill pill-cyan num-mono">{p.purchase_code}</span></td>
                        <td>{p.date}</td>
                        <td style={{ fontWeight: '600' }}>{p.supplier_name}</td>
                        <td>
                          {itemCount > 1 ? (
                            <span className="pill pill-blue" style={{ fontWeight: '700' }}>
                              {itemCount} Materials (Multi-Item)
                            </span>
                          ) : (
                            <span style={{ fontWeight: '500' }}>
                              {p.raw_material_name || p.items?.[0]?.raw_material_name || 'Raw Material'}
                              {p.quantity_kg ? ` (${p.quantity_kg} ${p.unit || 'KG'})` : ''}
                            </span>
                          )}
                        </td>
                        <td className="num-mono" style={{ textAlign: 'right' }}>₹{(p.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--cyan)' }}>₹{(p.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: 'var(--emerald)' }}>₹{(p.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.invoice_number || '—'}</td>
                        <td>
                          <span className={`pill ${p.purchase_type === 'NON_GST' ? 'pill-amber' : 'pill-cyan'}`}>
                            {p.purchase_type || 'GST'}
                          </span>
                        </td>
                        <td><span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{p.manager_name}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <ActionBtn
                              icon={<Edit2 size={12} />}
                              color="var(--primary)"
                              title="Edit Purchase Invoice"
                              onClick={() => {
                                setEditingPurchase(p);
                                setShowPurchaseModal(true);
                              }}
                            />
                            <ActionBtn
                              icon={<Trash2 size={12} />}
                              color="var(--rose)"
                              title="Void / Delete"
                              onClick={() => setDeleteTarget({ id: p.id, label: `${p.purchase_code} (${p.invoice_number || 'Invoice'})`, type: 'purchase' })}
                            />
                          </div>
                        </td>
                      </tr>
                      {isExpanded && p.items && p.items.length > 0 && (
                        <tr style={{ background: 'rgba(6, 182, 212, 0.04)' }}>
                          <td></td>
                          <td colSpan="11" style={{ padding: '12px 20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--cyan)', marginBottom: '8px' }}>
                              Purchase Invoice Line Items ({p.items.length} materials):
                            </div>
                            <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Material</th>
                                  <th style={{ textAlign: 'center', padding: '4px 8px' }}>HSN</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Qty</th>
                                  <th style={{ textAlign: 'center', padding: '4px 8px' }}>Unit</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Rate (₹)</th>
                                  <th style={{ textAlign: 'center', padding: '4px 8px' }}>GST %</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Taxable (₹)</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>GST (₹)</th>
                                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total (₹)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.items.map((it, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: '600' }}>{it.raw_material_name}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-dim)' }}>{it.hsn_code || '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--cyan)' }}>{Number(it.quantity).toLocaleString()}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                      <span className={`pill ${it.unit === 'PCS' ? 'pill-amber' : 'pill-cyan'}`} style={{ fontSize: '10px' }}>{it.unit}</span>
                                    </td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{Number(it.rate).toFixed(2)}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.gst_rate}%</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{Number(it.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{Number(it.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--emerald)' }}>₹{Number(it.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : tab === 'production' ? (
          /* 4. Manufacturing & Wastage Table (Shows Issue Batch No, Order, Outputs, Consumed Materials) */
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Production No</th>
                  <th>Date</th>
                  <th>Issue Batch #</th>
                  <th>Production Order</th>
                  <th>Machine</th>
                  <th>Shift</th>
                  <th style={{ textAlign: 'right' }}>Finished Output</th>
                  <th style={{ textAlign: 'right' }}>Wastage</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {productions.filter(p => !p.is_voided).map(batch => {
                  const isExpanded = expandedBatch === batch.id;
                  const totalFG = batch.total_finished_kg != null ? Number(batch.total_finished_kg).toLocaleString() : '—';
                  const fgUnit = batch.outputs?.[0]?.unit || 'KG';
                  const wasteQty = batch.total_wastage_kg != null ? Number(batch.total_wastage_kg).toLocaleString() : '0';
                  const wasteUnit = batch.wastage_unit || 'KG';
                  return (
                    <React.Fragment key={batch.id}>
                      <tr onClick={() => setExpandedBatch(isExpanded ? null : batch.id)} style={{ cursor: 'pointer' }}>
                        <td>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td><span className="pill pill-indigo num-mono">{batch.batch_code}</span></td>
                        <td>{batch.date}</td>
                        <td>
                          {batch.consumption_batch_no ? (
                            <span className="pill pill-cyan num-mono">{batch.consumption_batch_no}</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Legacy / Direct</span>
                          )}
                        </td>
                        <td>
                          {batch.production_order_no ? (
                            <span className="pill pill-blue">{batch.production_order_no}</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Floor Run</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '500' }}>{batch.machine_name || '—'}</td>
                        <td><span className="pill pill-blue" style={{ fontSize: '10px' }}>{batch.shift_name || '—'}</span></td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)', fontWeight: '700' }}>
                          {totalFG} {fgUnit}
                        </td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--amber)' }}>
                          {wasteQty} {wasteUnit}
                        </td>
                        <td>
                          <span className="pill pill-emerald" style={{ fontSize: '11px' }}>
                            {batch.status || 'Completed'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{batch.manager_name}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => setDeleteTarget({ id: batch.id, label: batch.batch_code, type: 'production' })} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: 'rgba(99, 102, 241, 0.04)' }}>
                          <td></td>
                          <td colSpan="11" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                              {/* Materials Consumed */}
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--cyan)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                  Materials Consumed
                                </div>
                                {batch.consumed_materials && batch.consumed_materials.length > 0 ? (
                                  <table style={{ width: '100%', fontSize: '11.5px' }}>
                                    <thead>
                                      <tr style={{ color: 'var(--text-muted)' }}>
                                        <th style={{ textAlign: 'left' }}>Material</th>
                                        <th style={{ textAlign: 'right' }}>Quantity</th>
                                        <th style={{ textAlign: 'center' }}>Unit</th>
                                        <th style={{ textAlign: 'left' }}>Lot</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {batch.consumed_materials.map((cm, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          <td style={{ fontWeight: '600', padding: '4px 0' }}>{cm.raw_material_name}</td>
                                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--cyan)', padding: '4px 0' }}>{Number(cm.quantity).toLocaleString()}</td>
                                          <td style={{ textAlign: 'center', padding: '4px 0' }}>
                                            <span className={`pill ${cm.unit === 'PCS' ? 'pill-amber' : 'pill-cyan'}`} style={{ fontSize: '9.5px' }}>{cm.unit}</span>
                                          </td>
                                          <td style={{ color: 'var(--text-dim)', padding: '4px 0' }}>{cm.batch_lot || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : batch.raw_material_name ? (
                                  <div style={{ fontSize: '12px' }}>
                                    <strong>{batch.raw_material_name}</strong>: {batch.raw_material_used_kg?.toLocaleString()} KG
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>No material records found.</div>
                                )}
                              </div>

                              {/* Finished Outputs */}
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--emerald)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                  Finished Goods Output
                                </div>
                                {batch.outputs && batch.outputs.length > 0 ? (
                                  <table style={{ width: '100%', fontSize: '11.5px' }}>
                                    <thead>
                                      <tr style={{ color: 'var(--text-muted)' }}>
                                        <th style={{ textAlign: 'left' }}>Product</th>
                                        <th style={{ textAlign: 'left' }}>Spec</th>
                                        <th style={{ textAlign: 'right' }}>Output Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {batch.outputs.map((out, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          <td style={{ fontWeight: '600', padding: '4px 0' }}>{out.product_name}</td>
                                          <td style={{ color: 'var(--text-dim)', padding: '4px 0' }}>{out.gsm ? `${out.gsm} GSM` : ''} {out.width_size || ''}</td>
                                          <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--emerald)', padding: '4px 0' }}>
                                            {(out.quantity_kg || out.quantity)?.toLocaleString()} {out.unit || 'KG'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>No output records.</div>
                                )}
                              </div>

                              {/* Wastage Details */}
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--amber)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                  Wastage & Notes
                                </div>
                                <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Quantity: </span>
                                  <strong style={{ color: 'var(--amber)' }}>{wasteQty} {wasteUnit}</strong>
                                </div>
                                <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Reason: </span>
                                  <span>{batch.wastage_reason || 'Machine Waste'}</span>
                                </div>
                                {batch.remarks && (
                                  <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                    "{batch.remarks}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* 5. Sales Table */
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Sale Code</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Invoice #</th>
                  <th style={{ textAlign: 'right' }}>Taxable ₹</th>
                  <th style={{ textAlign: 'right' }}>Total Amount ₹</th>
                  <th>Payment</th>
                  <th>Entered By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.filter(s => !s.is_voided).map(s => (
                  <tr key={s.id}>
                    <td><span className="pill pill-emerald num-mono">{s.sale_code}</span></td>
                    <td>{s.date}</td>
                    <td style={{ fontWeight: '700' }}>{s.customer_name}</td>
                    <td><span className="pill pill-blue num-mono">{s.invoice_number || '—'}</span></td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>₹{(s.taxable_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: '800', color: 'var(--emerald)' }}>₹{s.total_amount?.toLocaleString('en-IN')}</td>
                    <td><span className={`pill ${s.payment_type === 'Cash' ? 'pill-emerald' : s.payment_type === 'Credit' ? 'pill-amber' : 'pill-cyan'}`}>{s.payment_type}</span></td>
                    <td style={{ fontSize: '12px' }}>{s.manager_name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <ActionBtn icon={<FileText size={12} />} color="var(--primary)" title="Tax Invoice / Print PDF / E-Invoice" onClick={() => setInvoiceSaleIdToView(s.id)} />
                        <ActionBtn icon={<Edit2 size={12} />} color="var(--blue)" title="Edit Sale" onClick={() => handleEditSale(s)} />
                        <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => setDeleteTarget({ id: s.id, label: s.sale_code, type: 'sale' })} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddOrderModal
        isOpen={showOrderModal}
        customers={customers}
        finishedGoods={finishedGoods}
        onClose={() => setShowOrderModal(false)}
        onSuccess={() => { loadTransactions(); showSuccess('Customer production order created successfully!'); }}
      />

      <AddConsumptionModal
        isOpen={showConsumptionModal}
        orders={orders}
        machines={machines}
        shifts={shifts}
        rawMaterials={rawMaterials}
        onClose={() => setShowConsumptionModal(false)}
        onSuccess={() => { loadTransactions(); showSuccess('Material consumption batch issued to floor!'); }}
      />

      <PurchaseEntryModal
        isOpen={showPurchaseModal}
        initialPurchase={editingPurchase}
        onClose={() => {
          setShowPurchaseModal(false);
          setEditingPurchase(null);
        }}
        onSuccess={() => {
          loadTransactions();
          showSuccess(editingPurchase ? 'Purchase entry updated successfully!' : 'Purchase entry recorded successfully!');
        }}
        managerProfile={{ name: 'Admin', deviceId: 'admin-portal' }}
      />

      <ProductionEntryModal
        isOpen={showProductionModal}
        preSelectedBatchId={prodBatchIdToOpen}
        onClose={() => {
          setShowProductionModal(false);
          setProdBatchIdToOpen(null);
        }}
        onSuccess={() => {
          loadTransactions();
          showSuccess('Production batch recorded successfully!');
        }}
        managerProfile={{ name: 'Admin', deviceId: 'admin-portal' }}
      />

      <SalesEntryModal
        isOpen={showSalesModal}
        initialSale={editingSale}
        onClose={() => {
          setShowSalesModal(false);
          setEditingSale(null);
        }}
        onSuccess={() => {
          loadTransactions();
          showSuccess(editingSale ? 'Sale invoice updated successfully!' : 'Sale invoice created successfully!');
        }}
        managerProfile={{ name: 'Admin', deviceId: 'admin-portal' }}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemLabel={deleteTarget?.label}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />

      <TaxInvoiceModal
        isOpen={!!invoiceSaleIdToView}
        saleId={invoiceSaleIdToView}
        onClose={() => setInvoiceSaleIdToView(null)}
      />
    </div>
  );
}
