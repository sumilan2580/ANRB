import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, RefreshCw, Package, Layers, Users, UserCheck,
  Cpu, Clock, AlertTriangle, Building2, Save, Key, ShieldCheck, UserPlus,
  Lock, ChevronDown, DollarSign, ClipboardList, ShoppingBag, Factory,
  Truck, CreditCard, CalendarDays, BookOpen, CheckSquare, Square, Sliders,
  CheckCircle2, ShieldAlert
} from 'lucide-react';
import { api } from '../../api';

export const MANAGER_SECTIONS = [
  { key: 'orders', label: 'Production Orders', icon: ClipboardList, desc: 'Customer production orders entry & tracking' },
  { key: 'purchases', label: 'RM Purchases', icon: ShoppingBag, desc: 'Raw material purchase invoices entry' },
  { key: 'consumptions', label: 'Material Issues (RM)', icon: Layers, desc: 'Raw materials issued to machines / production floor' },
  { key: 'productions', label: 'Daily Production', icon: Factory, desc: 'Daily finished goods production batches' },
  { key: 'sales', label: 'Sales & Invoices', icon: Truck, desc: 'Sales invoices, dispatch & billing entries' },
  { key: 'payments', label: 'Receipts & Payments', icon: CreditCard, desc: 'Cash & bank receipts, payments, expense & side income' },
  { key: 'attendance', label: 'Staff Attendance', icon: CalendarDays, desc: 'Daily factory staff attendance marking' },
  { key: 'ledger', label: 'Party Ledgers', icon: BookOpen, desc: 'Customer, supplier, expense & income ledgers' },
  { key: 'outstanding', label: 'Outstanding Summary', icon: Clock, desc: 'Customer & supplier balances and dues summary' },
  { key: 'masters', label: 'Masters (Create Only)', icon: Building2, desc: 'Create customers, suppliers, products, expense heads' }
];

