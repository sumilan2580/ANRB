import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Layers, Factory, Truck, ArrowDownLeft, ArrowUpRight,
  ChevronRight, User, AlertTriangle, Wifi, Settings, X, CheckCircle2
} from 'lucide-react';
import { api, getStoredProfile, getStoredToken, getServerUrl, setServerUrl, DEFAULT_HOST_URL } from './api';
import SetupScreen from './components/SetupScreen';
import PurchaseModal from './components/PurchaseModal';
import ConsumptionModal from './components/ConsumptionModal';
import ProductionModal from './components/ProductionModal';
import SalesModal from './components/SalesModal';
import PaymentModal from './components/PaymentModal';

export default function App() {
  const [profile, setProfile] = useState(() => getStoredProfile());
  const [token, setToken] = useState(() => getStoredToken());
  const [isOnline, setIsOnline] = useState(true);
  const [isDeactivated, setIsDeactivated] = useState(false);

  // 6 Daily Entry Modals state
  const [showPurchase, setShowPurchase] = useState(false);
  const [showConsumption, setShowConsumption] = useState(false);
  const [showProduction, setShowProduction] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentDefaultType, setPaymentDefaultType] = useState('CUSTOMER');

  const [showServerModal, setShowServerModal] = useState(false);
  const [modalServerUrl, setModalServerUrl] = useState(() => getServerUrl());
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkServerConnection();
    const interval = setInterval(checkServerConnection, 10000);
    return () => clearInterval(interval);
  }, [token]);

  async function checkServerConnection() {
    try {
      await api.checkHealth();
      setIsOnline(true);

      // Verify token validity/status if registered
      if (token) {
        try {
          await api.getRawMaterials();
          setIsDeactivated(false);
        } catch (err) {
          if (err.status === 403 && err.message.includes('deactivated')) {
            setIsDeactivated(true);
          }
        }
      }
    } catch {
      setIsOnline(false);
    }
  }

  const handleTestInModal = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const target = modalServerUrl.trim() || DEFAULT_HOST_URL;
      await api.checkHealth(target);
      setTestResult({ ok: true, message: 'Server Reachable & Connected!' });
      setServerUrl(target);
      setIsOnline(true);
    } catch (err) {
      setTestResult({ ok: false, message: 'Cannot reach server at this IP. Check Wi-Fi.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveServerUrl = () => {
    const target = modalServerUrl.trim() || DEFAULT_HOST_URL;
    setServerUrl(target);
    setShowServerModal(false);
    checkServerConnection();
  };

  const handleSetupComplete = (newProfile) => {
    setProfile(newProfile);
    setToken(newProfile.managerToken);
  };

  const openPaymentModal = (type) => {
    setPaymentDefaultType(type);
    setShowPayment(true);
  };

  // If no manager profile or token yet, display first-time permanent setup screen
  if (!profile || !profile.name || !token) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }

  return (
    <div className="mobile-app">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-badge">T</div>
          <div>
            <div className="brand-title">TRIPAL ERP</div>
            <div className="brand-sub">Manager Console</div>
          </div>
        </div>

        {/* Read-Only Fixed Manager Name Badge (Permanently Immutable) */}
        <div className="manager-fixed-badge" title="Permanent Device Binding">
          <div className="manager-avatar">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <span className="manager-name">{profile.name}</span>
        </div>
      </header>

      {/* Network & Connectivity Status Bar (Click to configure IP) */}
      <div
        className="status-bar"
        onClick={() => {
          setModalServerUrl(getServerUrl());
          setTestResult(null);
          setShowServerModal(true);
        }}
        style={{ cursor: 'pointer' }}
        title="Tap to view or change Server IP"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span>{isOnline ? 'Factory Server Connected' : 'Server Offline (Tap to fix)'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            #{profile.deviceId ? profile.deviceId.slice(-6) : 'DEV'}
          </span>
          <Settings size={13} style={{ opacity: 0.7 }} />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="main-content">
        {isDeactivated && (
          <div className="alert-banner error" style={{ margin: 0 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Account Deactivated</strong>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                Your manager account has been deactivated by Admin. New transaction entries are blocked.
              </div>
            </div>
          </div>
        )}

        <div className="screen-label">6 Daily Factory Operations</div>

        {/* 1. Raw Material Purchase Card */}
        <div
          className="action-card card-purchase"
          onClick={() => !isDeactivated && setShowPurchase(true)}
          style={{ opacity: isDeactivated ? 0.6 : 1 }}
        >
          <div className="card-icon-box">
            <ShoppingBag size={26} />
          </div>
          <div className="card-text">
            <div className="card-title">1. Raw Material Inward</div>
            <div className="card-desc">Receive polymer granules, masterbatch & additives from suppliers</div>
          </div>
          <ChevronRight size={20} className="card-arrow" />
        </div>

        {/* 2. Material Issue / Consumption Card */}
        <div
          className="action-card card-consumption"
          onClick={() => !isDeactivated && setShowConsumption(true)}
          style={{ opacity: isDeactivated ? 0.6 : 1 }}
        >
          <div className="card-icon-box">
            <Layers size={26} />
          </div>
          <div className="card-text">
            <div className="card-title">2. Material Issue Batch</div>
            <div className="card-desc">Issue raw materials to extruder / lamination machines & shift</div>
          </div>
          <ChevronRight size={20} className="card-arrow" />
        </div>

        {/* 3. Production & Wastage Entry Card */}
        <div
          className="action-card card-production"
          onClick={() => !isDeactivated && setShowProduction(true)}
          style={{ opacity: isDeactivated ? 0.6 : 1 }}
        >
          <div className="card-icon-box">
            <Factory size={26} />
          </div>
          <div className="card-text">
            <div className="card-title">3. Production & Wastage</div>
            <div className="card-desc">Log finished goods produced and scrap/trimming wastage KG</div>
          </div>
          <ChevronRight size={20} className="card-arrow" />
        </div>

        {/* 4. Sales Dispatch Card */}
        <div
          className="action-card card-sales"
          onClick={() => !isDeactivated && setShowSales(true)}
          style={{ opacity: isDeactivated ? 0.6 : 1 }}
        >
          <div className="card-icon-box">
            <Truck size={26} />
          </div>
          <div className="card-text">
            <div className="card-title">4. Sales Dispatch & Bill</div>
            <div className="card-desc">Dispatch finished tripal rolls/sheets to buyers with stock check</div>
          </div>
          <ChevronRight size={20} className="card-arrow" />
        </div>

        {/* 5. Customer Payment Receipt Card */}
        <div
          className="action-card card-receipt"
          onClick={() => !isDeactivated && openPaymentModal('CUSTOMER')}
          style={{ opacity: isDeactivated ? 0.6 : 1 }}
        >
          <div className="card-icon-box">
            <ArrowDownLeft size={26} />
          </div>
          <div className="card-text">
            <div className="card-title">5. Customer Receipt</div>
            <div className="card-desc">Record payment collection from customer (Cash / Bank / UPI)</div>
          </div>
          <ChevronRight size={20} className="card-arrow" />
        </div>

        {/* 6. Supplier Payment Card */}
        <div
          className="action-card card-payment"
          onClick={() => !isDeactivated && openPaymentModal('SUPPLIER')}
          style={{ opacity: isDeactivated ? 0.6 : 1 }}
        >
          <div className="card-icon-box">
            <ArrowUpRight size={26} />
          </div>
          <div className="card-text">
            <div className="card-title">6. Supplier Payment</div>
            <div className="card-desc">Record raw material vendor payment (Cash / Bank / RTGS)</div>
          </div>
          <ChevronRight size={20} className="card-arrow" />
        </div>

        {/* Footer info note */}
        <div style={{ marginTop: 'auto', textAlign: 'center', padding: '16px 0', color: 'var(--text-dim)', fontSize: '11px' }}>
          Role: Factory Floor Manager (Entry Only) • All entries stamped with {profile.name}
        </div>
      </main>

      {/* Entry Modals */}
      <PurchaseModal
        isOpen={showPurchase}
        onClose={() => setShowPurchase(false)}
        onSuccess={() => {}}
      />

      <ConsumptionModal
        isOpen={showConsumption}
        onClose={() => setShowConsumption(false)}
        onSuccess={() => {}}
      />

      <ProductionModal
        isOpen={showProduction}
        onClose={() => setShowProduction(false)}
        onSuccess={() => {}}
      />

      <SalesModal
        isOpen={showSales}
        onClose={() => setShowSales(false)}
        onSuccess={() => {}}
      />

      <PaymentModal
        isOpen={showPayment}
        defaultType={paymentDefaultType}
        onClose={() => setShowPayment(false)}
        onSuccess={() => {}}
      />

      {/* Server Connection Modal */}
      {showServerModal && (
        <div className="modal-backdrop" onClick={() => setShowServerModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wifi size={20} color="#38bdf8" />
                <h2 className="modal-title">Server Connection</h2>
              </div>
              <button className="btn-close" onClick={() => setShowServerModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                Factory backend server IP address. Ensure your phone and PC are connected to the same Wi-Fi.
              </div>

              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Server URL (PC IP & Port)</label>
                <div className="server-input-row" style={{ marginTop: '6px' }}>
                  <input
                    type="text"
                    className="server-input"
                    value={modalServerUrl}
                    onChange={(e) => setModalServerUrl(e.target.value)}
                    placeholder="http://192.168.0.230:5000"
                  />
                  <button
                    type="button"
                    className="btn-test"
                    onClick={handleTestInModal}
                    disabled={testing}
                  >
                    {testing ? 'Testing...' : 'Test'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                  Default PC IP: <strong>192.168.0.230:5000</strong>
                </div>
              </div>

              {testResult && (
                <div className={`server-test-result ${testResult.ok ? 'ok' : 'fail'}`} style={{ marginTop: '10px' }}>
                  {testResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-submit btn-blue"
                  onClick={handleSaveServerUrl}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Save & Reconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
