import React, { useState, useEffect } from 'react';
import { ShoppingBag, Factory, Truck, Clock, RefreshCw } from 'lucide-react';
import { api } from '../../api';

export default function MyEntriesView({ managerProfile }) {
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState({ purchases: [], productions: [], sales: [] });
  const [loading, setLoading] = useState(true);

  const managerName = managerProfile?.name || 'Admin';

  useEffect(() => {
    loadMyEntries();
  }, [managerName]);

  async function loadMyEntries() {
    setLoading(true);
    try {
      const res = await api.getMyEntries(managerName);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Combine and sort by createdAt/date
  const allEntries = [
    ...(data.purchases || []).map(p => ({
      ...p,
      type: 'PURCHASE',
      title: `RM Purchase: ${p.raw_material_name}`,
      subtitle: `Supplier: ${p.supplier_name}`,
      code: p.purchase_code,
      qty: p.quantity_kg,
      amount: p.total_amount
    })),
    ...(data.productions || []).map(pr => ({
      ...pr,
      type: 'PRODUCTION',
      title: `Production Batch: ${pr.batch_code}`,
      subtitle: `${pr.machine_name} (${pr.shift_name})`,
      code: pr.batch_code,
      qty: pr.total_finished_kg,
      rmUsed: pr.raw_material_used_kg,
      waste: pr.total_wastage_kg
    })),
    ...(data.sales || []).map(s => ({
      ...s,
      type: 'SALE',
      title: `Sale to ${s.customer_name}`,
      subtitle: `${s.product_name} (${s.gsm} GSM ${s.width_size})`,
      code: s.sale_code,
      qty: s.quantity_kg,
      amount: s.total_amount
    }))
  ].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

  const filteredEntries = filter === 'ALL'
    ? allEntries
    : allEntries.filter(e => e.type === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Entries by <strong style={{ color: 'var(--primary)' }}>{managerName}</strong>
        </div>
        <button className="btn btn-outline btn-sm" onClick={loadMyEntries}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['ALL', 'PURCHASE', 'PRODUCTION', 'SALE'].map(type => (
          <button
            key={type}
            className={`btn btn-sm ${filter === type ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(type)}
            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px' }}
          >
            {type}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          Loading your transactions...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '10px' }}>
          No entries found for {filter}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredEntries.map((entry, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      entry.type === 'PURCHASE'
                        ? 'var(--primary)'
                        : entry.type === 'PRODUCTION'
                        ? 'var(--indigo)'
                        : 'var(--emerald)'
                  }}
                >
                  {entry.type === 'PURCHASE' && <ShoppingBag size={18} color="#fff" />}
                  {entry.type === 'PRODUCTION' && <Factory size={18} color="#fff" />}
                  {entry.type === 'SALE' && <Truck size={18} color="#fff" />}
                </div>

                <div>
                  <div style={{ fontWeight: '600', fontSize: '13.5px' }}>{entry.title}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{entry.subtitle}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> {entry.date} • Code: {entry.code}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                  {entry.qty?.toLocaleString()} KG
                </div>
                {entry.amount ? (
                  <div style={{ fontSize: '12px', color: 'var(--emerald)', fontWeight: '600' }}>
                    ₹{entry.amount?.toLocaleString()}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--amber)' }}>
                    Waste: {entry.waste} KG
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
