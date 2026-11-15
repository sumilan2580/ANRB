import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Lock, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  ShieldAlert, 
  Cloud, 
  CheckCircle2,
  PhoneCall,
  Mail,
  Copy
} from 'lucide-react';

export default function SuspendedDemoPage({ onUnlockAdmin }) {
  const [copied, setCopied] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [secretClicks, setSecretClicks] = useState(0);

  // Set document title & warning favicon on mount to make it 100% genuine
  useEffect(() => {
    document.title = 'Website Suspended: Hosting Plan Expired';
    const link = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444'%3E%3Cpath d='M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z'/%3E%3C/svg%3E";
    }
  }, []);

  // Netlify direct target URL as requested by the user
  const netlifyRedirectUrl = 'https://app.netlify.com/';

  const handleUpdatePlan = () => {
    // Direct redirect to Netlify
    window.location.href = netlifyRedirectUrl;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText('ERR_HOSTING_SUB_EXPIRED_402');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Secret unlock for owner/developer: Click Ray ID 5 times to reveal login
  const handleSecretClick = () => {
    const next = secretClicks + 1;
    if (next >= 5) {
      localStorage.setItem('anrb_admin_unlocked', 'true');
      if (onUnlockAdmin) {
        onUnlockAdmin();
      } else {
        window.location.href = '/login';
      }
    } else {
      setSecretClicks(next);
      setTimeout(() => setSecretClicks(0), 3000);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#070a11',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(239, 68, 68, 0.08) 0%, rgba(7, 10, 17, 1) 75%)',
      color: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '0',
      margin: '0',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      {/* ─── TOP EDGE GATEWAY STATUS BAR ─── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backgroundColor: 'rgba(10, 14, 24, 0.85)',
        backdropFilter: 'blur(12px)',
        fontSize: '11.5px',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.04em'
      }}>
        {/* Left: Node Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: '700' }}>
            <Cloud size={14} />
            <span>CLOUD EDGE GATEWAY</span>
          </div>
          <span style={{ color: '#475569' }}>|</span>
          <span style={{ color: '#94a3b8' }}>NODE: SNT-EDGE-APEX-01</span>
        </div>

        {/* Right: HTTP 402 Suspended Badge + Date (Clean, NO Back to Login button) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10.5px',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
            HTTP 402 : SUSPENDED
          </div>
          <span style={{ color: '#64748b', fontSize: '11px' }}>{formattedDate}</span>
        </div>
      </header>

      {/* ─── MAIN SUSPENDED CARD CONTENT ─── */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 16px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '18px',
          padding: '40px 36px 36px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 50px rgba(239, 68, 68, 0.08)',
          position: 'relative'
        }}>
          {/* Top Notice Badge: Red Shield & Tag */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
            }}>
              <ShieldAlert size={22} />
            </div>
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              borderRadius: '6px'
            }}>
              HOSTING ACCOUNT NOTICE
            </div>
          </div>

          {/* Heading */}
          <h1 style={{
            textAlign: 'center',
            fontSize: '25px',
            fontWeight: '800',
            color: '#ffffff',
            margin: '0 0 10px',
            letterSpacing: '-0.01em',
            lineHeight: '1.25'
          }}>
            Website Suspended: Hosting Plan Expired
          </h1>

          {/* Subheading */}
          <p style={{
            textAlign: 'center',
            fontSize: '13.5px',
            color: '#94a3b8',
            maxWidth: '540px',
            margin: '0 auto 28px',
            lineHeight: '1.55'
          }}>
            The hosting subscription for this domain has expired and requires immediate renewal to restore services.
          </p>

          {/* Details Table Container */}
          <div style={{
            backgroundColor: '#090d16',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '22px',
            fontSize: '13px'
          }}>
            {/* Row 1: Host Domain */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                <Globe size={15} color="#64748b" />
                <span>Host Domain:</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '700', color: '#f8fafc' }}>
                shreenathjitransport.com
              </span>
            </div>

            {/* Row 2: Account Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                <Lock size={15} color="#64748b" />
                <span>Account Status:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: '700' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                <span>Suspended (Billing Overdue)</span>
              </div>
            </div>

            {/* Row 3: Suspension Reason */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                <Clock size={15} color="#64748b" />
                <span>Suspension Reason:</span>
              </div>
              <span style={{ color: '#cbd5e1' }}>
                Annual Hosting Plan Non-Renewal
              </span>
            </div>

            {/* Row 4: Reference Code */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 0 3px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                <AlertTriangle size={15} color="#f59e0b" />
                <span>Reference Code:</span>
              </div>
              <div 
                onClick={handleCopyCode}
                title="Click to copy reference code"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontFamily: "'JetBrains Mono', monospace", 
                  fontWeight: '700', 
                  color: '#f59e0b',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(245, 158, 11, 0.08)'
                }}
              >
                <span>ERR_HOSTING_SUB_EXPIRED_402</span>
                {copied ? <CheckCircle2 size={13} color="#10b981" /> : <Copy size={13} color="#f59e0b" />}
              </div>
            </div>
          </div>

          {/* Explanation Box: "What does this mean?" */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '26px'
          }}>
            <h4 style={{
              margin: '0 0 6px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#f1f5f9'
            }}>
              What does this mean?
            </h4>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: '#94a3b8',
              lineHeight: '1.5'
            }}>
              Access to this website, its APIs, and associated web services has been temporarily restricted. If you are the website owner or system administrator, please complete your pending hosting renewal to immediately re-enable public access.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Primary Button: Direct Redirect to https://app.netlify.com/ */}
            <button
              onClick={handleUpdatePlan}
              id="update-hosting-plan-btn"
              style={{
                flex: '1.5',
                background: 'linear-gradient(135deg, #ef4444 0%, #ea580c 50%, #f97316 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '14px 20px',
                fontSize: '14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.45)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.55)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.45)';
              }}
            >
              <ExternalLink size={16} />
              <span>Update Hosting Plan</span>
            </button>

            {/* Secondary Button: Contact Billing */}
            <button
              onClick={() => setShowContactModal(true)}
              style={{
                flex: '1',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
                borderRadius: '10px',
                padding: '14px 18px',
                fontSize: '13.5px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <Clock size={16} color="#94a3b8" />
              <span>Contact Billing</span>
            </button>
          </div>
        </div>
      </main>

      {/* ─── FOOTER BAR ─── */}
      <footer style={{
        padding: '16px 20px',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        backgroundColor: 'rgba(8, 11, 18, 0.85)',
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#475569',
        lineHeight: '1.6',
        userSelect: 'none'
      }}>
        <div 
          onClick={handleSecretClick}
          title=""
          style={{ cursor: 'default' }}
        >
          Server IP: 75.2.60.5 &nbsp;•&nbsp; Security Gateway: WAF Active &nbsp;•&nbsp; Ray ID: snt-edge-402-94e27e8f
        </div>
        <div style={{ color: '#334155', fontSize: '10.5px', marginTop: '2px' }}>
          Cloud Infrastructure Network - All associated services paused pending account reconciliation.
        </div>
      </footer>

      {/* ─── CONTACT BILLING MODAL ─── */}
      {showContactModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: '800', color: '#fff' }}>
              Hosting Billing Support
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.5' }}>
              For urgent renewal assistance or invoice copies, please reach out via our billing channels:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <PhoneCall size={16} color="#38bdf8" />
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace' }}>+91 79 2583 0000</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <Mail size={16} color="#38bdf8" />
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace' }}>billing@tripalmanufacturing.com</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowContactModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                onClick={handleUpdatePlan}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444, #f97316)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Go to Netlify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}