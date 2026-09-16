import React, { useState, useEffect } from 'react';
import { ClipboardList, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../../api';

export default function ProductionOrderModal({ isOpen, managerName, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    customerId: '',
    customerOrderNo: '',
    finishedProductId: '',
    gsm: '',
    size: '',
    requiredQuantity: '',
    unit: 'KG',
    deliveryDate: '',
    remarks: ''
  });

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setForm({
        orderDate: new Date().toISOString().split('T')[0],
        customerId: '',
        customerOrderNo: '',
        finishedProductId: '',
        gsm: '',
        size: '',
        requiredQuantity: '',
        unit: 'KG',
        deliveryDate: '',
        remarks: ''
      });
      loadMasters();
    }
  }, [isOpen]);

  const loadMasters = async () => {
    setLoading(true);
    try {
      const [custs, fgs] = await Promise.all([
        api.getCustomers().catch(() => []),
        api.getFinishedGoods().catch(() => [])
      ]);
      setCustomers(custs || []);
      setFinishedGoods(fgs || []);
      if (custs && custs.length > 0) {
        setForm(f => ({ ...f, customerId: custs[0].id }));
      }
    } catch (err) {
      setError('Failed to load customers or products.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const reqQty = Number(form.requiredQuantity);
    if (!form.customerId) {
      return setError('Please select a customer.');
    }
    if (!form.finishedProductId) {
      return setError('Please select a finished product.');
    }
    if (isNaN(reqQty) || reqQty <= 0) {
      return setError('Please enter a valid required quantity greater than 0.');
    }

    setSubmitting(true);
    try {
      const payload = {
        orderDate: form.orderDate,
        customerId: Number(form.customerId),
        customerOrderNo: form.customerOrderNo?.trim() || null,
        finishedProductId: Number(form.finishedProductId),
        gsm: form.gsm ? Number(form.gsm) : null,
        size: form.size?.trim() || null,
        requiredQuantity: reqQty,
        unit: form.unit || 'KG',
        deliveryDate: form.deliveryDate || null,
        remarks: form.remarks?.trim() || null
      };

      const res = await api.createProductionOrder(payload);
      setSuccess(`Production Order ${res.order_no || ''} created successfully! Status: Pending`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to create production order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header" style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.2))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: '#9333ea',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                + New Customer Production Order
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                Record buyer production order for factory extrusion & fabrication
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px 12px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div style={{ padding: '10px 12px', background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <div>{success}</div>
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Order Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.orderDate}
                  onChange={e => setForm({ ...form, orderDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Buyer PO / Ref #</label>
                <input
                  type="text"
                  className="form-input num-mono"
                  value={form.customerOrderNo}
                  onChange={e => setForm({ ...form, customerOrderNo: e.target.value })}
                  placeholder="e.g. PO-8821 / WhatsApp"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Customer (Buyer) *</label>
                <select
                  className="form-select"
                  value={form.customerId}
                  onChange={e => setForm({ ...form, customerId: e.target.value })}
                  required
                  disabled={loading}
                >
                  <option value="">Select customer…</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {c.gst_number ? `[${c.gst_number}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label className="form-label">Target Finished Good Product *</label>
                <select
                  className="form-select"
                  value={form.finishedProductId}
                  onChange={e => {
                    const fg = finishedGoods.find(f => String(f.id) === e.target.value);
                    setForm({
                      ...form,
                      finishedProductId: e.target.value,
                      gsm: fg?.gsm || form.gsm,
                      size: fg?.width_size || form.size
                    });
                  }}
                  required
                  disabled={loading}
                >
                  <option value="">Select Finished Good…</option>
                  {finishedGoods.map(fg => (
                    <option key={fg.id} value={fg.id}>
                      [{fg.product_code || fg.id}] {(fg.product_name || '').replace(/BENGAL STOCK\s*/i, '').trim() || `${fg.gsm || ''}GSM ${fg.width_size || ''} ${fg.colour || ''}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">GSM (Gram/Sq. Meter)</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  value={form.gsm}
                  onChange={e => setForm({ ...form, gsm: e.target.value })}
                  placeholder="e.g. 150"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Size / Width Spec</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.size}
                  onChange={e => setForm({ ...form, size: e.target.value })}
                  placeholder="e.g. 16 FT or 24x30"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Required Quantity *</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  value={form.requiredQuantity}
                  onChange={e => setForm({ ...form, requiredQuantity: e.target.value })}
                  placeholder="e.g. 5000"
                  required
                  min="0.01"
                  step="any"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit *</label>
                <select
                  className="form-select"
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="KG">KG (Kilograms)</option>
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="ROLLS">ROLLS (Rolls)</option>
                  <option value="MT">MT (Metric Tonnes)</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label className="form-label">Expected Delivery Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.deliveryDate}
                  onChange={e => setForm({ ...form, deliveryDate: e.target.value })}
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Remarks / Special Instructions</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  placeholder="e.g. Orange/Blue double lamination, eyelets every 3 feet..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || loading}
              style={{
                background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                color: '#fff',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <ClipboardList size={14} />}
              {submitting ? 'Creating Order...' : 'Create Production Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
