import React, { useState, useEffect } from 'react';
import { Layers, Package, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../api';

export default function ManagerStockView() {
  const [tab, setTab] = useState('raw'); // 'raw' or 'finished'
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    setLoading(true);
    try {
      const [rm, fg] = await Promise.all([
        api.getRawMaterialStock(),
        api.getFinishedGoodsStock()
      ]);
      setRawMaterials(rm);
      setFinishedGoods(fg);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            className={`mode-btn ${tab === 'raw' ? 'active' : ''}`}
            onClick={() => setTab('raw')}
          >
            <Layers size={14} /> Raw Material
          </button>
          <button
            className={`mode-btn ${tab === 'finished' ? 'active' : ''}`}
            onClick={() => setTab('finished')}
          >
            <Package size={14} /> Finished Goods
          </button>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={loadStock}
          title="Refresh Stock"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          Loading current inventory...
        </div>
      ) : tab === 'raw' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rawMaterials.map(rm => {
            const isLow = rm.current_stock_kg <= rm.min_stock_alert;
            return (
              <div
                key={rm.id}
                style={{
                  background: 'var(--bg-card)',
                  border: isLow ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{rm.name}</span>
                    {isLow && (
                      <span className="pill pill-amber" style={{ fontSize: '10px' }}>
                        <AlertCircle size={10} /> Low Stock
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Code: {rm.code} • Category: {rm.category}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: isLow ? 'var(--amber)' : 'var(--emerald)' }}>
                    {rm.current_stock_kg?.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500' }}>KG</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Min: {rm.min_stock_alert} KG
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {finishedGoods.map(fg => (
            <div
              key={fg.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>
                  {fg.product_name}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--cyan)', fontWeight: '600', marginTop: '2px' }}>
                  {fg.gsm} GSM • {fg.width_size} • {fg.colour}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Grade: {fg.grade} {fg.length_val ? `• ${fg.length_val}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: fg.current_stock_kg > 0 ? 'var(--primary)' : 'var(--text-dim)' }}>
                  {fg.current_stock_kg?.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500' }}>KG</span>
                </div>
                <span className="pill pill-cyan" style={{ fontSize: '10px', marginTop: '4px' }}>
                  {fg.product_code}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
