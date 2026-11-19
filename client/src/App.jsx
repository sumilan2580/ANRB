import React, { useState, useEffect } from 'react';
import { LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import AdminPanel from './components/AdminPanel/AdminPanel';
import AdminLogin from './components/AdminPanel/AdminLogin';
import ManagerPanel from './components/AdminPanel/ManagerPanel';
import SuspendedDemoPage from './components/SuspendedPage/SuspendedDemoPage';
import { session, api } from './api';

function checkSuspended() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  // Only show suspended page if explicitly requested via /suspended or #suspended
  return path === '/suspended' || hash === '#suspended';
}

export default function App() {
  const [isSuspendedView, setIsSuspendedView] = useState(checkSuspended);

  useEffect(() => {
    const handleRoute = () => {
      setIsSuspendedView(checkSuspended());
    };

    if (!checkSuspended()) {
      document.title = 'TRIPAL ERP | Industrial Manufacturing System';
      const link = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284c7'%3E%3Cpath d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z'/%3E%3C/svg%3E";
      }
    }

    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);
    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
    };
  }, []);

  const [user, setUser] = useState(() => {
    // Read from new tripal_session key (set by updated login)
    const s = session.get();
    if (s && s.user && s.token) return s.user;
    // Legacy fallback for existing admin sessions stored under old key
    try {
      const old = localStorage.getItem('tripal_admin_user');
      if (old) {
        const u = JSON.parse(old);
        const oldToken = localStorage.getItem('tripal_admin_token');
        if (oldToken) {
          // Migrate to new session format
          session.set({ token: oldToken, user: { ...u, role: u.role || 'admin' } });
          localStorage.removeItem('tripal_admin_user');
          localStorage.removeItem('tripal_admin_token');
          return { ...u, role: u.role || 'admin' };
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  const handleLoginSuccess = (userData, token) => {
    session.set({ token, user: userData });
    setUser(userData);
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    session.clear();
    setUser(null);
  };

  // Dedicated Suspended Page View
  if (isSuspendedView) {
    return (
      <SuspendedDemoPage
        onUnlockAdmin={() => {
          setIsSuspendedView(false);
        }}
      />
    );
  }

  // Not logged in — show unified login screen
  if (!user) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';

  // Role badge styling
  const badgeStyle = isAdmin
    ? { background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.25)', color: '#38bdf8' }
    : { background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.25)', color: '#c084fc' };

  const RoleIcon = isAdmin ? ShieldCheck : UserCheck;
  const roleLabel = isAdmin ? 'ADMIN' : 'MANAGER';

  return (
    <div className="app-wrapper">
      {/* Global Top Bar */}
      <header className="global-top-bar">
        <div className="brand-badge">
          <div className="brand-icon-box">T</div>
          <div className="brand-info">
            <h1>TRIPAL ERP</h1>
            <span>Manufacturing Management System</span>
          </div>
        </div>

        <div className="top-bar-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Role + User Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12.5px',
              fontWeight: '600',
              ...badgeStyle
            }}>
              <RoleIcon size={14} />
              <span>{user.name || user.username || roleLabel}</span>
              <span style={{
                fontSize: '11px',
                color: 'var(--text-dim)',
                background: 'rgba(255,255,255,0.06)',
                padding: '1px 6px',
                borderRadius: '4px'
              }}>
                {roleLabel}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="btn btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                color: '#fb7185',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Logout"
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Render panel based on role */}
      {isAdmin && <AdminPanel />}
      {isManager && <ManagerPanel user={user} onLogout={handleLogout} />}
    </div>
  );
}