// ─── Searchable Combobox (inline for MastersPage) ───────────────────────────
function SearchableSelect({ value, onChange, options, placeholder = 'Search or type...', required = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options;
  const displayLabel = options.find(o => o.value === value)?.label || value || '';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={open ? query : displayLabel}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder={placeholder}
          required={required && !value}
          className="form-input"
          style={{ paddingRight: '32px' }}
        />
        <ChevronDown size={14} color="var(--text-dim)" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '8px', marginTop: '3px', maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
        }}>
          {filtered.length === 0 && query && (
            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
              onMouseDown={() => { onChange(query); setOpen(false); setQuery(''); }}>
              ✚ Use "{query}" as custom colour
            </div>
          )}
          {filtered.map(opt => (
            <div key={opt.value} onMouseDown={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px',
                color: opt.value === value ? 'var(--primary)' : 'var(--text-main)',
                background: opt.value === value ? 'rgba(99,102,241,0.1)' : 'transparent',
                borderBottom: '1px solid var(--border-color)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = opt.value === value ? 'rgba(99,102,241,0.1)' : 'transparent'}
            >{opt.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Generic add/edit modal
function MasterModal({ isOpen, title, fields, initialData, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (isOpen) {
      const defaults = {};
      fields.forEach(f => {
        defaults[f.key] =
          (initialData && initialData[f.key] !== undefined && initialData[f.key] !== null)
            ? String(initialData[f.key])
            : (f.defaultValue || '');
      });
      setFormData(defaults);
      setError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>
                {error}
              </div>
            )}
            <div className="form-grid">
              {fields.map(f => (
                <div key={f.key} className={`form-group ${f.fullWidth ? 'full-width' : ''}`}>
                  <label className="form-label">{f.label}</label>
                  {f.type === 'select' ? (
                    <div style={{ position: 'relative' }}>
                      <select
                        className="form-select"
                        value={formData[f.key] || ''}
                        onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                        required={f.required}
                        style={{ paddingRight: '32px', appearance: 'none' }}
                      >
                        {f.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color="var(--text-dim)" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  ) : f.type === 'combobox' ? (
                    <SearchableSelect
                      value={formData[f.key] || ''}
                      onChange={v => setFormData({ ...formData, [f.key]: v })}
                      options={f.options || []}
                      placeholder={f.placeholder || 'Search or type custom...'}
                      required={f.required}
                    />
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      rows="2"
                      value={formData[f.key] || ''}
                      onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder || ''}
                      required={f.required}
                    />
                  ) : (
                    <input
                      type={f.type || 'text'}
                      className="form-input"
                      value={formData[f.key] || ''}
                      onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder || ''}
                      required={f.required}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
            <AlertTriangle size={18} /> Confirm Delete
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text-main)' }}>{itemLabel}</strong>?
            <br />
            <span style={{ fontSize: '12px', color: 'var(--rose)' }}>
              Records with existing transactions cannot be deleted and will be deactivated instead.
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
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small icon action button
function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
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

// ============================================================
//  Masters Page with tabs
// ============================================================
export default function MastersPage() {
  const [tab, setTab]                     = useState('raw-materials');
  const [rawMaterials, setRawMaterials]   = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [customers, setCustomers]         = useState([]);
  const [suppliers, setSuppliers]         = useState([]);
  const [machines, setMachines]           = useState([]);
  const [shifts, setShifts]               = useState([]);
  const [managers, setManagers]           = useState([]);
  const [staff, setStaff]                 = useState([]);
  const [bankAccounts, setBankAccounts]   = useState([]);
  const [expenseHeads, setExpenseHeads]   = useState([]);
  const [managerUsers, setManagerUsers]   = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserData, setNewUserData]     = useState({ username: '', password: '', display_name: '', phone: '', permissions: MANAGER_SECTIONS.map(s => s.key) });
  const [userLoading, setUserLoading]     = useState(false);
  const [userError, setUserError]         = useState('');
  const [resetPwdUser, setResetPwdUser]   = useState(null);
  const [newPassword, setNewPassword]     = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  // Manager Permissions modal
  const [permissionsTarget, setPermissionsTarget]     = useState(null); // web user or floor manager
  const [permissionsType, setPermissionsType]         = useState('web'); // 'web' | 'floor'
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading]   = useState(false);
  const [permissionsError, setPermissionsError]       = useState('');
  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    company_gstin: '',
    company_state: '',
    company_state_code: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_branch: ''
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [successMsg, setSuccessMsg]       = useState('');
  // Add / Edit modal
  const [showModal, setShowModal]         = useState(false);
  const [editRecord, setEditRecord]       = useState(null); // null = add mode
  // Delete confirm
  const [deleteTarget, setDeleteTarget]   = useState(null); // { id, label }
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      // 1. Try single consolidated request first (fastest, 1 connection, no concurrency limit risk)
      try {
        const data = await api.getAllMasters();
        if (data && (data.rawMaterials || data.customers || data.finishedGoods)) {
          setRawMaterials(data.rawMaterials || []);
          setFinishedGoods(data.finishedGoods || []);
          setCustomers(data.customers || []);
          setSuppliers(data.suppliers || []);
          setMachines(data.machines || []);
          setShifts(data.shifts || []);
          setManagers(data.managers || []);
          if (data.staff) setStaff(data.staff);
          setBankAccounts(data.bankAccounts || []);
          if (data.expenseHeads) setExpenseHeads(data.expenseHeads);
          else api.getExpenseHeads().then(setExpenseHeads).catch(() => []);
          setManagerUsers(data.managerUsers || []);
          if (data.companySettings) {
            setCompanySettings(prev => ({ ...prev, ...data.companySettings }));
          }
          return;
        }
      } catch (singleErr) {
        console.warn('Consolidated masters fetch failed, using fallback:', singleErr.message);
      }

      // 2. Resilient fallback with safe individual catch handlers
      const [rm, fg, cust, supp, mach, sh, mgrs, banks, comp, mgrUsers, stf, eh] = await Promise.all([
        api.getRawMaterials().catch(() => []),
        api.getFinishedGoods().catch(() => []),
        api.getCustomers().catch(() => []),
        api.getSuppliers().catch(() => []),
        api.getMachines().catch(() => []),
        api.getShifts().catch(() => []),
        api.getManagers().catch(() => []),
        api.getBankAccounts().catch(() => []),
        api.getCompanySettings().catch(() => ({})),
        api.getManagerUsers().catch(() => []),
        api.getStaff().catch(() => []),
        api.getExpenseHeads().catch(() => [])
      ]);
      setRawMaterials(rm || []);
      setFinishedGoods(fg || []);
      setCustomers(cust || []);
      setSuppliers(supp || []);
      setMachines(mach || []);
      setShifts(sh || []);
      setManagers(mgrs || []);
      setBankAccounts(banks || []);
      setExpenseHeads(eh || []);
      setManagerUsers(mgrUsers || []);
      setStaff(stf || []);
      if (comp) {
        setCompanySettings(prev => ({ ...prev, ...comp }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load master records');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateManagerUser = async (e) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password) {
      setUserError('Username and password are required');
      return;
    }
    setUserLoading(true);
    setUserError('');
    try {
      await api.createManagerUser(newUserData);
      setShowUserModal(false);
      setNewUserData({ username: '', password: '', display_name: '', phone: '', permissions: MANAGER_SECTIONS.map(s => s.key) });
      showSuccess('Manager web login account created successfully!');
      await loadAll();
    } catch (err) {
      setUserError(err.message || 'Failed to create manager user');
    } finally {
      setUserLoading(false);
    }
  };

  const openPermissionsModal = (target, type = 'web') => {
    setPermissionsTarget(target);
    setPermissionsType(type);
    setPermissionsError('');
    const existing = Array.isArray(target.permissions) && target.permissions.length > 0
      ? target.permissions
      : MANAGER_SECTIONS.map(s => s.key);
    setSelectedPermissions(existing);
  };

  const handleSavePermissions = async () => {
    if (!permissionsTarget) return;
    if (selectedPermissions.length === 0) {
      setPermissionsError('Please select at least 1 section/module for the manager.');
      return;
    }
    setPermissionsLoading(true);
    setPermissionsError('');
    try {
      if (permissionsType === 'web') {
        await api.updateManagerUserPermissions(permissionsTarget.id, selectedPermissions);
      } else {
        await api.updateManagerPermissions(permissionsTarget.id, selectedPermissions);
      }
      showSuccess(`Permissions updated successfully for "${permissionsTarget.display_name || permissionsTarget.name || permissionsTarget.username}"! (${selectedPermissions.length} sections active)`);
      setPermissionsTarget(null);
      await loadAll();
    } catch (err) {
      setPermissionsError(err.message || 'Failed to update permissions');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateManagerUserStatus(user.id, nextStatus);
      showSuccess(`Manager account ${user.username} status set to ${nextStatus}`);
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setUserError('Password must be at least 4 characters');
      return;
    }
    setUserLoading(true);
    setUserError('');
    try {
      await api.resetManagerUserPassword(resetPwdUser.id, newPassword);
      setResetPwdUser(null);
      setNewPassword('');
      showSuccess(`Password for "${resetPwdUser.username}" reset successfully!`);
    } catch (err) {
      setUserError(err.message || 'Failed to reset password');
    } finally {
      setUserLoading(false);
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setUserLoading(true);
    try {
      await api.deleteManagerUser(deleteUserTarget.id);
      setDeleteUserTarget(null);
      showSuccess(`Manager login account "${deleteUserTarget.username}" deleted`);
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
      setDeleteUserTarget(null);
    } finally {
      setUserLoading(false);
    }
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const res = await api.updateCompanySettings(companySettings);
      if (res && res.settings) {
        setCompanySettings(prev => ({ ...prev, ...res.settings }));
      }
      showSuccess('Company profile and tax settings saved successfully!');
    } catch (err) {
      setError(err.message || 'Failed to save company settings');
    } finally {
      setSavingCompany(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const toggleStatus = async (type, id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      if (type === 'rm')       await api.updateRawMaterial(id, { status: newStatus });
      if (type === 'fg')       await api.updateFinishedGood(id, { status: newStatus });
      if (type === 'customer') await api.updateCustomer(id, { status: newStatus });
      if (type === 'supplier') await api.updateSupplier(id, { status: newStatus });
      if (type === 'machine')  await api.updateMachine(id, { status: newStatus });
      if (type === 'manager')  await api.updateManagerStatus(id, newStatus);
      if (type === 'staff')    await api.updateStaff(id, { status: newStatus });
      if (type === 'expense-head') await api.updateExpenseHead(id, { status: newStatus });
      await loadAll();
      showSuccess(`Status updated to ${newStatus}`);
    } catch (err) {
      setError(err.message);
    }
  };

  // Map a DB row to form field keys for editing
  const editFieldMap = (record) => {
    if (!record) return {};
    if (tab === 'raw-materials')  return { name: record.name, category: record.category, unit: record.unit, minStockAlert: record.min_stock_alert, hsnCode: record.hsn_code || '3901', gstPercent: record.gst_percent || '18' };
    if (tab === 'finished-goods') return { productName: record.product_name, gsm: record.gsm, widthSize: record.width_size, lengthVal: record.length_val, colour: record.colour, grade: record.grade, minStockAlert: record.min_stock_alert, hsnCode: record.hsn_code || '3926', gstPercent: record.gst_percent || '18' };
    if (tab === 'customers')      return { name: record.name, phone: record.phone, address: record.address, gstNumber: record.gst_number, remarks: record.remarks };
    if (tab === 'suppliers')      return { name: record.name, phone: record.phone, address: record.address, gstNumber: record.gst_number };
    if (tab === 'machines')       return { name: record.name, capacityKgPerDay: record.capacity_kg_per_day };
    if (tab === 'shifts')         return { name: record.name, startTime: record.start_time, endTime: record.end_time };
    if (tab === 'managers')       return { name: record.name, phone: record.phone };
    if (tab === 'staff')          return { name: record.name, designation: record.designation || '', department: record.department || '', phone: record.phone || '', status: record.status || 'active' };
    if (tab === 'expense-heads')  return { name: record.name, type: record.type, category: record.category, description: record.description, status: record.status };
    return {};
  };

  const openEdit = (record) => { setEditRecord(record); setShowModal(true); };
  const openAdd  = () => { setEditRecord(null); setShowModal(true); };

  // Submit handler (Add or Edit)
  const handleSubmit = async (data) => {
    if (editRecord) {
      if (tab === 'raw-materials')  await api.updateRawMaterial(editRecord.id, data);
      else if (tab === 'finished-goods') await api.updateFinishedGood(editRecord.id, data);
      else if (tab === 'customers')      await api.updateCustomer(editRecord.id, data);
      else if (tab === 'suppliers')      await api.updateSupplier(editRecord.id, data);
      else if (tab === 'machines')       await api.updateMachine(editRecord.id, data);
      else if (tab === 'shifts')         await api.updateShift(editRecord.id, data);
      else if (tab === 'managers')       await api.updateManager(editRecord.id, data);
      else if (tab === 'banks')          await api.updateBankAccount(editRecord.id, data);
      else if (tab === 'staff')          await api.updateStaff(editRecord.id, data);
      else if (tab === 'expense-heads')  await api.updateExpenseHead(editRecord.id, data);
      showSuccess('Record updated successfully!');
    } else {
      if (tab === 'raw-materials')  await api.createRawMaterial(data);
      else if (tab === 'finished-goods') await api.createFinishedGood(data);
      else if (tab === 'customers')      await api.createCustomer(data);
      else if (tab === 'suppliers')      await api.createSupplier(data);
      else if (tab === 'machines')       await api.createMachine(data);
      else if (tab === 'shifts')         await api.createShift(data);
      else if (tab === 'managers')       await api.createManager(data);
      else if (tab === 'banks')          await api.createBankAccount(data);
      else if (tab === 'staff')          await api.createStaff(data);
      else if (tab === 'expense-heads')  await api.createExpenseHead(data);
      showSuccess('Record added successfully!');
    }
    await loadAll();
  };

  const confirmDelete = (id, label) => setDeleteTarget({ id, label });

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { id } = deleteTarget;
      if (tab === 'raw-materials')  await api.deleteRawMaterial(id);
      else if (tab === 'finished-goods') await api.deleteFinishedGood(id);
      else if (tab === 'customers')      await api.deleteCustomer(id);
      else if (tab === 'suppliers')      await api.deleteSupplier(id);
      else if (tab === 'machines')       await api.deleteMachine(id);
      else if (tab === 'shifts')         await api.deleteShift(id);
      else if (tab === 'managers')       await api.deleteManager(id);
      else if (tab === 'banks')          await api.deleteBankAccount(id);
      else if (tab === 'staff')          await api.deleteStaff(id);
      else if (tab === 'expense-heads')  await api.deleteExpenseHead(id);
      setDeleteTarget(null);
      await loadAll();
      showSuccess('Record deleted (or deactivated) successfully!');
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const TABS = [
    { id: 'raw-materials', label: 'Raw Materials', icon: <Layers size={14} />, count: rawMaterials.length },
    { id: 'finished-goods', label: 'Finished Goods', icon: <Package size={14} />, count: finishedGoods.length },
    { id: 'customers', label: 'Customers', icon: <Users size={14} />, count: customers.length },
    { id: 'suppliers', label: 'Suppliers', icon: <UserCheck size={14} />, count: suppliers.length },
    { id: 'banks', label: 'Bank Master', icon: <Building2 size={14} />, count: bankAccounts.length },
    { id: 'expense-heads', label: 'Expense & Income Heads', icon: <DollarSign size={14} />, count: expenseHeads.length },
    { id: 'machines', label: 'Machines', icon: <Cpu size={14} />, count: machines.length },
    { id: 'shifts', label: 'Shifts', icon: <Clock size={14} />, count: shifts.length },
    { id: 'staff', label: 'Staff', icon: <Users size={14} />, count: staff.length },
    { id: 'managers', label: 'Managers', icon: <Users size={14} />, count: managers.length + managerUsers.length },
    { id: 'company', label: 'Company & Tax Settings', icon: <Building2 size={14} /> },
  ];

  const bankFields = [
    { key: 'bankName', label: 'Bank Name *', placeholder: 'e.g. State Bank of India', required: true },
    { key: 'accountName', label: 'Account Holder Name *', placeholder: 'e.g. Tripal Mfg Private Limited', required: true },
    { key: 'accountNumber', label: 'Account Number *', placeholder: 'e.g. 38492019284', required: true },
    { key: 'ifsc', label: 'IFSC Code *', placeholder: 'e.g. SBIN0001234', required: true },
    { key: 'branch', label: 'Branch Name', placeholder: 'e.g. Main Branch, Halol' },
    { key: 'openingBalance', label: 'Opening Balance (₹)', type: 'number', defaultValue: '0', placeholder: '0.00' },
    { key: 'openingBalanceType', label: 'Opening Type', type: 'select', defaultValue: 'Dr', options: [
      { value: 'Dr', label: 'Debit (Dr) — Positive Balance' },
      { value: 'Cr', label: 'Credit (Cr) — Overdraft' }
    ]},
    { key: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]}
  ];

  const rmFields = [
    { key: 'name', label: 'Material Name *', placeholder: 'e.g. LDPE Virgin Grade', required: true },
    { key: 'category', label: 'Category *', type: 'select', required: true, defaultValue: 'Polymer', options: [
      { value: 'Polymer', label: 'Polymer' },
      { value: 'Masterbatch', label: 'Masterbatch' },
      { value: 'Additive', label: 'Additive' },
      { value: 'Pigment', label: 'Pigment' },
      { value: 'Other', label: 'Other' },
    ]},
    { key: 'unit', label: 'Unit (माप की इकाई) *', type: 'select', required: true, defaultValue: 'KG', options: [
      { value: 'KG', label: 'KG — किलोग्राम' },
      { value: 'PCS', label: 'PCS — पीस / नग' },
      { value: 'Litre', label: 'Litre — लीटर' },
      { value: 'Meter', label: 'Meter — मीटर' },
      { value: 'Bag', label: 'Bag — बोरी / बैग' },
      { value: 'Roll', label: 'Roll — रोल' },
    ]},
    { key: 'hsnCode', label: 'HSN Code', defaultValue: '3901', placeholder: '3901' },
    { key: 'gstPercent', label: 'GST %', type: 'select', defaultValue: '18', options: [
      { value: '0', label: '0% (Exempt)' },
      { value: '5', label: '5%' },
      { value: '12', label: '12%' },
      { value: '18', label: '18%' },
      { value: '28', label: '28%' },
    ]},
    { key: 'minStockAlert', label: 'Min Stock Alert', type: 'number', defaultValue: '1000', placeholder: '1000' },
  ];

  const fgFields = [
    { key: 'productName', label: 'Product Name', defaultValue: 'Tripal', placeholder: 'Tripal' },
    { key: 'gsm', label: 'GSM *', type: 'number', required: true, placeholder: 'e.g. 150' },
    { key: 'widthSize', label: 'Width/Size *', required: true, placeholder: 'e.g. 16 FT' },
    { key: 'lengthVal', label: 'Length', placeholder: 'e.g. 100 M' },
    { key: 'colour', label: 'Colour *', required: true, type: 'combobox', defaultValue: 'ORANGE/BLUE', options: [
      { value: 'ORANGE/BLUE', label: 'ORANGE/BLUE' },
      { value: 'SILVER/BLACK', label: 'SILVER/BLACK' },
      { value: 'GREEN/BLACK', label: 'GREEN/BLACK' },
      { value: 'SILVER/WHITE', label: 'SILVER/WHITE' },
      { value: 'WHITE/WHITE', label: 'WHITE/WHITE' },
      { value: 'BLUE/BLUE', label: 'BLUE/BLUE' },
      { value: 'BLACK/BLACK', label: 'BLACK/BLACK' },
      { value: 'ORANGE/NAVY BLUE', label: 'ORANGE/NAVY BLUE' },
    ]},
    { key: 'grade', label: 'Grade', defaultValue: 'Grade A', type: 'select', options: [
      { value: 'Grade A', label: 'Grade A' },
      { value: 'Heavy Duty', label: 'Heavy Duty' },
      { value: 'Standard', label: 'Standard' },
      { value: 'Export Quality', label: 'Export Quality' },
    ]},
    { key: 'hsnCode', label: 'HSN Code', defaultValue: '3926', placeholder: '3926' },
    { key: 'gstPercent', label: 'GST %', type: 'select', defaultValue: '18', options: [
      { value: '0', label: '0% (Exempt)' },
      { value: '5', label: '5%' },
      { value: '12', label: '12%' },
      { value: '18', label: '18%' },
      { value: '28', label: '28%' },
    ]},
    { key: 'minStockAlert', label: 'Min Stock Alert (KG)', type: 'number', defaultValue: '500', placeholder: '500' },
  ];

  const custFields = [
    { key: 'name', label: 'Customer Name *', required: true, placeholder: 'e.g. Kisan Agro Traders' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98200 12345' },
    { key: 'address', label: 'Address', placeholder: 'City, State' },
    { key: 'gstNumber', label: 'GST Number', placeholder: '24AAAXX0000X1Z0' },
    { key: 'remarks', label: 'Remarks', fullWidth: true, placeholder: 'Optional notes about customer' },
  ];

  const suppFields = [
    { key: 'name', label: 'Supplier Name *', required: true, placeholder: 'e.g. Reliance Polymers' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98200 12345' },
    { key: 'address', label: 'Address', placeholder: 'Industrial area, City' },
    { key: 'gstNumber', label: 'GST Number', placeholder: '24AAAXX0000X1Z0' },
  ];

  const machFields = [
    { key: 'name', label: 'Machine Name *', required: true, placeholder: 'e.g. Extruder Line 3' },
    { key: 'capacityKgPerDay', label: 'Capacity KG/Day', type: 'number', defaultValue: '5000', placeholder: '5000' },
  ];

  const shiftFields = [
    { key: 'name', label: 'Shift Name *', required: true, placeholder: 'e.g. Morning Shift' },
    { key: 'startTime', label: 'Start Time', placeholder: '08:00 AM' },
    { key: 'endTime', label: 'End Time', placeholder: '04:00 PM' },
  ];

  const mgrFields = [
    { key: 'name', label: 'Manager Name *', required: true, placeholder: 'e.g. Ramesh Kumar' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98200 12345' },
  ];

  const staffFields = [
    { key: 'name', label: 'Staff Name *', required: true, placeholder: 'e.g. Ramesh Kumar' },
    { key: 'designation', label: 'Designation', placeholder: 'e.g. Machine Operator / Helper' },
    { key: 'department', label: 'Department', placeholder: 'e.g. Production / Maintenance / Packaging' },
    { key: 'phone', label: 'Phone Number', placeholder: '+91 98200 12345' },
    { key: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]}
  ];

  const expenseHeadFields = [
    { key: 'name', label: 'Head / Account Name *', placeholder: 'e.g. Factory Electricity Bill, Diesel Fuel, Scrap Sale', required: true },
    { key: 'type', label: 'Type (प्रकार) *', type: 'select', defaultValue: 'EXPENSE', required: true, options: [
      { value: 'EXPENSE', label: 'EXPENSE (खर्चा)' },
      { value: 'INCOME', label: 'INCOME (साइड आमदनी / Scrap Sale)' }
    ]},
    { key: 'category', label: 'Category / Group', type: 'select', defaultValue: 'Direct Expense', options: [
      { value: 'Direct Expense', label: 'Direct Expense (सीधा फैक्ट्री खर्च)' },
      { value: 'Indirect Expense', label: 'Indirect Expense (ऑफिस/प्रशासनिक खर्च)' },
      { value: 'Side Income', label: 'Side Income (स्क्रैप/अतिरिक्त आमदनी)' },
      { value: 'Other', label: 'Other' }
    ]},
    { key: 'description', label: 'Description / Notes', placeholder: 'Optional details about this head' },
    { key: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]}
  ];

  const currentFields = () => {
    if (tab === 'raw-materials')  return rmFields;
    if (tab === 'finished-goods') return fgFields;
    if (tab === 'customers')      return custFields;
    if (tab === 'suppliers')      return suppFields;
    if (tab === 'banks')          return bankFields;
    if (tab === 'expense-heads')  return expenseHeadFields;
    if (tab === 'machines')       return machFields;
    if (tab === 'shifts')         return shiftFields;
    if (tab === 'managers')       return mgrFields;
    if (tab === 'staff')          return staffFields;
    return [];
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Masters Management</h2>
          <p>Manage raw materials, finished goods, customers, suppliers, machines, shifts, and manager web accounts</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadAll}>
            <RefreshCw size={14} /> Refresh
          </button>
          {tab === 'managers' && (
            <button className="btn btn-primary" onClick={() => { setShowUserModal(true); setUserError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={14} /> Create Web Account
            </button>
          )}
          {tab !== 'company' && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={14} /> Add New {tab === 'managers' ? 'Floor Manager' : ''}
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
          ✓ {successMsg}
        </div>
      )}
      {error && (
        <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`mode-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: '10px' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tables per tab */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="animate-spin" style={{ marginRight: '8px' }} />
            Loading...
          </div>
        ) : tab === 'raw-materials' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
                <th>Min Alert</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map(rm => (
                <tr key={rm.id}>
                  <td><span className="pill pill-cyan num-mono">{rm.code}</span></td>
                  <td style={{ fontWeight: '600' }}>{rm.name}</td>
                  <td><span className="pill pill-indigo">{rm.category}</span></td>
                  <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700', color: rm.current_stock_kg <= rm.min_stock_alert ? 'var(--amber)' : 'var(--text-main)' }}>
                    {rm.current_stock_kg?.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>{rm.unit || 'KG'}</span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rm.min_stock_alert?.toLocaleString()} {rm.unit || 'KG'}</td>
                  <td>
                    <span className={`pill ${rm.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{rm.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus('rm', rm.id, rm.status)}>
                        {rm.status === 'active' ? 'Deact.' : 'Activate'}
                      </button>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...rm, ...editFieldMap(rm) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(rm.id, rm.name)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'finished-goods' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th>GSM</th>
                <th>Size</th>
                <th>Colour</th>
                <th>Grade</th>
                <th style={{ textAlign: 'right' }}>Stock KG</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {finishedGoods.map(fg => (
                <tr key={fg.id}>
                  <td><span className="pill pill-cyan num-mono">{fg.product_code}</span></td>
                  <td style={{ fontWeight: '600' }}>{fg.product_name}</td>
                  <td className="num-mono" style={{ fontWeight: '700' }}>{fg.gsm}</td>
                  <td>{fg.width_size}</td>
                  <td>{fg.colour}</td>
                  <td><span className="pill pill-indigo" style={{ fontSize: '10px' }}>{fg.grade}</span></td>
                  <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700' }}>{fg.current_stock_kg?.toLocaleString()}</td>
                  <td><span className={`pill ${fg.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{fg.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus('fg', fg.id, fg.status)}>
                        {fg.status === 'active' ? 'Deact.' : 'Activate'}
                      </button>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...fg, ...editFieldMap(fg) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(fg.id, `${fg.product_name} (${fg.gsm}GSM)`)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'customers' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>GST</th>
                <th style={{ textAlign: 'right' }}>Total KG</th>
                <th style={{ textAlign: 'right' }}>Revenue ₹</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: '600' }}>{c.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.phone}</td>
                  <td><span className="pill pill-indigo" style={{ fontSize: '10px' }}>{c.gst_number || '—'}</span></td>
                  <td className="num-mono" style={{ textAlign: 'right' }}>{c.total_purchased_kg?.toLocaleString()}</td>
                  <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)', fontWeight: '600' }}>₹{c.total_sales_amount?.toLocaleString('en-IN')}</td>
                  <td><span className={`pill ${c.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{c.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus('customer', c.id, c.status)}>
                        {c.status === 'active' ? 'Deact.' : 'Activate'}
                      </button>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...c, ...editFieldMap(c) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(c.id, c.name)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'suppliers' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Phone</th>
                <th>GST</th>
                <th style={{ textAlign: 'right' }}>Total Supplied KG</th>
                <th style={{ textAlign: 'right' }}>Total Amount ₹</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: '600' }}>{s.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.phone}</td>
                  <td><span className="pill pill-indigo" style={{ fontSize: '10px' }}>{s.gst_number || '—'}</span></td>
                  <td className="num-mono" style={{ textAlign: 'right' }}>{s.total_supplied_kg?.toLocaleString()}</td>
                  <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>₹{s.total_purchase_amount?.toLocaleString('en-IN')}</td>
                  <td><span className={`pill ${s.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{s.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus('supplier', s.id, s.status)}>
                        {s.status === 'active' ? 'Deact.' : 'Activate'}
                      </button>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...s, ...editFieldMap(s) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(s.id, s.name)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'banks' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Bank Name</th>
                <th>Account Holder Name</th>
                <th>Account Number</th>
                <th>IFSC</th>
                <th>Branch</th>
                <th style={{ textAlign: 'right' }}>Opening Balance ₹</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bankAccounts.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No bank accounts configured</td></tr>
              ) : bankAccounts.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: '600', color: '#38bdf8' }}>{b.bank_name}</td>
                  <td style={{ fontWeight: '500' }}>{b.account_name}</td>
                  <td><span className="pill pill-indigo num-mono" style={{ fontSize: '11px' }}>{b.account_number}</span></td>
                  <td><span className="pill pill-cyan num-mono" style={{ fontSize: '11px' }}>{b.ifsc}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{b.branch || '—'}</td>
                  <td className="num-mono" style={{ textAlign: 'right', fontWeight: '700' }}>
                    ₹{Number(b.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {b.opening_balance_type || 'Dr'}
                  </td>
                  <td>
                    <span className={`pill ${b.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{b.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({
                        id: b.id,
                        bankName: b.bank_name,
                        accountName: b.account_name,
                        accountNumber: b.account_number,
                        ifsc: b.ifsc,
                        branch: b.branch,
                        openingBalance: b.opening_balance,
                        openingBalanceType: b.opening_balance_type,
                        status: b.status
                      })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(b.id, `${b.bank_name} (${b.account_number})`)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'expense-heads' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Head / Account Name</th>
                <th>Type</th>
                <th>Category / Group</th>
                <th>Description / Details</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenseHeads.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No expense or income heads configured</td></tr>
              ) : expenseHeads.map(eh => (
                <tr key={eh.id}>
                  <td><span className="pill pill-cyan num-mono">{eh.code}</span></td>
                  <td style={{ fontWeight: '600' }}>{eh.name}</td>
                  <td>
                    <span className={`pill ${eh.type === 'INCOME' ? 'pill-emerald' : 'pill-rose'}`} style={{ fontWeight: '700' }}>
                      {eh.type === 'INCOME' ? 'INCOME (आमदनी)' : 'EXPENSE (खर्चा)'}
                    </span>
                  </td>
                  <td><span className="pill pill-indigo" style={{ fontSize: '11px' }}>{eh.category || 'Direct Expense'}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px' }}>{eh.description || '—'}</td>
                  <td>
                    <span
                      className={`pill ${eh.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleStatus('expense-head', eh.id, eh.status)}
                      title="Click to toggle status"
                    >
                      {eh.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus('expense-head', eh.id, eh.status)}>
                        {eh.status === 'active' ? 'Deact.' : 'Activate'}
                      </button>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...eh, ...editFieldMap(eh) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(eh.id, eh.name)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'machines' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Machine Name</th>
                <th>Capacity KG/Day</th>
                <th>Total Batches</th>
                <th style={{ textAlign: 'right' }}>Total Produced</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.map(m => (
                <tr key={m.id}>
                  <td><span className="pill pill-cyan num-mono">{m.machine_code}</span></td>
                  <td style={{ fontWeight: '600' }}>{m.name}</td>
                  <td className="num-mono">{m.capacity_kg_per_day?.toLocaleString()}</td>
                  <td className="num-mono" style={{ textAlign: 'center' }}>{m.total_batches}</td>
                  <td className="num-mono" style={{ textAlign: 'right', color: 'var(--emerald)' }}>{m.total_produced_kg?.toLocaleString()} KG</td>
                  <td><span className={`pill ${m.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{m.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus('machine', m.id, m.status)}>
                        {m.status === 'active' ? 'Deact.' : 'Activate'}
                      </button>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...m, ...editFieldMap(m) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(m.id, m.name)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'shifts' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Shift Name</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: '600' }}>{s.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.start_time}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.end_time}</td>
                  <td><span className={`pill ${s.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{s.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...s, ...editFieldMap(s) })} />
                      <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(s.id, s.name)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'staff' ? (
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No staff members added yet. Click "Add New" to add staff.
                  </td>
                </tr>
              ) : (
                staff.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '600' }}>{s.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.designation || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.department || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.phone || '—'}</td>
                    <td>
                      <span
                        className={`pill ${s.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleStatus('staff', s.id, s.status)}
                        title="Click to toggle status"
                      >
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...s, ...editFieldMap(s) })} />
                        <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(s.id, s.name)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : tab === 'managers' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Section 1: Manager Web ERP Login Accounts */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                    Manager Web ERP Accounts (Role: Manager)
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    These user accounts log into this Web ERP portal. They have <strong>Entry-Only permissions</strong> (Purchases, Productions, Sales, Invoicing, Receipts). Any Edit or Delete is strictly blocked by API.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setShowUserModal(true); setUserError(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={14} /> Create Web Account
                </button>
              </div>

              {managerUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No Manager Web Accounts created yet. Click "Create Web Account" above to add a login for floor managers.
                </div>
              ) : (
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Display Name</th>
                      <th>Role</th>
                      <th>Assigned Sections</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerUsers.map(u => {
                      const activeCount = Array.isArray(u.permissions) ? u.permissions.length : 10;
                      const isFull = activeCount === MANAGER_SECTIONS.length;
                      return (
                        <tr key={u.id}>
                          <td>
                            <span className="num-mono" style={{ fontWeight: '700', color: 'var(--primary)' }}>
                              {u.username}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>{u.display_name || '—'}</td>
                          <td>
                            <span className="pill pill-cyan" style={{ fontSize: '10px' }}>
                              ENTRY ONLY
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => openPermissionsModal(u, 'web')}
                              style={{
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isFull ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.15)',
                                color: isFull ? '#34d399' : '#f59e0b',
                                border: isFull ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                              title="Click to customize accessible sections"
                            >
                              <ShieldCheck size={13} />
                              {activeCount} / {MANAGER_SECTIONS.length} Sections
                            </button>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                          <td>
                            <span className={`pill ${u.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>
                              {u.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            {new Date(u.created_at).toLocaleDateString('en-IN')}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc', borderColor: 'rgba(168,85,247,0.3)' }}
                                title="Configure Accessible Sections"
                                onClick={() => openPermissionsModal(u, 'web')}
                              >
                                <ShieldCheck size={11} /> Sections
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: u.status === 'active' ? '#ff6b81' : '#2ed573',
                                  borderColor: u.status === 'active' ? 'rgba(255,107,129,0.3)' : 'rgba(46,213,115,0.3)',
                                  background: 'transparent'
                                }}
                                onClick={() => toggleUserStatus(u)}
                              >
                                {u.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Reset Password"
                                onClick={() => { setResetPwdUser(u); setNewPassword(''); setUserError(''); }}
                              >
                                <Key size={11} /> Reset Pwd
                              </button>
                              <ActionBtn
                                icon={<Trash2 size={12} />}
                                color="var(--rose)"
                                title="Delete Web User"
                                onClick={() => setDeleteUserTarget(u)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Section 2: Factory Floor Managers Activity & Profiles */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} style={{ color: 'var(--cyan)' }} />
                    Factory Floor Managers & Production Records
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tracks floor shift managers linked with machine production batches, purchases, and sales.
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={openAdd}>
                  <Plus size={14} /> Add Floor Manager
                </button>
              </div>

              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Manager Name</th>
                    <th>Device ID</th>
                    <th>Assigned Sections</th>
                    <th>Phone</th>
                    <th>Purchase Count</th>
                    <th>Production Count</th>
                    <th>Sales Count</th>
                    <th style={{ textAlign: 'right' }}>Total Production KG</th>
                    <th>Status</th>
                    <th>Since</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(m => {
                    const activeCount = Array.isArray(m.permissions) ? m.permissions.length : 10;
                    const isFull = activeCount === MANAGER_SECTIONS.length;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', color: '#fff', flexShrink: 0 }}>
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: '600' }}>{m.name}</span>
                          </div>
                        </td>
                        <td><span className="num-mono pill pill-indigo" style={{ fontSize: '10px' }}>{m.device_id || '—'}</span></td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openPermissionsModal(m, 'floor')}
                            style={{
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              background: isFull ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.15)',
                              color: isFull ? '#34d399' : '#f59e0b',
                              border: isFull ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Click to customize accessible sections"
                          >
                            <ShieldCheck size={12} />
                            {activeCount} / {MANAGER_SECTIONS.length}
                          </button>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.phone || '—'}</td>
                        <td className="num-mono" style={{ textAlign: 'center' }}>{m.purchase_count}</td>
                        <td className="num-mono" style={{ textAlign: 'center' }}>{m.production_count}</td>
                        <td className="num-mono" style={{ textAlign: 'center' }}>{m.sales_count}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: 'var(--cyan)' }}>{m.total_production_kg?.toLocaleString()}</td>
                        <td><span className={`pill ${m.status === 'active' ? 'pill-emerald' : 'pill-rose'}`}>{m.status}</span></td>
                        <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{new Date(m.created_at).toLocaleDateString('en-IN')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc', borderColor: 'rgba(168,85,247,0.3)' }}
                              title="Configure Accessible Sections"
                              onClick={() => openPermissionsModal(m, 'floor')}
                            >
                              <ShieldCheck size={11} /> Sections
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                color: m.status === 'active' ? '#ff6b81' : '#2ed573',
                                borderColor: m.status === 'active' ? 'rgba(255,107,129,0.3)' : 'rgba(46,213,115,0.3)',
                                background: 'transparent'
                              }}
                              onClick={() => toggleStatus('manager', m.id, m.status)}
                            >
                              {m.status === 'active' ? 'Deact.' : 'Activate'}
                            </button>
                            <ActionBtn icon={<Edit2 size={12} />} color="var(--primary)" title="Edit" onClick={() => openEdit({ ...m, ...editFieldMap(m) })} />
                            <ActionBtn icon={<Trash2 size={12} />} color="var(--rose)" title="Delete" onClick={() => confirmDelete(m.id, m.name)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'company' ? (
          <div style={{ padding: '24px', maxWidth: '840px', margin: '0 auto' }}>
            <form onSubmit={handleSaveCompany}>
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} style={{ color: 'var(--primary)' }} /> Factory / Company Legal Information
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  This information appears on Tax Invoices, Delivery Challans, E-Way Bills, and E-Invoice NIC payloads.
                </p>
              </div>

              <div className="form-grid" style={{ marginBottom: '24px' }}>
                <div className="form-group full-width">
                  <label className="form-label">Legal Company Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companySettings.company_name || ''}
                    onChange={e => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                    required
                    placeholder="e.g. TRIPAL MANUFACTURING PVT. LTD."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company GSTIN *</label>
                  <input
                    type="text"
                    className="form-input num-mono"
                    value={companySettings.company_gstin || ''}
                    onChange={e => setCompanySettings({ ...companySettings, company_gstin: e.target.value.toUpperCase() })}
                    required
                    placeholder="24AAACT1234F1Z5"
                    maxLength={15}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State & State Code *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={companySettings.company_state || ''}
                      onChange={e => setCompanySettings({ ...companySettings, company_state: e.target.value })}
                      required
                      placeholder="State (e.g. Gujarat)"
                    />
                    <input
                      type="text"
                      className="form-input num-mono"
                      value={companySettings.company_state_code || ''}
                      onChange={e => setCompanySettings({ ...companySettings, company_state_code: e.target.value })}
                      required
                      placeholder="Code (24)"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Official Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companySettings.company_phone || ''}
                    onChange={e => setCompanySettings({ ...companySettings, company_phone: e.target.value })}
                    placeholder="+91 79 2583 0000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Accounts / Billing Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={companySettings.company_email || ''}
                    onChange={e => setCompanySettings({ ...companySettings, company_email: e.target.value })}
                    placeholder="accounts@tripalmanufacturing.com"
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Registered Factory & Billing Address *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={companySettings.company_address || ''}
                    onChange={e => setCompanySettings({ ...companySettings, company_address: e.target.value })}
                    required
                    placeholder="Plot / Survey No., GIDC Industrial Estate, City, State - PIN"
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Bank Account Details (Printed on Invoices for Customer NEFT / RTGS)
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Printed on computer generated sales invoices so customers can pay directly into this account.
                </p>
              </div>

              <div className="form-grid" style={{ marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companySettings.bank_name || ''}
                    onChange={e => setCompanySettings({ ...companySettings, bank_name: e.target.value })}
                    placeholder="State Bank of India"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bank Account Number</label>
                  <input
                    type="text"
                    className="form-input num-mono"
                    value={companySettings.bank_account_no || ''}
                    onChange={e => setCompanySettings({ ...companySettings, bank_account_no: e.target.value })}
                    placeholder="382910482910"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bank IFSC Code</label>
                  <input
                    type="text"
                    className="form-input num-mono"
                    value={companySettings.bank_ifsc || ''}
                    onChange={e => setCompanySettings({ ...companySettings, bank_ifsc: e.target.value.toUpperCase() })}
                    placeholder="SBIN0001234"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companySettings.bank_branch || ''}
                    onChange={e => setCompanySettings({ ...companySettings, bank_branch: e.target.value })}
                    placeholder="Vatva Industrial Estate Branch"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCompany}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '14px' }}
                >
                  <Save size={16} />
                  {savingCompany ? 'Saving Settings...' : 'Save Company Profile'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {/* Add / Edit Modal */}
      <MasterModal
        isOpen={showModal}
        title={editRecord ? `Edit ${TABS.find(t => t.id === tab)?.label}` : `Add New ${TABS.find(t => t.id === tab)?.label}`}
        fields={currentFields()}
        initialData={editRecord ? editFieldMap(editRecord) : null}
        onClose={() => { setShowModal(false); setEditRecord(null); }}
        onSubmit={handleSubmit}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemLabel={deleteTarget?.label}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        loading={deleteLoading}
      />

      {/* Create Manager User Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                Create Web Manager Login
              </h3>
              <button className="modal-close-btn" onClick={() => setShowUserModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateManagerUser}>
              <div className="modal-body">
                {userError && (
                  <div style={{ padding: '10px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>
                    {userError}
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Username (Login ID) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUserData.username}
                    onChange={e => setNewUserData({ ...newUserData, username: e.target.value })}
                    placeholder="e.g. manager1"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newUserData.password}
                    onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Set login password"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Display / Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUserData.display_name}
                    onChange={e => setNewUserData({ ...newUserData, display_name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUserData.phone}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    placeholder="+91 98200 12345"
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: '700' }}>
                      Accessible Sections ({newUserData.permissions?.length || 0}/{MANAGER_SECTIONS.length})
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setNewUserData({ ...newUserData, permissions: MANAGER_SECTIONS.map(s => s.key) })}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '11px', cursor: 'pointer', fontWeight: '600', padding: 0 }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUserData({ ...newUserData, permissions: [] })}
                        style={{ background: 'none', border: 'none', color: 'var(--rose)', fontSize: '11px', cursor: 'pointer', fontWeight: '600', padding: 0 }}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px',
                    maxHeight: '160px', overflowY: 'auto', padding: '8px',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px'
                  }}>
                    {MANAGER_SECTIONS.map(sec => {
                      const active = (newUserData.permissions || []).includes(sec.key);
                      return (
                        <div
                          key={sec.key}
                          onClick={() => {
                            const cur = newUserData.permissions || [];
                            const next = cur.includes(sec.key) ? cur.filter(k => k !== sec.key) : [...cur, sec.key];
                            setNewUserData({ ...newUserData, permissions: next });
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                            fontSize: '11px', fontWeight: '600',
                            background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                            border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.05)',
                            color: active ? '#c084fc' : 'var(--text-dim)'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{sec.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ padding: '10px', background: 'rgba(56,189,248,0.08)', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.2)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  ℹ️ This account will log into the Web ERP with <strong>Manager role (Entry-Only mode)</strong>. Modifying or deleting records is strictly forbidden by server.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUserModal(false)} disabled={userLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={userLoading}>
                  {userLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Manager Password Modal */}
      {resetPwdUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} style={{ color: 'var(--primary)' }} />
                Reset Manager Password
              </h3>
              <button className="modal-close-btn" onClick={() => setResetPwdUser(null)}>&times;</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                {userError && (
                  <div style={{ padding: '10px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px', marginBottom: '12px', fontSize: '12.5px' }}>
                    {userError}
                  </div>
                )}
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Set a new password for <strong style={{ color: 'var(--text-main)' }}>{resetPwdUser.username}</strong> ({resetPwdUser.display_name || 'Manager'}).
                </p>
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter at least 4 characters"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setResetPwdUser(null)} disabled={userLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={userLoading}>
                  {userLoading ? 'Saving...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Web User Modal */}
      {deleteUserTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          itemLabel={`Manager Login Account "${deleteUserTarget.username}"`}
          onClose={() => setDeleteUserTarget(null)}
          onConfirm={executeDeleteUser}
          loading={userLoading}
        />
      )}

      {/* Configure Manager Permissions Modal */}
      {permissionsTarget && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.2))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: '#9333ea',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    Assign Sections: {permissionsTarget.display_name || permissionsTarget.name || permissionsTarget.username}
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    Enable or deactivate sections for this manager. Only checked sections will appear in their panel.
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setPermissionsTarget(null)}>&times;</button>
            </div>

            <div className="modal-body">
              {permissionsError && (
                <div style={{ padding: '10px 12px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '8px', marginBottom: '14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} />
                  <span>{permissionsError}</span>
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '14px', padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#e2e8f0' }}>
                  Active Sections: <span style={{ color: '#c084fc', fontWeight: '800' }}>{selectedPermissions.length}</span> of {MANAGER_SECTIONS.length}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions(MANAGER_SECTIONS.map(s => s.key))}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions([])}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--rose)', borderColor: 'rgba(244,63,94,0.3)' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px',
                maxHeight: '400px', overflowY: 'auto', paddingRight: '4px'
              }}>
                {MANAGER_SECTIONS.map(sec => {
                  const Icon = sec.icon;
                  const isChecked = selectedPermissions.includes(sec.key);
                  return (
                    <div
                      key={sec.key}
                      onClick={() => {
                        setSelectedPermissions(prev =>
                          prev.includes(sec.key) ? prev.filter(k => k !== sec.key) : [...prev, sec.key]
                        );
                      }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isChecked ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.02)',
                        border: isChecked ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isChecked ? '0 4px 14px rgba(168,85,247,0.12)' : 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#9333ea', transform: 'scale(1.15)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon size={14} color={isChecked ? '#c084fc' : '#64748b'} />
                          <span style={{ fontSize: '13px', fontWeight: '700', color: isChecked ? '#f8fafc' : '#94a3b8' }}>
                            {sec.label}
                          </span>
                          <span style={{
                            marginLeft: 'auto', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px',
                            background: isChecked ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                            color: isChecked ? '#34d399' : '#64748b'
                          }}>
                            {isChecked ? 'ACTIVE' : 'OFF'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', lineHeight: 1.4 }}>
                          {sec.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                marginTop: '14px', padding: '10px 12px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.4
              }}>
                ⚠️ <strong>Note:</strong> When a section is deactivated, it disappears from this manager's left sidebar, all quick-action buttons on their dashboard are removed, and server-side direct entry to that module is strictly blocked.
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPermissionsTarget(null)}
                disabled={permissionsLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={permissionsLoading}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                  color: '#fff', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}
              >
                {permissionsLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {permissionsLoading ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
