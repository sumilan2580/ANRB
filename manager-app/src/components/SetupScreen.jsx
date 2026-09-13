import React, { useState } from 'react';
import { ShieldCheck, Smartphone, AlertCircle, ArrowRight, Wifi, CheckCircle2, RefreshCw, Globe } from 'lucide-react';
import { api, getOrCreateDeviceId, getServerUrl, setServerUrl, DEFAULT_HOST_URL } from '../api';

export default function SetupScreen({ onSetupComplete }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serverUrl, setServerUrlState] = useState(() => getServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // { ok: boolean, message: string }
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deviceId = getOrCreateDeviceId();

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestStatus(null);
      const target = serverUrl.trim() || DEFAULT_HOST_URL;
      await api.checkHealth(target);
      setTestStatus({ ok: true, message: 'Server Connected Successfully!' });
      setServerUrl(target);
    } catch (err) {
      setTestStatus({
        ok: false,
        message: 'Cannot reach server. Ensure Phone & PC are on the same Wi-Fi.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleServerUrlChange = (val) => {
    setServerUrlState(val);
    setServerUrl(val);
    setTestStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // Save current server URL
      if (serverUrl.trim()) {
        setServerUrl(serverUrl.trim());
      }
      const profile = await api.registerManager(name.trim(), phone.trim());
      onSetupComplete(profile);
    } catch (err) {
      setError(err.message || 'Failed to register device. Make sure phone and PC are on the same Wi-Fi.');
      // Auto-open server config on error so user can inspect IP
      setShowServerConfig(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-brand-icon">T</div>
        <h1 className="setup-title">Tripal Manager</h1>
        <p className="setup-desc">
          Factory Floor Data Entry App<br />
          One-time device setup for manager profile.
        </p>

        {error && (
          <div className="alert-banner error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Manager Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Mobile Number (Optional)</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 98XXX XXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="immutable-note">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '3px' }}>
              <Smartphone size={13} />
              <span>Permanent Device Binding</span>
            </div>
            <span>Device ID: #{deviceId.slice(-6)}. Your name will be permanently bound to this device for factory audit trails. Name switching is disabled.</span>
          </div>

          {/* Server Connection Config Card */}
          <div className="server-config-card">
            <div className="server-config-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Wifi size={13} /> Server Connection (Wi-Fi)
              </span>
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textDecoration: 'underline'
                }}
              >
                {showServerConfig ? 'Hide' : 'Edit IP'}
              </button>
            </div>

            {showServerConfig ? (
              <div style={{ marginTop: '6px' }}>
                <div className="server-input-row">
                  <input
                    type="text"
                    className="server-input"
                    value={serverUrl}
                    onChange={(e) => handleServerUrlChange(e.target.value)}
                    placeholder="http://192.168.0.230:5000"
                  />
                  <button
                    type="button"
                    className="btn-test"
                    onClick={handleTestConnection}
                    disabled={testing}
                  >
                    {testing ? <RefreshCw size={11} className="spin" /> : 'Test'}
                  </button>
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  PC IP: <strong>192.168.0.230:5000</strong> (Phone & PC must be on same Wi-Fi)
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {serverUrl}
                </span>
                <button
                  type="button"
                  className="btn-test"
                  style={{ padding: '4px 8px', fontSize: '10.5px' }}
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            )}

            {testStatus && (
              <div className={`server-test-result ${testStatus.ok ? 'ok' : 'fail'}`}>
                {testStatus.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: '22px' }}>
            <button
              type="submit"
              className="btn-submit btn-blue"
              disabled={loading}
            >
              {loading ? (
                <span>Registering Device...</span>
              ) : (
                <>
                  <span>Activate Manager App</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

