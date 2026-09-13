import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../../api';

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedRole, setDetectedRole] = useState(null); // null | 'admin' | 'manager'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both Username and Password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.login(username.trim(), password);
      if (res.success && res.token) {
        setDetectedRole(res.user.role);
        // Small delay to show role detection animation
        setTimeout(() => {
          onLoginSuccess(res.user, res.token);
        }, 400);
      } else {
        setError(res.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'Invalid username or password');
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
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.7), 0 0 35px rgba(2,132,199,0.15)',
        position: 'relative', zIndex: 10
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: '800', color: '#fff',
            boxShadow: '0 8px 24px rgba(2,132,199,0.4)', marginBottom: '16px'
          }}>
            T
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '0.02em', margin: '0 0 8px' }}>
            TRIPAL ERP
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Sign in with your Admin or Manager credentials
          </p>
        </div>

        {/* Error Banner */}
        {error && (
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
