import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Factory, Truck, Package, Users, BarChart2, RefreshCw,
  Plus, Clock, FileText, UserCheck, Layers, ClipboardList,
  ArrowDownLeft, ArrowUpRight, CreditCard, Printer, ShieldCheck,
  BookOpen, Download, MessageCircle, Cpu, Building2, Search, CheckCircle2,
  AlertCircle, Eye, Share2, Send, X, AlertTriangle
} from 'lucide-react';
import { api, session } from '../../api';
import PurchaseEntryModal from '../ManagerApp/PurchaseEntryModal';
import ProductionEntryModal from '../ManagerApp/ProductionEntryModal';
import SalesEntryModal from '../ManagerApp/SalesEntryModal';
import PaymentEntryModal from '../ManagerApp/PaymentEntryModal';
import ConsumptionEntryModal from '../ManagerApp/ConsumptionEntryModal';
import TaxInvoiceModal from './TaxInvoiceModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtINR(num) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return '₹' + Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, icon: Icon, color }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: `1px solid ${color}22`,
      borderRadius: '12px',
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px'
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: `${color}18`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
          {value} <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>{unit}</span>
        </div>
        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Entry row in My Entries list ────────────────────────────────────────────
function EntryRow({ label, sub, date, badge, badgeColor, onAction, actionLabel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
      borderRadius: '8px', marginBottom: '6px', borderLeft: `2px solid ${badgeColor}44`,
      gap: '12px'
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '11px', fontWeight: '700', color: badgeColor,
            background: `${badgeColor}18`, padding: '2px 8px', borderRadius: '6px', marginBottom: '3px'
          }}>
            {badge}
          </div>
          <div style={{ fontSize: '10px', color: '#475569' }}>{date}</div>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', padding: '4px 8px', color: '#38bdf8', fontSize: '11px',
              cursor: 'pointer', fontWeight: '600'
            }}
          >
            <FileText size={12} /> {actionLabel || 'View'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '10px', border: 'none',
        background: active ? 'rgba(168,85,247,0.18)' : 'transparent',
        color: active ? '#c084fc' : '#94a3b8',
        fontWeight: active ? '700' : '500', fontSize: '13px',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease'
      }}
    >
      <Icon size={16} color={active ? '#c084fc' : '#64748b'} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span style={{
          fontSize: '10px', fontWeight: '700', padding: '1px 6px',
          borderRadius: '20px', background: 'rgba(168,85,247,0.25)', color: '#c084fc'
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Generic Master Creation Modal (Strictly Create Only) ──────────────────────
function MasterAddModal({ isOpen, type, onClose, onCreated }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (type === 'raw-materials') {
        setFormData({ category: 'Polymer', unit: 'KG', hsnCode: '3901', gstPercent: '18', minStockAlert: '1000' });
      } else if (type === 'finished-goods') {
        setFormData({ productName: 'Tripal', colour: 'Blue', grade: 'Grade A', hsnCode: '3926', gstPercent: '18', minStockAlert: '500' });
      } else if (type === 'machines') {
        setFormData({ capacityKgPerDay: '5000' });
      } else if (type === 'shifts') {
        setFormData({ startTime: '08:00 AM', endTime: '04:00 PM' });
      } else {
        setFormData({});
      }
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const configs = {
    'raw-materials': {
      title: 'Add New Raw Material',
      fields: [
        { key: 'name', label: 'Material Name *', placeholder: 'e.g. LDPE Virgin Grade', required: true },
        { key: 'category', label: 'Category *', type: 'select', required: true, options: [
          { value: 'Polymer', label: 'Polymer' },
          { value: 'Masterbatch', label: 'Masterbatch' },
          { value: 'Additive', label: 'Additive' },
          { value: 'Pigment', label: 'Pigment' },
          { value: 'Other', label: 'Other' },
        ]},
        { key: 'unit', label: 'Unit *', type: 'select', required: true, options: [
          { value: 'KG', label: 'KG — Kilogram' },
          { value: 'PCS', label: 'PCS — Pieces' },
          { value: 'Litre', label: 'Litre' },
          { value: 'Meter', label: 'Meter' },
          { value: 'Bag', label: 'Bag — 25kg Bag' },
          { value: 'Roll', label: 'Roll' },
        ]},
        { key: 'hsnCode', label: 'HSN Code', placeholder: '3901' },
        { key: 'gstPercent', label: 'GST Rate %', type: 'select', options: [
          { value: '0', label: '0% (Exempt)' },
          { value: '5', label: '5%' },
          { value: '12', label: '12%' },
          { value: '18', label: '18%' },
          { value: '28', label: '28%' },
        ]},
        { key: 'minStockAlert', label: 'Min Stock Alert (KG)', type: 'number', placeholder: '1000' },
      ],
      apiCall: (d) => api.createRawMaterial(d)
    },
    'finished-goods': {
      title: 'Add New Finished Good Product',
      fields: [
        { key: 'productName', label: 'Product Name *', placeholder: 'Tripal', required: true },
        { key: 'gsm', label: 'GSM *', type: 'number', required: true, placeholder: 'e.g. 150' },
        { key: 'widthSize', label: 'Width / Size *', required: true, placeholder: 'e.g. 16 FT' },
        { key: 'lengthVal', label: 'Length', placeholder: 'e.g. 100 M' },
        { key: 'colour', label: 'Colour *', type: 'select', required: true, options: [
          { value: 'Blue', label: 'Blue' },
          { value: 'Green', label: 'Green' },
          { value: 'Yellow', label: 'Yellow' },
          { value: 'Black', label: 'Black' },
          { value: 'Silver', label: 'Silver' },
          { value: 'White', label: 'White' },
          { value: 'Orange', label: 'Orange' },
          { value: 'Red', label: 'Red' },
        ]},
        { key: 'grade', label: 'Grade', type: 'select', options: [
          { value: 'Grade A', label: 'Grade A' },
          { value: 'Heavy Duty', label: 'Heavy Duty' },
          { value: 'Standard', label: 'Standard' },
          { value: 'Export Quality', label: 'Export Quality' },
        ]},
        { key: 'hsnCode', label: 'HSN Code', placeholder: '3926' },
        { key: 'gstPercent', label: 'GST Rate %', type: 'select', options: [
          { value: '0', label: '0%' },
          { value: '5', label: '5%' },
          { value: '12', label: '12%' },
          { value: '18', label: '18%' },
          { value: '28', label: '28%' },
        ]},
        { key: 'minStockAlert', label: 'Min Stock Alert (KG)', type: 'number', placeholder: '500' },
      ],
      apiCall: (d) => api.createFinishedGood(d)
    },
    'customers': {
      title: 'Add New Customer',
      fields: [
        { key: 'name', label: 'Customer / Firm Name *', required: true, placeholder: 'e.g. Kisan Agro Traders' },
        { key: 'phone', label: 'Phone / WhatsApp', placeholder: '+91 98200 12345' },
        { key: 'address', label: 'Address / City', placeholder: 'City, State' },
        { key: 'gstNumber', label: 'GST Number', placeholder: '24AAAXX0000X1Z0' },
        { key: 'remarks', label: 'Remarks / Notes', fullWidth: true, placeholder: 'Optional notes' },
      ],
      apiCall: (d) => api.createCustomer(d)
    },
    'suppliers': {
      title: 'Add New Supplier',
      fields: [
        { key: 'name', label: 'Supplier / Vendor Name *', required: true, placeholder: 'e.g. Reliance Polymers Ltd' },
        { key: 'phone', label: 'Phone / WhatsApp', placeholder: '+91 98200 12345' },
        { key: 'address', label: 'Address / City', placeholder: 'Industrial Area, City' },
        { key: 'gstNumber', label: 'GST Number', placeholder: '24AAAXX0000X1Z0' },
      ],
      apiCall: (d) => api.createSupplier(d)
    },
    'machines': {
      title: 'Add New Factory Machine',
      fields: [
        { key: 'name', label: 'Machine Name / Code *', required: true, placeholder: 'e.g. Extruder Line 3' },
        { key: 'capacityKgPerDay', label: 'Capacity (KG/Day)', type: 'number', placeholder: '5000' },
      ],
      apiCall: (d) => api.createMachine(d)
    },
    'shifts': {
      title: 'Add New Shift',
      fields: [
        { key: 'name', label: 'Shift Name *', required: true, placeholder: 'e.g. Morning Shift' },
        { key: 'startTime', label: 'Start Time', placeholder: '08:00 AM' },
        { key: 'endTime', label: 'End Time', placeholder: '04:00 PM' },
      ],
      apiCall: (d) => api.createShift(d)
    }
  };

  const config = configs[type];
  if (!config) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await config.apiCall(formData);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create master entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(7, 11, 20, 0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid rgba(168,85,247,0.3)',
        borderRadius: '14px', width: '100%', maxWidth: '520px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(168,85,247,0.12), transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="#c084fc" />
            </div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>{config.title}</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(244,63,94,0.12)',
                border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px',
                color: '#fb7185', fontSize: '12px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {config.fields.map(f => (
                <div key={f.key} style={{ gridColumn: f.fullWidth ? '1 / -1' : 'span 1' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#cbd5e1', marginBottom: '5px' }}>
                    {f.label}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={formData[f.key] || ''}
                      onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      required={f.required}
                      style={{
                        width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                        color: '#f8fafc', fontSize: '13px', outline: 'none'
                      }}
                    >
                      {f.options?.map(opt => (
                        <option key={opt.value} value={opt.value} style={{ background: '#0f172a', color: '#f8fafc' }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type || 'text'}
                      value={formData[f.key] || ''}
                      onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder || ''}
                      required={f.required}
                      style={{
                        width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                        color: '#f8fafc', fontSize: '13px', outline: 'none'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '16px', padding: '10px 12px', background: 'rgba(168,85,247,0.06)',
              border: '1px solid rgba(168,85,247,0.15)', borderRadius: '8px',
              fontSize: '11px', color: '#94a3b8'
            }}>
              🔒 <strong>Entry-Only Note:</strong> Manager can create this record immediately. Modification or deletion requires Admin.
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(15,23,42,0.4)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                color: '#fff', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(168,85,247,0.3)'
              }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {loading ? 'Creating...' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manager Masters View (Create Only, Read Only, No Edit/Delete) ─────────────
function ManagerMasters() {
  const [tab, setTab] = useState('customers');
  const [data, setData] = useState({
    'raw-materials': [],
    'finished-goods': [],
    'customers': [],
    'suppliers': [],
    'machines': [],
    'shifts': []
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rm, fg, cust, supp, mach, sh] = await Promise.all([
        api.getRawMaterials().catch(() => []),
        api.getFinishedGoods().catch(() => []),
        api.getCustomers().catch(() => []),
        api.getSuppliers().catch(() => []),
        api.getMachines().catch(() => []),
        api.getShifts().catch(() => [])
      ]);
      setData({
        'raw-materials': rm || [],
        'finished-goods': fg || [],
        'customers': cust || [],
        'suppliers': supp || [],
        'machines': mach || [],
        'shifts': sh || []
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const TABS = [
    { id: 'customers', label: 'Customers', icon: Users, count: data['customers'].length },
    { id: 'suppliers', label: 'Suppliers', icon: UserCheck, count: data['suppliers'].length },
    { id: 'raw-materials', label: 'Raw Materials', icon: Layers, count: data['raw-materials'].length },
    { id: 'finished-goods', label: 'Finished Goods', icon: Package, count: data['finished-goods'].length },
    { id: 'machines', label: 'Machines', icon: Cpu, count: data['machines'].length },
    { id: 'shifts', label: 'Shifts', icon: Clock, count: data['shifts'].length },
  ];

  const currentList = data[tab] || [];
  const filtered = currentList.filter(item => {
    const s = search.toLowerCase();
    return (
      (item.name || item.product_name || '').toLowerCase().includes(s) ||
      (item.phone || '').includes(s) ||
      (item.code || item.product_code || '').toLowerCase().includes(s)
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
            Masters Catalog <span style={{ fontSize: '12px', fontWeight: '600', color: '#c084fc', background: 'rgba(168,85,247,0.15)', padding: '2px 8px', borderRadius: '6px', marginLeft: '6px' }}>CREATE ONLY</span>
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
            Managers can add new customers, suppliers, materials, and items. Existing records are locked from editing.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            color: '#fff', border: 'none', borderRadius: '8px',
            padding: '9px 18px', fontSize: '12.5px', fontWeight: '700',
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(168,85,247,0.3)'
          }}
        >
          <Plus size={15} /> Add New {TABS.find(t => t.id === tab)?.label.slice(0, -1) || 'Item'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', fontSize: '12px', marginBottom: '14px' }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch(''); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: active ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                color: active ? '#c084fc' : '#94a3b8',
                fontWeight: active ? '700' : '500', cursor: 'pointer', fontSize: '13px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={14} color={active ? '#c084fc' : '#64748b'} />
              {t.label}
              <span style={{ fontSize: '11px', background: active ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '10px' }}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Filter Bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: '#f1f5f9', fontSize: '12.5px', outline: 'none'
            }}
          />
        </div>
        <button
          onClick={loadAll}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '8px 12px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer'
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* List / Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading masters...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', color: '#64748b' }}>
          No records found. Click "+ Add New" to create the first record.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {filtered.map(item => (
            <div
              key={item.id}
              style={{
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px', padding: '14px 16px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                transition: 'border-color 0.15s'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
                    {item.name || item.product_name}
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                    background: item.status === 'inactive' ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                    color: item.status === 'inactive' ? '#fb7185' : '#34d399'
                  }}>
                    {item.status || 'active'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                  {tab === 'raw-materials' && (
                    <>
                      <div>Category: <strong style={{ color: '#cbd5e1' }}>{item.category}</strong> · Unit: <strong style={{ color: '#cbd5e1' }}>{item.unit}</strong></div>
                      <div>HSN: {item.hsn_code || '—'} · GST: {item.gst_percent || 18}%</div>
                    </>
                  )}
                  {tab === 'finished-goods' && (
                    <>
                      <div>{item.gsm} GSM · {item.width_size} · {item.colour}</div>
                      <div>Grade: {item.grade || 'Grade A'} · GST: {item.gst_percent || 18}%</div>
                    </>
                  )}
                  {tab === 'customers' && (
                    <>
                      <div>📞 {item.phone || 'No phone'}</div>
                      <div>📍 {item.address || 'No address'}</div>
                      {item.gst_number && <div>GSTIN: <span style={{ fontFamily: 'monospace' }}>{item.gst_number}</span></div>}
                    </>
                  )}
                  {tab === 'suppliers' && (
                    <>
                      <div>📞 {item.phone || 'No phone'}</div>
                      <div>📍 {item.address || 'No address'}</div>
                      {item.gst_number && <div>GSTIN: <span style={{ fontFamily: 'monospace' }}>{item.gst_number}</span></div>}
                    </>
                  )}
                  {tab === 'machines' && (
                    <div>Capacity: <strong>{fmt(item.capacity_kg_per_day)} KG/Day</strong></div>
                  )}
                  {tab === 'shifts' && (
                    <div>Hours: <strong>{item.start_time || '—'}</strong> to <strong>{item.end_time || '—'}</strong></div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#475569' }}>
                <span>ID #{item.id}</span>
                <span style={{ color: '#64748b' }}>🔒 Read-only</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <MasterAddModal
        isOpen={showModal}
        type={tab}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          setMsg('Master record created successfully!');
          setTimeout(() => setMsg(''), 3000);
          loadAll();
        }}
      />
    </div>
  );
}

// ─── Party Ledger View with WhatsApp & Bill Print ──────────────────────────────
function LedgerView({ onViewInvoice }) {
  const [type, setType] = useState('CUSTOMER'); // 'CUSTOMER' | 'SUPPLIER'
  const [partyId, setPartyId] = useState('');
  const [parties, setParties] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);
  const [error, setError] = useState('');

  // Load parties on type change
  useEffect(() => {
    setLoadingParties(true);
    setLedger(null);
    setPartyId('');
    setError('');
    const fetcher = type === 'CUSTOMER' ? api.getCustomers() : api.getSuppliers();
    fetcher
      .then(res => setParties(res || []))
      .catch(err => setError(err.message))
      .finally(() => setLoadingParties(false));
  }, [type]);

  const loadStatement = async (pid = partyId) => {
    if (!pid) {
      setError(`Please select a ${type === 'CUSTOMER' ? 'Customer' : 'Supplier'} first.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = type === 'CUSTOMER'
        ? await api.getCustomerLedger(pid, dateFrom, dateTo)
        : await api.getSupplierLedger(pid, dateFrom, dateTo);
      setLedger(data);
    } catch (err) {
      setError(err.message || 'Failed to load ledger statement.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLedger = () => {
    if (!ledger) return;
    const win = window.open('', '_blank');
    const party = ledger.customer || ledger.supplier || {};
    const rows = (ledger.transactions || []).map(t => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">${t.date || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-family:monospace;">${t.doc_no || t.voucher_no || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;"><span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${t.type || ''}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">${t.description || t.particulars || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;color:#dc2626;">${t.debit > 0 ? '₹' + Number(t.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;color:#16a34a;">${t.credit > 0 ? '₹' + Number(t.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-weight:bold;">₹${Math.abs(t.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${t.balance >= 0 ? 'Dr' : 'Cr'}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Statement - ${party.name || 'Party'}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #0f172a; font-size: 12px; }
          h2 { margin: 0 0 4px; color: #1e293b; }
          .party-info { color: #64748b; margin-bottom: 16px; font-size: 11px; }
          .summary-grid { display: flex; gap: 12px; margin-bottom: 16px; }
          .summary-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
          .summary-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          .summary-val { font-size: 15px; font-weight: 700; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #0f172a; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
          @media print { * { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h2>ANRB MANUFACTURING · ACCOUNT STATEMENT</h2>
        <div class="party-info">
          <strong>${party.name || ''}</strong> ${party.address ? '· ' + party.address : ''} ${party.gst_number ? '· GSTIN: ' + party.gst_number : ''} ${party.phone ? '· Tel: ' + party.phone : ''}
          <br/>Period: ${dateFrom || 'Inception'} to ${dateTo || 'Current Date'}
        </div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Opening Balance</div>
            <div class="summary-val">₹${Number(ledger.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Debit</div>
            <div class="summary-val" style="color:#dc2626;">₹${Number(ledger.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Credit</div>
            <div class="summary-val" style="color:#16a34a;">₹${Number(ledger.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Closing Balance</div>
            <div class="summary-val" style="color:${ledger.closingBalance >= 0 ? '#dc2626' : '#16a34a'};">
              ₹${Math.abs(ledger.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${ledger.closingBalance >= 0 ? 'Dr (Receivable)' : 'Cr (Payable/Advance)'}
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Doc / Voucher</th>
              <th>Type</th>
              <th>Description</th>
              <th style="text-align:right;">Debit (₹)</th>
              <th style="text-align:right;">Credit (₹)</th>
              <th style="text-align:right;">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;">No transactions found</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleSendWhatsApp = () => {
    if (!ledger) return;
    const party = ledger.customer || ledger.supplier || {};
    const phone = (party.phone || '').replace(/[^0-9]/g, '');
    const bal = Math.abs(ledger.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const balStatus = ledger.closingBalance >= 0
      ? (type === 'CUSTOMER' ? 'Receivable (Pending)' : 'Payable')
      : (type === 'CUSTOMER' ? 'Advance/Overpaid' : 'Receivable/Advance');

    let msg = `*ACCOUNT STATEMENT / LEDGER*\n`;
    msg += `*Company:* ANRB Manufacturing\n`;
    msg += `*Party:* ${party.name || 'Valued Partner'}\n`;
    if (party.gst_number) msg += `*GSTIN:* ${party.gst_number}\n`;
    if (dateFrom || dateTo) msg += `*Period:* ${dateFrom || 'Inception'} to ${dateTo || 'Current'}\n`;
    msg += `--------------------------------\n`;
    msg += `*Opening Balance:* ₹${Number(ledger.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    msg += `*Total Debit:* ₹${Number(ledger.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    msg += `*Total Credit:* ₹${Number(ledger.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    msg += `*Closing Balance:* ₹${bal} (${balStatus})\n`;
    msg += `--------------------------------\n`;
    msg += `*Recent Transactions:*\n`;
    (ledger.transactions || []).slice(-5).forEach(t => {
      msg += `• ${t.date} | ${t.doc_no || t.type} | Dr: ₹${t.debit || 0} | Cr: ₹${t.credit || 0}\n`;
    });
    msg += `\n_Please review and confirm. Thank you!_`;

    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/91${phone.slice(-10)}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
            Party Account Ledger & Statement
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
            View customer or supplier ledger, print statement, or send detailed statement via WhatsApp.
          </p>
        </div>
      </div>

      {/* Filter & Selection Card */}
      <div style={{
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '16px', marginBottom: '18px'
      }}>
        {/* Toggle Type */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button
            onClick={() => setType('CUSTOMER')}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: 'none',
              background: type === 'CUSTOMER' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
              color: type === 'CUSTOMER' ? '#38bdf8' : '#94a3b8',
              fontWeight: type === 'CUSTOMER' ? '700' : '500', cursor: 'pointer', fontSize: '13px'
            }}
          >
            Customer Ledgers
          </button>
          <button
            onClick={() => setType('SUPPLIER')}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: 'none',
              background: type === 'SUPPLIER' ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
              color: type === 'SUPPLIER' ? '#c084fc' : '#94a3b8',
              fontWeight: type === 'SUPPLIER' ? '700' : '500', cursor: 'pointer', fontSize: '13px'
            }}
          >
            Supplier Ledgers
          </button>
        </div>

        {/* Inputs row */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>
              Select {type === 'CUSTOMER' ? 'Customer' : 'Supplier'} *
            </label>
            <select
              value={partyId}
              onChange={e => { setPartyId(e.target.value); setLedger(null); }}
              style={{
                width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                color: '#f8fafc', fontSize: '13px', outline: 'none'
              }}
            >
              <option value="" style={{ background: '#0f172a' }}>-- Select {type === 'CUSTOMER' ? 'Customer' : 'Supplier'} --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id} style={{ background: '#0f172a' }}>
                  {p.name} {p.phone ? `(${p.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                color: '#f8fafc', fontSize: '13px', outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                color: '#f8fafc', fontSize: '13px', outline: 'none'
              }}
            />
          </div>

          <button
            onClick={() => loadStatement()}
            disabled={!partyId || loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2,132,199,0.3)', opacity: (!partyId || loading) ? 0.6 : 1
            }}
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <BookOpen size={14} />}
            View Statement
          </button>

          {ledger && (
            <>
              <button
                onClick={handlePrintLedger}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 14px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f8fafc', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                <Printer size={14} /> Print Statement
              </button>

              <button
                onClick={handleSendWhatsApp}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 14px', borderRadius: '8px',
                  background: 'rgba(37, 211, 102, 0.15)', border: '1px solid rgba(37, 211, 102, 0.3)',
                  color: '#25D366', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <MessageCircle size={14} /> Send WhatsApp
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', color: '#fb7185', fontSize: '12.5px', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      {/* Ledger Results */}
      {ledger && (
        <div>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Opening Balance</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b', marginTop: '3px' }}>{fmtINR(ledger.openingBalance)}</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Total Debit (Sales/Payment)</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#fb7185', marginTop: '3px' }}>{fmtINR(ledger.totalDebit)}</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Total Credit (Receipts/Purchases)</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#34d399', marginTop: '3px' }}>{fmtINR(ledger.totalCredit)}</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Closing Balance</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: ledger.closingBalance >= 0 ? '#fb7185' : '#34d399', marginTop: '3px' }}>
                {fmtINR(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? 'Dr' : 'Cr'}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px', overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Doc / Voucher</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Description</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>Debit ₹</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>Credit ₹</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>Balance ₹</th>
                  {type === 'CUSTOMER' && <th style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8' }}>Invoice</th>}
                </tr>
              </thead>
              <tbody>
                {ledger.transactions?.length === 0 ? (
                  <tr>
                    <td colSpan={type === 'CUSTOMER' ? 8 : 7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No transactions found for this party in the selected date range.
                    </td>
                  </tr>
                ) : ledger.transactions?.map(t => {
                  const isInv = t.type === 'INVOICE';
                  const saleId = isInv ? (t.id || '').replace('sale-', '') : null;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{t.date}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8', fontSize: '11.5px' }}>
                        {t.doc_no || t.voucher_no || '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                          background: isInv ? 'rgba(244,63,94,0.15)' : t.type === 'BILL' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                          color: isInv ? '#fb7185' : t.type === 'BILL' ? '#f59e0b' : '#34d399'
                        }}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#e2e8f0', maxWidth: '280px' }}>
                        {t.description || t.particulars || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: t.debit > 0 ? '#fb7185' : '#64748b', fontWeight: t.debit > 0 ? '600' : '400', fontFamily: 'monospace' }}>
                        {t.debit > 0 ? fmtINR(t.debit) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: t.credit > 0 ? '#34d399' : '#64748b', fontWeight: t.credit > 0 ? '600' : '400', fontFamily: 'monospace' }}>
                        {t.credit > 0 ? fmtINR(t.credit) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: t.balance >= 0 ? '#fb7185' : '#34d399' }}>
                        {fmtINR(Math.abs(t.balance))} {t.balance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                      {type === 'CUSTOMER' && (
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {isInv && saleId && (
                            <button
                              onClick={() => onViewInvoice(saleId)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                                borderRadius: '6px', padding: '3px 8px', color: '#38bdf8', fontSize: '11px',
                                cursor: 'pointer', fontWeight: '600'
                              }}
                            >
                              <FileText size={11} /> Bill
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Outstanding Summary View ──────────────────────────────────────────────────
function OutstandingView({ onSelectPartyForLedger }) {
  const [tab, setTab] = useState('receivables'); // 'receivables' | 'payables'
  const [custRows, setCustRows] = useState([]);
  const [suppRows, setSuppRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.getCustomerOutstanding().catch(() => []),
        api.getSupplierOutstanding().catch(() => [])
      ]);
      setCustRows(c || []);
      setSuppRows(s || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const data = tab === 'receivables' ? custRows : suppRows;
  const filtered = data.filter(r =>
    (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.phone || '').includes(search)
  );

  const totalOutstanding = data.reduce((acc, r) => acc + (Number(r.net_balance || r.balance || r.outstanding || 0)), 0);

  const handleSendReminder = (party) => {
    const phone = (party.phone || '').replace(/[^0-9]/g, '');
    const amount = Number(party.net_balance || party.balance || party.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    let msg = `*PAYMENT REMINDER*\n`;
    msg += `Dear *${party.name}*,\n\n`;
    msg += `This is a gentle reminder from *ANRB Manufacturing* regarding your outstanding balance of *₹${amount}*.\n\n`;
    msg += `Kindly arrange for the payment at your earliest convenience.\n\n`;
    msg += `Thank you for your business!\n_ANRB Manufacturing Accounts_`;
    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/91${phone.slice(-10)}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
            Outstanding Balance Summary
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
            Monitor customer receivables and supplier payables with instant WhatsApp reminder send.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowDownLeft size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8' }}>
              {fmtINR(custRows.reduce((a, b) => a + Number(b.net_balance || b.balance || 0), 0))}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Total Customer Receivables</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUpRight size={18} color="#fb7185" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fb7185' }}>
              {fmtINR(suppRows.reduce((a, b) => a + Number(b.net_balance || b.balance || 0), 0))}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Total Supplier Payables</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setTab('receivables')}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none',
              background: tab === 'receivables' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
              color: tab === 'receivables' ? '#38bdf8' : '#94a3b8',
              fontWeight: tab === 'receivables' ? '700' : '500', cursor: 'pointer', fontSize: '13px'
            }}
          >
            Customer Receivables ({custRows.length})
          </button>
          <button
            onClick={() => setTab('payables')}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none',
              background: tab === 'payables' ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.04)',
              color: tab === 'payables' ? '#fb7185' : '#94a3b8',
              fontWeight: tab === 'payables' ? '700' : '500', cursor: 'pointer', fontSize: '13px'
            }}
          >
            Supplier Payables ({suppRows.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search party by name/phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: '#f1f5f9', fontSize: '12px', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading outstanding balances...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', color: '#64748b' }}>
          No records matching search.
        </div>
      ) : (
        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px', overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Party Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>Contact</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8' }}>City / Address</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>Net Outstanding</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const bal = Number(row.net_balance || row.balance || row.outstanding || 0);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#f1f5f9' }}>
                      {row.name}
                      {row.gst_number && (
                        <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>GSTIN: {row.gst_number}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{row.phone || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{row.address || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: bal > 0 ? (tab === 'receivables' ? '#38bdf8' : '#fb7185') : '#34d399' }}>
                      {fmtINR(bal)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => onSelectPartyForLedger(tab === 'receivables' ? 'CUSTOMER' : 'SUPPLIER', row.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '6px', padding: '4px 8px', color: '#cbd5e1', fontSize: '11px',
                            cursor: 'pointer', fontWeight: '600'
                          }}
                        >
                          <BookOpen size={11} /> Ledger
                        </button>
                        {tab === 'receivables' && bal > 0 && (
                          <button
                            onClick={() => handleSendReminder(row)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: 'rgba(37, 211, 102, 0.15)', border: '1px solid rgba(37, 211, 102, 0.3)',
                              borderRadius: '6px', padding: '4px 8px', color: '#25D366', fontSize: '11px',
                              cursor: 'pointer', fontWeight: '700'
                            }}
                          >
                            <MessageCircle size={11} /> Remind
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main ManagerPanel Component ───────────────────────────────────────────────
export default function ManagerPanel({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modal, setModal] = useState(null); // 'purchase' | 'production' | 'consumption' | 'sales' | 'payment-customer' | 'payment-supplier' | null
  const [invoiceSaleId, setInvoiceSaleId] = useState(null);

  const [entries, setEntries] = useState({
    purchases: [],
    productions: [],
    sales: [],
    consumptions: [],
    payments: []
  });
  const [loading, setLoading] = useState(false);
  const [todayStats, setTodayStats] = useState(null);

  const managerName = user?.managerName || user?.display_name || user?.name || 'Manager';

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ managerName }).toString();
      const [purchases, productions, sales, consumptions, payments] = await Promise.all([
        api.getPurchases(params).catch(() => []),
        api.getProductions(params).catch(() => []),
        api.getSales(params).catch(() => []),
        api.getConsumptionBatches().catch(() => []),
        api.getPayments().catch(() => [])
      ]);

      const myConsumptions = (consumptions || []).filter(c => !c.manager_name || c.manager_name === managerName || c.created_by === managerName);
      const myPayments = (payments || []).filter(p => !p.manager_name || p.manager_name === managerName || p.created_by === managerName);

      setEntries({
        purchases: purchases || [],
        productions: productions || [],
        sales: sales || [],
        consumptions: myConsumptions,
        payments: myPayments
      });

      // Compute today's stats locally
      const today = new Date().toISOString().split('T')[0];
      const todayPurchases = (purchases || []).filter(p => p.date === today && !p.is_voided);
      const todayProductions = (productions || []).filter(p => p.date === today && !p.is_voided);
      const todaySales = (sales || []).filter(s => s.date === today && !s.is_voided);
      const todayPayments = myPayments.filter(p => p.date === today && !p.is_voided);

      setTodayStats({
        purchases: todayPurchases.length,
        purchaseKg: todayPurchases.reduce((a, p) => a + (p.quantity_kg || 0), 0),
        productions: todayProductions.length,
        productionKg: todayProductions.reduce((a, p) => a + (p.total_finished_kg || 0), 0),
        sales: todaySales.length,
        salesKg: todaySales.reduce((a, s) => a + (s.quantity_kg || 0), 0),
        salesAmount: todaySales.reduce((a, s) => a + (s.total_amount || 0), 0),
        payments: todayPayments.length,
      });
    } catch (err) {
      console.error('Error loading manager entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleEntrySuccess = () => {
    setModal(null);
    loadEntries();
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', background: '#0a0f1d',
      color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <aside style={{
        width: '235px', flexShrink: 0,
        background: 'rgba(8,15,30,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 10px',
        display: 'flex', flexDirection: 'column', gap: '3px',
        overflowY: 'auto'
      }}>
        {/* Manager badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px', marginBottom: '8px',
          background: 'rgba(168,85,247,0.1)',
          border: '1px solid rgba(168,85,247,0.2)', borderRadius: '10px'
        }}>
          <UserCheck size={16} color="#c084fc" />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#c084fc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {managerName}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>MANAGER · ENTRY ONLY</div>
          </div>
        </div>

        {/* Navigation */}
        <NavItem icon={BarChart2}    label="Dashboard"             active={activeTab === 'dashboard'}     onClick={() => setActiveTab('dashboard')} />
        <NavItem icon={ShoppingBag} label="Raw Material Purchases" active={activeTab === 'purchases'}   onClick={() => setActiveTab('purchases')} badge={entries.purchases.length || undefined} />
        <NavItem icon={Layers}      label="Material Issues (RM)"   active={activeTab === 'consumptions'}  onClick={() => setActiveTab('consumptions')} badge={entries.consumptions.length || undefined} />
        <NavItem icon={Factory}     label="Daily Production"      active={activeTab === 'productions'}   onClick={() => setActiveTab('productions')} badge={entries.productions.length || undefined} />
        <NavItem icon={Truck}       label="Sales & Tax Invoices"   active={activeTab === 'sales'}         onClick={() => setActiveTab('sales')} badge={entries.sales.length || undefined} />
        <NavItem icon={CreditCard}  label="Receipts & Payments"    active={activeTab === 'payments'}      onClick={() => setActiveTab('payments')} badge={entries.payments.length || undefined} />

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 4px' }} />

        {/* New additions: Party Ledgers, Outstanding, Masters */}
        <NavItem icon={BookOpen}      label="Party Ledgers"          active={activeTab === 'ledger'}        onClick={() => setActiveTab('ledger')} />
        <NavItem icon={ClipboardList} label="Outstanding Summary"    active={activeTab === 'outstanding'}   onClick={() => setActiveTab('outstanding')} />
        <NavItem icon={Building2}     label="Masters (Create Only)"  active={activeTab === 'masters'}       onClick={() => setActiveTab('masters')} />

        <div style={{ flex: 1 }} />

        {/* Strict Entry Only Mode Notice */}
        <div style={{
          padding: '10px 12px', background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px',
          fontSize: '11px', color: '#94a3b8', lineHeight: 1.5, marginTop: '8px'
        }}>
          <div style={{ color: '#f59e0b', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <ShieldCheck size={13} /> Strict Entry-Only Mode
          </div>
          Create purchases, production batches, sales invoices, receipts, and master records. All modifications and inventory stock view are restricted to the Factory Owner.
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

        {/* ─── DASHBOARD ─── */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
                  Welcome, {managerName.split(' ')[0]} 👋
                </h2>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                  Here is your entry summary for today, {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button
                onClick={loadEntries}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '7px 12px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer'
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {/* Quick Action Grid */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Quick Create Entries
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <button
                  onClick={() => setModal('purchase')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.25)',
                    background: 'rgba(56,189,248,0.08)', color: '#38bdf8', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <Plus size={16} /> + RM Purchase
                </button>
                <button
                  onClick={() => setModal('consumption')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.25)',
                    background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <Plus size={16} /> + Issue RM Material
                </button>
                <button
                  onClick={() => setModal('production')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.25)',
                    background: 'rgba(168,85,247,0.08)', color: '#c084fc', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <Plus size={16} /> + Daily Production
                </button>
                <button
                  onClick={() => setModal('sales')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.25)',
                    background: 'rgba(52,211,153,0.08)', color: '#34d399', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <Plus size={16} /> + Sales & Invoice
                </button>
                <button
                  onClick={() => setModal('payment-customer')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.25)',
                    background: 'rgba(99,102,241,0.08)', color: '#818cf8', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <Plus size={16} /> + Customer Receipt
                </button>
              </div>
            </div>

            {/* Today's Stats Cards */}
            {todayStats && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Today's Entries Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <StatCard label="Purchases Logged" value={todayStats.purchases} unit="entries" icon={ShoppingBag} color="#38bdf8" />
                  <StatCard label="RM Received" value={fmt(todayStats.purchaseKg)} unit="KG" icon={Package} color="#38bdf8" />
                  <StatCard label="Production Runs" value={todayStats.productions} unit="batches" icon={Factory} color="#c084fc" />
                  <StatCard label="Finished Output" value={fmt(todayStats.productionKg)} unit="KG" icon={Layers} color="#c084fc" />
                  <StatCard label="Invoices Created" value={todayStats.sales} unit="invoices" icon={Truck} color="#34d399" />
                  <StatCard label="Sales Volume" value={fmt(todayStats.salesKg)} unit="KG" icon={FileText} color="#34d399" />
                </div>
              </div>
            )}

            {/* Recent Entries */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Your Latest Entries
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {entries.sales.slice(0, 3).map(s => (
                  <EntryRow
                    key={s.id}
                    label={`Sale: ${s.customer_name || 'Customer'}`}
                    sub={`Inv: ${s.invoice_number || s.sale_code} · ${fmt(s.quantity_kg)} KG`}
                    date={s.date}
                    badge={`₹${fmt(s.total_amount)}`}
                    badgeColor="#34d399"
                    onAction={() => setInvoiceSaleId(s.id)}
                    actionLabel="GST Bill"
                  />
                ))}
                {entries.purchases.slice(0, 3).map(p => (
                  <EntryRow
                    key={p.id}
                    label={`Purchase: ${p.supplier_name || 'Supplier'}`}
                    sub={`${p.material_name} · ${fmt(p.quantity_kg)} ${p.unit || 'KG'}`}
                    date={p.date}
                    badge={`₹${fmt(p.total_amount)}`}
                    badgeColor="#38bdf8"
                  />
                ))}
                {entries.productions.slice(0, 3).map(p => (
                  <EntryRow
                    key={p.id}
                    label={`Production: ${p.finished_product_name || 'Tripal'}`}
                    sub={`Batch: ${p.production_code} · Shift: ${p.shift_name || '—'}`}
                    date={p.date}
                    badge={`${fmt(p.total_finished_kg)} KG`}
                    badgeColor="#c084fc"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── PURCHASES TAB ─── */}
        {activeTab === 'purchases' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Raw Material Purchases</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Records entered under your account</p>
              </div>
              <button
                onClick={() => setModal('purchase')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <Plus size={15} /> New RM Purchase
              </button>
            </div>
            {entries.purchases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>No purchases logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.purchases.map(p => (
                  <div key={p.id} style={{
                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>{p.supplier_name || 'Supplier'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                        Code: <strong style={{ color: '#cbd5e1' }}>{p.purchase_code}</strong> · {p.material_name} · {fmt(p.quantity_kg)} {p.unit || 'KG'} @ ₹{p.rate_per_kg}/{p.unit || 'KG'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>₹{fmt(p.total_amount)}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{p.date} · {p.payment_mode || 'Credit'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── CONSUMPTIONS TAB ─── */}
        {activeTab === 'consumptions' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Material Issues (RM Consumption)</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Raw materials issued to production floor</p>
              </div>
              <button
                onClick={() => setModal('consumption')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Issue RM Material
              </button>
            </div>
            {entries.consumptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>No material issues logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.consumptions.map(c => {
                  const batchCode = c.batch_no || c.batch_code || `#${c.id}`;
                  const totalKg = c.total_issued_kg ?? (c.items ? c.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0);
                  return (
                    <div key={c.id} style={{
                      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px', padding: '14px 18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                    }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>Batch: {batchCode}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                          Machine: <strong style={{ color: '#cbd5e1' }}>{c.machine_name || 'Machine'}</strong> · Shift: {c.shift_name || '—'} · Status: {c.status || 'Issued'}
                        </div>
                        {c.items && c.items.length > 0 && (
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                            Materials: {c.items.map(it => `${it.raw_material_name || 'Material'} (${fmt(it.quantity)} ${it.unit || 'KG'})`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>{fmt(totalKg)} KG</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── PRODUCTIONS TAB ─── */}
        {activeTab === 'productions' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Daily Production Batches</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Finished output batches recorded under your account</p>
              </div>
              <button
                onClick={() => setModal('production')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <Plus size={15} /> New Production Batch
              </button>
            </div>
            {entries.productions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>No production batches logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.productions.map(p => (
                  <div key={p.id} style={{
                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>{p.finished_product_name || 'Tripal'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                        Batch: <strong style={{ color: '#cbd5e1' }}>{p.production_code}</strong> · Machine: {p.machine_name || '—'} · Shift: {p.shift_name || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#c084fc' }}>{fmt(p.total_finished_kg)} KG</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{p.date} · {p.rolls_count || 0} Rolls</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── SALES TAB ─── */}
        {activeTab === 'sales' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Sales & Tax Invoices</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Dispatch orders, generate GST tax invoices, E-Invoice & E-Way bills</p>
              </div>
              <button
                onClick={() => setModal('sales')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <Plus size={15} /> New Sales Invoice
              </button>
            </div>
            {entries.sales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>No sales logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.sales.map(s => (
                  <div key={s.id} style={{
                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{s.customer_name || 'Customer'}</span>
                        <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: '5px', fontFamily: 'monospace' }}>
                          {s.invoice_number || s.sale_code}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {fmt(s.quantity_kg)} KG · {s.payment_type || 'Credit'} · {s.date}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#34d399' }}>₹{fmt(s.total_amount)}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Rate: ₹{s.rate_per_kg}/KG</div>
                      </div>
                      <button
                        onClick={() => setInvoiceSaleId(s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                          borderRadius: '8px', padding: '7px 12px', color: '#38bdf8', fontSize: '12px',
                          cursor: 'pointer', fontWeight: '700'
                        }}
                      >
                        <FileText size={14} /> Tax Bill & E-Way
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── PAYMENTS TAB ─── */}
        {activeTab === 'payments' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Receipts & Payments</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Cash, UPI, Cheque, and Bank transfers logged under your account</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setModal('payment-customer')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '8px 14px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Customer Receipt
                </button>
                <button
                  onClick={() => setModal('payment-supplier')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '8px 14px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Supplier Payment
                </button>
              </div>
            </div>
            {entries.payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>No receipts or payments logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.payments.map(p => {
                  const isReceipt = (p.party_type === 'CUSTOMER');
                  return (
                    <div key={p.id} style={{
                      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px', padding: '14px 18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#e2e8f0' }}>{p.payment_code}</span>
                          <span style={{
                            fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                            background: isReceipt ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                            color: isReceipt ? '#34d399' : '#fb7185'
                          }}>
                            {isReceipt ? 'CUSTOMER RECEIPT' : 'SUPPLIER PAYMENT'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                            {p.payment_mode}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                          Party: <strong style={{ color: '#cbd5e1' }}>{p.party_name || 'Party'}</strong> · Date: {p.date}
                          {p.reference_no ? ` · Ref: ${p.reference_no}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '16px', fontWeight: '700',
                          color: isReceipt ? '#34d399' : '#fb7185'
                        }}>
                          {isReceipt ? '+' : '-'}₹{fmt(p.amount)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{p.remarks || '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── PARTY LEDGER VIEW ─── */}
        {activeTab === 'ledger' && (
          <LedgerView onViewInvoice={(saleId) => setInvoiceSaleId(saleId)} />
        )}

        {/* ─── OUTSTANDING VIEW ─── */}
        {activeTab === 'outstanding' && (
          <OutstandingView
            onSelectPartyForLedger={(partyType, id) => {
              setActiveTab('ledger');
            }}
          />
        )}

        {/* ─── MASTERS VIEW (CREATE ONLY) ─── */}
        {activeTab === 'masters' && (
          <ManagerMasters managerName={managerName} />
        )}

      </main>

      {/* Entry Modals */}
      {modal === 'purchase' && (
        <PurchaseEntryModal
          isOpen={true}
          managerName={managerName}
          onClose={() => setModal(null)}
          onSuccess={handleEntrySuccess}
        />
      )}
      {modal === 'consumption' && (
        <ConsumptionEntryModal
          isOpen={true}
          managerName={managerName}
          onClose={() => setModal(null)}
          onSuccess={handleEntrySuccess}
        />
      )}
      {modal === 'production' && (
        <ProductionEntryModal
          isOpen={true}
          managerName={managerName}
          onClose={() => setModal(null)}
          onSuccess={handleEntrySuccess}
        />
      )}
      {modal === 'sales' && (
        <SalesEntryModal
          isOpen={true}
          managerName={managerName}
          onClose={() => setModal(null)}
          onSuccess={handleEntrySuccess}
        />
      )}
      {(modal === 'payment-customer' || modal === 'payment-supplier') && (
        <PaymentEntryModal
          isOpen={true}
          defaultType={modal === 'payment-customer' ? 'CUSTOMER' : 'SUPPLIER'}
          managerName={managerName}
          onClose={() => setModal(null)}
          onSuccess={handleEntrySuccess}
        />
      )}

      {/* Dedicated GST Tax Invoice Modal (With Bill Print, E-Invoice, E-Way Bill & WhatsApp) */}
      <TaxInvoiceModal
        isOpen={!!invoiceSaleId}
        saleId={invoiceSaleId}
        onClose={() => setInvoiceSaleId(null)}
      />
    </div>
  );
}
