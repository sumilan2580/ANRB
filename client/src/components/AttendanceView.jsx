import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, CheckCircle2, XCircle, Clock, Save, RefreshCw,
  ChevronLeft, ChevronRight, Users, BarChart3, AlertTriangle
} from 'lucide-react';
import { api } from '../api';

// Attendance status options
const STATUS_OPTIONS = [
  { value: 'present',  label: 'Full Day',    color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: '\u2713' },
  { value: 'half_day', label: 'Half Day',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: '\u00bd' },
  { value: 'absent',   label: 'Not Present', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '\u2717' },
  { value: 'not_marked', label: 'Not Marked', color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: '\u2014' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStr(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

// Daily Attendance Marking Panel
function DailyPanel({ mode, markedBy }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAttendance(`date=${date}`);
      setRows((data || []).map(r => {
        let st = r.status || r.attendance_status || 'absent';
        if (st === 'Full Day' || st === 'present') st = 'present';
        else if (st === 'Half Day' || st === 'half_day') st = 'half_day';
        else st = 'absent';
        return {
          ...r,
          staff_id: r.staff_id || r.id,
          staff_name: r.staff_name || r.name,
          status: st
        };
      }));
    } catch (e) {
      setError(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (staffId, status) => {
    setRows(prev => prev.map(r => (r.staff_id === staffId || r.id === staffId) ? { ...r, status } : r));
  };

  const saveAll = async () => {
    setSaving(true);
    setError('');
    try {
      await api.saveAttendanceBulk({
        date,
        marked_by: markedBy || 'Admin',
        records: rows.map(r => ({
          staff_id: r.staff_id || r.id,
          status: r.status === 'present' ? 'Full Day' : (r.status === 'half_day' ? 'Half Day' : 'Not Present'),
          remarks: r.remarks || ''
        }))
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)); };

  const counts = { present: 0, half_day: 0, absent: 0 };
  rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <button className="btn btn-outline" onClick={prevDay} style={{ padding: '6px 10px' }}><ChevronLeft size={14} /></button>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={e => setDate(e.target.value)}
          className="form-input"
          style={{ width: 'auto', minWidth: '160px' }}
        />
        <button className="btn btn-outline" onClick={nextDay} disabled={date >= todayStr()} style={{ padding: '6px 10px' }}><ChevronRight size={14} /></button>
        <button className="btn btn-outline" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { key: 'present', color: '#10b981', label: 'Full Day' },
              { key: 'half_day', color: '#f59e0b', label: 'Half Day' },
              { key: 'absent', color: '#ef4444', label: 'Not Present' },
            ].map(s => (
              <span key={s.key} style={{ fontSize: '12px', color: s.color, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                {counts[s.key]} {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />{error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          <Users size={32} style={{ marginBottom: '10px', opacity: 0.3 }} />
          <div>No active staff found.</div>
          <div style={{ fontSize: '11px', marginTop: '4px' }}>Add staff in Admin Panel (Masters) first.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {rows.map(r => (
              <div key={r.staff_id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: '10px', padding: '10px 14px', flexWrap: 'wrap'
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '13px', color: '#fff', flexShrink: 0
                }}>
                  {r.staff_name ? r.staff_name.charAt(0).toUpperCase() : '?'}
                </div>
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.staff_name}</div>
                  {r.designation && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{r.designation}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.filter(s => s.value !== 'not_marked').map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStatus(r.staff_id, s.value)}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                        border: '1.5px solid ' + (r.status === s.value ? s.color : 'transparent'),
                        background: r.status === s.value ? s.bg : 'rgba(255,255,255,0.04)',
                        color: r.status === s.value ? s.color : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
            {saved && (
              <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Saved!
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={saveAll}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Attendance (' + rows.length + ' staff)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Monthly Summary Panel
function MonthlyPanel() {
  const [month, setMonth] = useState(monthStr());
  const [summary, setSummary] = useState([]);
  const [detail, setDetail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, det] = await Promise.all([
        api.getAttendanceSummary(month),
        api.getAttendance('month=' + month)
      ]);
      setSummary(sum || []);
      setDetail(det || []);
    } catch (e) {
      setError(e.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() - 1); setMonth(monthStr(d)); };
  const nextMonth = () => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() + 1); setMonth(monthStr(d)); };

  const numDays = daysInMonth(month);
  const staffDayMap = {};
  detail.forEach(r => {
    const day = parseInt(r.date ? r.date.slice(8, 10) : '0', 10);
    if (!staffDayMap[r.staff_id]) staffDayMap[r.staff_id] = {};
    staffDayMap[r.staff_id][day] = r.status;
  });

  const statusColor = {
    present: '#10b981', 'Full Day': '#10b981',
    half_day: '#f59e0b', 'Half Day': '#f59e0b',
    absent: '#ef4444', 'Not Present': '#ef4444'
  };
  const statusChar  = {
    present: '\u2713', 'Full Day': '\u2713',
    half_day: '\u00bd', 'Half Day': '\u00bd',
    absent: '\u2717', 'Not Present': '\u2717'
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <button className="btn btn-outline" onClick={prevMonth} style={{ padding: '6px 10px' }}><ChevronLeft size={14} /></button>
        <span style={{ fontWeight: '700', fontSize: '15px', minWidth: '160px', textAlign: 'center' }}>{formatMonthLabel(month)}</span>
        <button className="btn btn-outline" onClick={nextMonth} style={{ padding: '6px 10px' }}><ChevronRight size={14} /></button>
        <button className="btn btn-outline" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />{error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Loading...
        </div>
      ) : summary.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          No staff records found. Add staff in Masters first.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {summary.map(s => (
              <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', color: '#fff', flexShrink: 0 }}>
                    {s.staff_name ? s.staff_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>{s.staff_name}</div>
                    {s.designation && <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{s.designation}</div>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '6px', padding: '4px' }}>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '16px' }}>{s.full_days || 0}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Full</div>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: '6px', padding: '4px' }}>
                    <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '16px' }}>{s.half_days || 0}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Half</div>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '6px', padding: '4px' }}>
                    <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '16px' }}>{s.absents || s.absent_days || 0}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Not Present</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '700px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: '600', position: 'sticky', left: 0, background: 'var(--bg-main)', zIndex: 2, minWidth: '120px' }}>Staff</th>
                  {Array.from({ length: numDays }, (_, i) => i + 1).map(d => (
                    <th key={d} style={{ padding: '4px 2px', color: 'var(--text-dim)', fontWeight: '600', textAlign: 'center', minWidth: '26px' }}>{d}</th>
                  ))}
                  <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: '600', minWidth: '80px', textAlign: 'center' }}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(s => {
                  const dayMap = staffDayMap[s.id] || {};
                  return (
                    <tr key={s.id}>
                      <td style={{ padding: '6px 10px', fontWeight: '600', color: 'var(--text-main)', position: 'sticky', left: 0, background: 'var(--bg-main)', zIndex: 1, whiteSpace: 'nowrap' }}>
                        {s.staff_name || s.name}
                        {s.designation && <span style={{ color: 'var(--text-dim)', fontWeight: '400', marginLeft: '4px', fontSize: '10px' }}>({s.designation})</span>}
                      </td>
                      {Array.from({ length: numDays }, (_, i) => i + 1).map(d => {
                        const st = dayMap[d];
                        return (
                          <td key={d} style={{ padding: '4px 2px', textAlign: 'center' }}>
                            {st ? (
                              <span style={{
                                display: 'inline-block', width: '20px', height: '20px', borderRadius: '4px',
                                background: (statusColor[st] || '#64748b') + '22', color: statusColor[st] || '#64748b',
                                fontSize: '10px', fontWeight: '800', lineHeight: '20px', textAlign: 'center'
                              }}>
                                {statusChar[st] || '?'}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{'\u00b7'}</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#10b981', fontWeight: '700' }}>{s.full_days || 0}</span>
                        <span style={{ color: 'var(--text-dim)', margin: '0 2px' }}>+</span>
                        <span style={{ color: '#f59e0b', fontWeight: '700' }}>{s.half_days || 0}</span>
                        <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>|</span>
                        <span style={{ color: '#ef4444', fontWeight: '700' }}>{s.absents || s.absent_days || 0}</span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}> not present</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Main AttendanceView Export
export default function AttendanceView({ mode, markerName }) {
  const [tab, setTab] = useState('daily');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
            Staff Attendance
          </h2>
          <p>Mark daily attendance and view monthly summaries for all active staff</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-card)', padding: '5px', borderRadius: '10px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
        <button
          className={'mode-btn' + (tab === 'daily' ? ' active' : '')}
          onClick={() => setTab('daily')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <CheckCircle2 size={14} /> Daily Mark
        </button>
        <button
          className={'mode-btn' + (tab === 'monthly' ? ' active' : '')}
          onClick={() => setTab('monthly')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart3 size={14} /> Monthly Summary
        </button>
      </div>

      <div className="table-container" style={{ padding: '20px' }}>
        {tab === 'daily' ? (
          <DailyPanel mode={mode} markedBy={markerName || 'Admin'} />
        ) : (
          <MonthlyPanel />
        )}
      </div>
    </div>
  );
}
