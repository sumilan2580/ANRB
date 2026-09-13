import React, { useState } from 'react';
import { UserCheck, Smartphone, ShieldCheck } from 'lucide-react';
import { api } from '../../api';

export default function ManagerSetupModal({ isOpen, onClose, onSave, currentProfile }) {
  const [managerName, setManagerName] = useState(currentProfile?.name || '');
  const [phone, setPhone] = useState(currentProfile?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!managerName.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let deviceId = localStorage.getItem('tripal_device_id');
      if (!deviceId) {
        deviceId = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
        localStorage.setItem('tripal_device_id', deviceId);
      }

      // Sync to backend registry
      const registered = await api.registerManager({
        name: managerName.trim(),
        deviceId,
        phone: phone.trim()
      });

      const profile = {
        id: registered.id,
        name: registered.name,
        deviceId,
        phone: phone.trim()
      };

      localStorage.setItem('tripal_manager_profile', JSON.stringify(profile));
      onSave(profile);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save manager profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '420px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(37, 99, 235, 0.15))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Smartphone size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px' }}>First-Time App Setup</h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>Device Profile Identification</p>
            </div>
          </div>
          {currentProfile?.name && (
            <button className="modal-close-btn" onClick={onClose}>&times;</button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px' }}>
            <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: '600', marginBottom: '4px' }}>
                <ShieldCheck size={16} color="#38bdf8" /> Automatic Attribution
              </div>
              Your name will be saved on this device. All transactions you create will automatically attach your name without asking again.
            </div>

            {error && (
              <div style={{ padding: '10px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Manager Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rahul, Amit, Sanjay"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                autoFocus
                required
              />
              <span className="form-hint">Enter your real name as recognized in factory logs</span>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number (Optional)</label>
              <input
                type="tel"
                className="form-input"
                placeholder="e.g. +91 98200 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '8px' }}
              disabled={loading}
            >
              <UserCheck size={18} />
              {loading ? 'Saving Profile...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
