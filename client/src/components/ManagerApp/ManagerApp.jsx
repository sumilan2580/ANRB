import React, { useState, useEffect } from 'react';
import { ShoppingBag, Factory, Truck, User, AlertTriangle } from 'lucide-react';
import { api } from '../../api';
import ManagerSetupModal from './ManagerSetupModal';
import PurchaseEntryModal from './PurchaseEntryModal';
import ProductionEntryModal from './ProductionEntryModal';
import SalesEntryModal from './SalesEntryModal';

export default function ManagerApp() {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('tripal_manager_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [isDeactivated, setIsDeactivated] = useState(false);

  useEffect(() => {
    // If no profile saved yet, open setup modal automatically
    if (!profile || !profile.name) {
      setShowSetupModal(true);
    } else {
      checkStatus();
    }
  }, [profile]);

  async function checkStatus() {
    try {
      await api.getRawMaterials();
      setIsDeactivated(false);
    } catch (err) {
      if (err.message && err.message.includes('deactivated')) {
        setIsDeactivated(true);
      }
    }
  }

  return (
    <div className="mobile-view-container">
      <div className="phone-simulator-frame">
        {/* Notch / Speaker for phone realism */}
        <div className="phone-notch">
          <div className="notch-speaker"></div>
          <div className="notch-camera"></div>
        </div>

        {/* Mobile App Header */}
        <div className="mobile-app-header">
          <div className="mobile-app-brand">
            <div className="brand-icon-box" style={{ width: '28px', height: '28px', fontSize: '13px', borderRadius: '7px' }}>
              T
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', lineHeight: 1.1 }}>TRIPAL MOBILE</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>MANAGER CONSOLE</div>
            </div>
          </div>

          {/* Fixed Immutable Manager Badge - No switch button */}
          <div
            className="manager-active-badge"
            style={{ cursor: 'default' }}
            title="Permanent Manager Binding"
          >
            <User size={12} />
            <span>{profile?.name || 'Enter Name'}</span>
          </div>
        </div>

        {/* Mobile App Body Content */}
        <div className="mobile-app-content">
          {/* Active Manager Card (Read-only, no Switch option) */}
          <div className="mobile-manager-bar" style={{ cursor: 'default' }}>
            <div className="mobile-manager-info">
              <div className="mobile-avatar">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#fff' }}>
                  {profile?.name ? `Logged in: ${profile.name}` : 'Setup Manager Profile'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Device: {profile?.deviceId ? `#${profile.deviceId.slice(-6)}` : 'First launch setup'}
                </div>
              </div>
            </div>
          </div>

          {isDeactivated && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '12px', color: '#fca5a5', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Account Deactivated</strong><br />
                Your account has been deactivated by Admin. New transaction entries are blocked.
              </div>
            </div>
          )}

          {/* Entry Options (Strictly 3 actions: Purchase, Production, Sales) */}
          <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginTop: '4px', marginBottom: '10px' }}>
            Manager Operations (Entry Only)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. Purchase Button */}
            <button
              className="mobile-action-card"
              onClick={() => !isDeactivated && setShowPurchaseModal(true)}
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '14px',
                padding: '18px 16px',
                opacity: isDeactivated ? 0.5 : 1
              }}
            >
              <div className="mobile-action-icon" style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)', width: '44px', height: '44px', borderRadius: '12px' }}>
                <ShoppingBag size={22} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>New Purchase</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Log raw material delivery</div>
              </div>
            </button>

            {/* 2. Production Button */}
            <button
              className="mobile-action-card"
              onClick={() => !isDeactivated && setShowProductionModal(true)}
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '14px',
                padding: '18px 16px',
                opacity: isDeactivated ? 0.5 : 1
              }}
            >
              <div className="mobile-action-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: '44px', height: '44px', borderRadius: '12px' }}>
                <Factory size={22} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>New Production</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Multi-output batch & wastage</div>
              </div>
            </button>

            {/* 3. Sales Button */}
            <button
              className="mobile-action-card"
              onClick={() => !isDeactivated && setShowSalesModal(true)}
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '14px',
                padding: '18px 16px',
                opacity: isDeactivated ? 0.5 : 1
              }}
            >
              <div className="mobile-action-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', width: '44px', height: '44px', borderRadius: '12px' }}>
                <Truck size={22} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>New Sale</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Finished goods customer dispatch</div>
              </div>
            </button>
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center', padding: '24px 0 10px', color: 'var(--text-dim)', fontSize: '11px' }}>
            Data entry directly recorded in ERP ledger • Auto-attributed to {profile?.name || 'Device'}
          </div>
        </div>
      </div>

      {/* Setup Modal for first launch only */}
      <ManagerSetupModal
        isOpen={showSetupModal && (!profile || !profile.name)}
        currentProfile={profile}
        onClose={() => setShowSetupModal(false)}
        onSave={(newProfile) => {
          setProfile(newProfile);
          setShowSetupModal(false);
        }}
      />

      {/* Entry Modals */}
      <PurchaseEntryModal
        isOpen={showPurchaseModal}
        managerProfile={profile}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={() => {}}
      />

      <ProductionEntryModal
        isOpen={showProductionModal}
        managerProfile={profile}
        onClose={() => setShowProductionModal(false)}
        onSuccess={() => {}}
      />

      <SalesEntryModal
        isOpen={showSalesModal}
        managerProfile={profile}
        onClose={() => setShowSalesModal(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
