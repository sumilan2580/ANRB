import React, { useState, useEffect, useCallback } from 'react';
import { X, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Users, Save } from 'lucide-react';
import { api, getStoredProfile } from '../api';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Full Day', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '✓' },
  { value: 'half_day', label: 'Half Day', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '½' },
  { value: 'absent', label: 'Not Present', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '✕' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceModal({ isOpen, onClose, onSuccess }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const profile = getStoredProfile();
  const managerName = profile?.name || 'Manager';

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAttendance(`date=${date}`);
      setRows((data || []).map(r => {
        let st = r.status || r.attendance_status || 'present';
        if (st === 'Full Day' || st === 'present') st = 'present';
        else if (st === 'Half Day' || st === 'half_day') st = 'half_day';
        else if (st === 'Not Present' || st === 'absent') st = 'absent';
        else st = 'present';
        return {
          ...r,
          staff_id: r.staff_id || r.id,
          staff_name: r.staff_name || r.name,
          status: st,
          remarks: r.remarks || ''
        };
      }));
    } catch (err) {
      setError(err.message || 'Failed to load staff attendance');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      loadAttendance();
    }
  }, [isOpen, loadAttendance]);

  const setStatus = (staffId, status) => {
    setRows(prev => prev.map(r => (r.staff_id === staffId || r.id === staffId) ? { ...r, status } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.saveAttendanceBulk({
        date,
        markedBy: managerName,
        records: rows.map(r => ({
          staff_id: r.staff_id || r.id,
          status: r.status === 'present' ? 'Full Day' : (r.status === 'half_day' ? 'Half Day' : 'Not Present'),
          remarks: r.remarks || ''
        }))
      });
      setSuccess(`Attendance for ${rows.length} staff members saved successfully!`);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  };

  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  };

  if (!isOpen) return null;

  const counts = { present: 0, half_day: 0, absent: 0 };
  rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '6px', borderRadius: '8px' }}>
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="modal-title">Staff Attendance</h2>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Daily factory floor attendance marking</div>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {/* Date Selector Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={prevDay}
              style={{ padding: '6px 10px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              style={{
                flex: 1, minWidth: '130px', padding: '7px 10px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: '8px', color: '#fff', fontSize: '13px'
              }}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={nextDay}
              disabled={date >= todayStr()}
              style={{ padding: '6px 10px' }}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={loadAttendance}
              title="Refresh"
              style={{ padding: '6px 10px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Quick Counter Summary */}
          {rows.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px',
              marginBottom: '14px', textAlign: 'center'
            }}>
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '6px' }}>
                <div style={{ color: '#10b981', fontWeight: '800', fontSize: '15px' }}>{counts.present}</div>
                <div style={{ fontSize: '10.5px', color: '#6ee7b7' }}>Full Day</div>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '6px' }}>
                <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '15px' }}>{counts.half_day}</div>
                <div style={{ fontSize: '10.5px', color: '#fcd34d' }}>Half Day</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '6px' }}>
                <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '15px' }}>{counts.absent}</div>
                <div style={{ fontSize: '10.5px', color: '#fca5a5' }}>Not Present</div>
              </div>
            </div>
          )}

          {error && (
            <div className="alert-banner error" style={{ marginBottom: '12px' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-banner success" style={{ marginBottom: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>{success}</span>
            </div>
          )}

          {/* Staff List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
              <RefreshCw size={22} className="animate-spin" style={{ marginBottom: '8px' }} />
              <div>Loading staff list...</div>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
              <Users size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '600' }}>No active staff found</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Add staff members in Admin Panel (Masters)</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rows.map(r => (
                <div
                  key={r.staff_id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '12px', color: '#fff', flexShrink: 0
                    }}>
                      {r.staff_name ? r.staff_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.staff_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {r.designation || 'Staff'} {r.department ? `• ${r.department}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* 3 Status Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {STATUS_OPTIONS.map(opt => {
                      const active = r.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(r.staff_id, opt.value)}
                          style={{
                            padding: '6px 4px',
                            borderRadius: '7px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            border: active ? `1.5px solid ${opt.color}` : '1px solid rgba(255,255,255,0.08)',
                            background: active ? opt.bg : 'rgba(255,255,255,0.03)',
                            color: active ? opt.color : 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || rows.length === 0}
            style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : `Save Attendance (${rows.length})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
