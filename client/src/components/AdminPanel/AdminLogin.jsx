import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Database, AlertTriangle, PhoneCall } from 'lucide-react';
import { api } from '../../api';

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlanExpired, setIsPlanExpired] = useState(false);
  const [detectedRole, setDetectedRole] = useState(null); // null | 'admin' | 'manager'
  const [demoMode, setDemoMode] = useState(() => {
    const saved = localStorage.getItem('tripal_fake_expired_demo');
    return saved !== null ? saved === 'true' : true; // Default ON as requested
  });
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Secret toggle: Click "T" logo 3 times to enable/disable fake expired demo mode
  const handleLogoClick = () => {
    const nextCount = secretClickCount + 1;
    if (nextCount >= 3) {
      const nextMode = !demoMode;
      setDemoMode(nextMode);
      localStorage.setItem('tripal_fake_expired_demo', String(nextMode));
      setSecretClickCount(0);
      setError('');
      setIsPlanExpired(false);
      triggerToast(nextMode ? 'Demo Mode Enabled: Plan Expired Active' : 'Demo Mode Disabled: Normal Login Active');
    } else {
      setSecretClickCount(nextCount);
      setTimeout(() => setSecretClickCount(0), 1200);
    }
  };

  const isDatabaseOrNetworkError = (msg) => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (
      lower.includes('socket') ||
      lower.includes('tls') ||
      lower.includes('database') ||
      lower.includes('connection') ||
      lower.includes('neon') ||
      lower.includes('postgres') ||
      lower.includes('network') ||
      lower.includes('econnrefused') ||
      lower.includes('etimedout') ||
      lower.includes('fetch') ||
      lower.includes('500')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both Username and Password');
      setIsPlanExpired(false);
      return;
    }

    setLoading(true);
    setError('');
    setIsPlanExpired(false);

    // If Demo Expired Mode is active (and not using special bypass password)
    if (demoMode && password !== 'admin@bypass') {
      setTimeout(() => {
        setLoading(false);
        setIsPlanExpired(true);
        setError('Aapka database plan expire ho gaya hai. Please contact your administrator.');
      }, 700);
      return;
    }

    try {
      const res = await api.login(username.trim(), password);
      if (res.success && res.token) {
        setDetectedRole(res.user.role);
        setTimeout(() => {
          onLoginSuccess(res.user, res.token);
        }, 400);
      } else {
        if (isDatabaseOrNetworkError(res.error)) {
          setIsPlanExpired(true);
          setError('Aapka database plan expire ho gaya hai. Please contact your administrator.');
        } else {
          setError(res.error || 'Authentication failed');
        }
      }
    } catch (err) {
      if (isDatabaseOrNetworkError(err.message)) {
        setIsPlanExpired(true);
        setError('Aapka database plan expire ho gaya hai. Please contact your administrator.');
      } else {
        setError(err.message || 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const isAdminHint = username.toLowerCase() === 'admin' || (!username && true);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, #101c36 0%, #070b14 75%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #38bdf8',
          color: '#38bdf8', padding: '10px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: '600', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '350px',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.15) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isPlanExpired ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: isPlanExpired
          ? '0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(239, 68, 68, 0.25)'
          : '0 25px 60px -15px rgba(0,0,0,0.7), 0 0 35px rgba(2,132,199,0.15)',
        position: 'relative', zIndex: 10,
        transition: 'all 0.3s ease'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            onClick={handleLogoClick}
            title="Click 3 times to toggle demo mode"
            style={{
              width: '60px', height: '60px', borderRadius: '16px',
              background: isPlanExpired
                ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', fontWeight: '800', color: '#fff',
              boxShadow: isPlanExpired ? '0 8px 24px rgba(239,68,68,0.4)' : '0 8px 24px rgba(2,132,199,0.4)',
              marginBottom: '16px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.3s'
            }}
          >
            T
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '0.02em', margin: '0 0 8px' }}>
            TRIPAL ERP
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Sign in with your Admin or Manager credentials
          </p>
        </div>

        {/* Database Plan Expired Banner / Modal Card */}
        {isPlanExpired && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.22) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            boxShadow: '0 8px 20px rgba(239, 68, 68, 0.15)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Database size={20} color="#f87171" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#f87171',
                    background: 'rgba(239, 68, 68, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    Database Inactive
                  </span>
                </div>
                <h4 style={{ margin: '4px 0 6px', fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                  Aapka database plan expire ho gaya hai
                </h4>
                <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#fca5a5', lineHeight: '1.45' }}>
                  Your cloud database subscription plan has expired. Please contact your system administrator to renew or restore database services.
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: '#fecaca',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px dashed rgba(239, 68, 68, 0.35)'
                }}>
                  <PhoneCall size={13} color="#f87171" />
                  <span>Support: <strong>Please contact your administrator</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Regular Error Banner (when not plan expired) */}
        {!isPlanExpired && error && (
          <div style={{
            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
            borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '10px', color: '#fb7185', fontSize: '13px'
          }}>
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: '700',
              color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <User size={18} />
              </div>
              <input
                id="login-username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
                style={{
                  width: '100%', background: '#0c1424', border: '1px solid #1e2c47',
                  borderRadius: '10px', padding: '13px 14px 13px 44px',
                  color: '#fff', fontSize: '14px', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: '700',
              color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <Lock size={18} />
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', background: '#0c1424', border: '1px solid #1e2c47',
                  borderRadius: '10px', padding: '13px 44px 13px 44px',
                  color: '#fff', fontSize: '14px', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="login-submit"
            disabled={loading}
            style={{
              width: '100%',
              background: detectedRole === 'manager'
                ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              border: 'none', borderRadius: '10px', padding: '14px', color: '#fff',
              fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 16px rgba(2,132,199,0.4)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Role Info */}
        <div style={{
          marginTop: '24px', display: 'flex', gap: '10px'
        }}>
          <div style={{
            flex: 1, padding: '10px 12px',
            background: 'rgba(2,132,199,0.07)', border: '1px solid rgba(2,132,199,0.15)',
            borderRadius: '10px', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '3px' }}>
              <ShieldCheck size={13} color="#38bdf8" />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8' }}>ADMIN</span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#475569' }}>Full access · All features</div>
          </div>
          <div style={{
            flex: 1, padding: '10px 12px',
            background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)',
            borderRadius: '10px', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '3px' }}>
              <UserCheck size={13} color="#c084fc" />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#c084fc' }}>MANAGER</span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#475569' }}>Entry only · No edit/delete</div>
          </div>
        </div>
      </div>
    </div>
  );
}
