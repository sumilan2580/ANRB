import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, Layers, Users, UserCheck, Cpu, Clock,
  ShoppingBag, Factory, Truck, Warehouse, BookOpen, Scale, FileBarChart,
  Activity, Settings, ChevronRight, ChevronDown, CreditCard, Calendar, CalendarDays
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import MastersPage from './MastersPage';
import TransactionsPage from './TransactionsPage';
import StockLedger from './StockLedger';
import StockReconciliation from './StockReconciliation';
import ReportsPage from './ReportsPage';
import ManagerActivityReport from './ManagerActivityReport';
import AccountsPage from './AccountsPage';
import AttendanceView from '../AttendanceView';
import { api } from '../../api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, section: null },

  { section: 'Masters', id: 'masters', label: 'All Masters', icon: <Settings size={16} /> },

  { section: 'Manufacturing Flow', id: 'orders', label: 'Production Orders', icon: <Layers size={16} /> },
  { id: 'consumption', label: 'Material Issue Batches', icon: <Layers size={16} /> },
  { id: 'purchases', label: 'Raw Material Purchase', icon: <ShoppingBag size={16} /> },
  { id: 'production', label: 'Production Batches', icon: <Factory size={16} /> },
  { id: 'sales', label: 'Sales & Invoices', icon: <Truck size={16} /> },

  { section: 'Inventory', id: 'stock-ledger', label: 'Stock Ledger', icon: <BookOpen size={16} /> },
  { id: 'reconciliation', label: 'Stock Reconciliation', icon: <Scale size={16} /> },

  { section: 'Accounts', id: 'accounts', label: 'Ledger & Payments', icon: <CreditCard size={16} /> },

  { section: 'HR & Staff', id: 'attendance', label: 'Staff Attendance', icon: <CalendarDays size={16} /> },

  { section: 'Reports', id: 'reports', label: 'Production & Sales', icon: <FileBarChart size={16} /> },
  { id: 'manager-activity', label: 'Manager Activity', icon: <Activity size={16} /> },
];

export default function AdminPanel() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [financialYears, setFinancialYears] = useState([]);
  const [activeFy, setActiveFy] = useState('');

  useEffect(() => {
    loadFinancialYears();
  }, []);

  async function loadFinancialYears() {
    try {
      const list = await api.getFinancialYears();
      setFinancialYears(list || []);
      const active = (list || []).find(fy => fy.is_active);
      if (active) {
        setActiveFy(active.name);
      } else if (list && list.length > 0) {
        setActiveFy(list[0].name);
      }
    } catch (err) {
      console.error('Failed to load financial years:', err);
    }
  }

  async function handleSwitchFy(fyCode) {
    try {
      await api.setActiveFinancialYear(fyCode);
      setActiveFy(fyCode);
      await loadFinancialYears();
    } catch (err) {
      alert('Error activating Financial Year: ' + err.message);
    }
  }

  // Map nav IDs to transaction tabs where needed
  function renderContent() {
    switch (activeNav) {
      case 'dashboard': return <AdminDashboard />;
      case 'masters': return <MastersPage />;
      case 'orders': return <TransactionsPage defaultTab="orders" />;
      case 'consumption': return <TransactionsPage defaultTab="consumption" />;
      case 'purchases': return <TransactionsPage defaultTab="purchases" />;
      case 'production': return <TransactionsPage defaultTab="production" />;
      case 'sales': return <TransactionsPage defaultTab="sales" />;
      case 'stock-ledger': return <StockLedger />;
      case 'reconciliation': return <StockReconciliation />;
      case 'accounts': return <AccountsPage activeFinancialYear={activeFy} onRefreshFy={loadFinancialYears} />;
      case 'attendance': return <AttendanceView mode="admin" markerName="Admin" />;
      case 'reports': return <ReportsPage />;
      case 'manager-activity': return <ManagerActivityReport />;
      default: return <AdminDashboard />;
    }
  }

  let currentSection = '';

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={12} style={{ color: 'var(--primary)' }} /> Financial Year
          </div>
          <select
            className="form-select"
            style={{ fontSize: '12px', padding: '4px 8px', width: '100%', height: 'auto', background: 'var(--bg-dark)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}
            value={activeFy}
            onChange={e => handleSwitchFy(e.target.value)}
          >
            {financialYears.length === 0 ? (
              <option value="">No FY created yet</option>
            ) : financialYears.map(fy => (
              <option key={fy.id} value={fy.name}>
                {fy.name} {fy.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item, idx) => {
            const sectionChanged = item.section && item.section !== currentSection;
            if (item.section) currentSection = item.section;

            return (
              <React.Fragment key={item.id}>
                {sectionChanged && (
                  <div className="sidebar-group-title">{item.section}</div>
                )}
                <button
                  className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
                  onClick={() => setActiveNav(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {activeNav === item.id && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-dim)' }}>
          <div style={{ fontWeight: '700', color: 'var(--text-muted)', marginBottom: '2px' }}>TRIPAL ERP</div>
          <div>Admin Web Panel v1.0</div>
          <div style={{ marginTop: '4px', color: 'var(--emerald)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--emerald)' }} />
            Active FY: {activeFy}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">
        {renderContent()}
      </main>
    </div>
  );
}
