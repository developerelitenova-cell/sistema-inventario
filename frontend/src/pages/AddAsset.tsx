import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Package } from 'lucide-react';
import { createAsset, estimateAssetValueWithAI, getAreaOptions, INVENTORY_TYPE_LABELS, type Module, type Asset, type InventoryType } from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import CameraCapture from '../components/CameraCapture';

const AddAsset = () => {
  const navigate = useNavigate();
  const { module: currentModule } = useModule();
  const { warehouses } = useWarehouses();
  const [form, setForm] = useState({
    unique_code: '',
    description: '',
    brand_model: '',
    area: '',
    responsible_name: '',
    purchase_price: '',
    purchase_date: '',
    accessories: [] as import('../api').AccessoryItem[],
    observations: '',
    inventory_type: 'activos' as InventoryType,
  });
  const [assetModule, setAssetModule] = useState<Module>(currentModule);

  // Mantener el área dentro de las opciones válidas de la bodega elegida
  // (cambia cuando cambia de bodega, y arranca con la primera por defecto).
  useEffect(() => {
    const options = getAreaOptions(assetModule);
    if (!options.includes(form.area)) {
      setForm((f) => ({ ...f, area: options[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetModule]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAsset, setCreatedAsset] = useState<Asset | null>(null);

  const update = (field: keyof typeof form, value: any) => setForm({ ...form, [field]: value });

  const addAccessory = () => setForm(f => ({ ...f, accessories: [...f.accessories, { name: '' }] }));
  const updateAccessoryName = (index: number, val: string) => {
    const acc = [...form.accessories];
    acc[index].name = val;
    setForm(f => ({ ...f, accessories: acc }));
  };
  const updateAccessoryLinked = (index: number, code: string) => {
    const acc = [...form.accessories];
    acc[index].is_linked_asset = !!code;
    acc[index].linked_asset_code = code || null;
    setForm(f => ({ ...f, accessories: acc }));
  };
  const removeAccessory = (index: number) => {
    const acc = [...form.accessories];
    acc.splice(index, 1);
    setForm(f => ({ ...f, accessories: acc }));
  };
  
  const handleEstimateWithAI = async () => {
    if (!photo) return;
    setEstimating(true);
    setError(null);
    try {
      const estimation = await estimateAssetValueWithAI(photo);
      // Auto-fill form fields, respecting user choice by not overwriting unless empty or wanted (per user comment, but they said "permitame cambiarlo", meaning we CAN auto-fill and they can change it before submitting)
      setForm(prev => ({
        ...prev,
        description: prev.description || estimation.description || '',
        brand_model: prev.brand_model || estimation.brand_model || '',
        purchase_price: estimation.estimated_price_cop ? String(estimation.estimated_price_cop) : prev.purchase_price,
        purchase_date: new Date().toISOString().split('T')[0], // Today's date
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const newAsset = await createAsset({
        unique_code: form.unique_code,
        description: form.description,
        brand_model: form.brand_model,
        module: assetModule,
        area: form.area || undefined,
        responsible_name: form.responsible_name || undefined,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
        purchase_date: form.purchase_date ? new Date(form.purchase_date).toISOString() : undefined,
        accessories: form.accessories,
        observations: form.observations || undefined,
        inventory_type: form.inventory_type,
        photo_url: photo || undefined,
      });
      setCreatedAsset(newAsset);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintQR = () => {
    if (!createdAsset) return;
    const isFutu = createdAsset.module.toLowerCase().includes('futu');
    const logoSrc = isFutu
      ? `${window.location.origin}/logo_futupro.png`
      : `${window.location.origin}/logo_elite_nutrition.jpeg`;
    const accent = isFutu ? '#b8960c' : '#1e3a6e';

    const printWindow = window.open('', '', 'width=400,height=160');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR - ${createdAsset.unique_code}</title>
            <style>
              @page { size: 5cm 1.5cm; margin: 0; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                width: 5cm;
                height: 1.5cm;
                padding: 1mm 1.8mm;
                font-family: 'Courier New', monospace;
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                gap: 1.5mm;
                background: white;
                overflow: hidden;
              }
              .left {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                flex: 1;
                gap: 1.2mm;
                overflow: hidden;
              }
              .logo { max-width: 32mm; max-height: 6mm; object-fit: contain; display: block; }
              .divider {
                width: 100%;
                border-top: 0.3mm solid ${accent};
                display: flex;
                align-items: center;
                justify-content: space-between;
              }
              .dot {
                width: 1mm; height: 1mm; border-radius: 50%;
                background: ${accent}; margin-top: -0.5mm; flex-shrink: 0;
              }
              .code {
                font-size: 5.5pt; font-weight: 800; letter-spacing: 0.08em;
                color: ${accent}; text-align: center; white-space: nowrap;
              }
              .qr { width: 1.2cm; height: 1.2cm; flex-shrink: 0; display: block; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="left">
              <img class="logo" src="${logoSrc}" alt="logo" />
              <div class="divider">
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
              <div class="code">${createdAsset.unique_code}</div>
            </div>
            <img class="qr" src="data:image/png;base64,${createdAsset.qr_data}" alt="QR" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };


  if (createdAsset) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '32px 24px' }}>
          <div style={{ width: '64px', height: '64px', background: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Package size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Activo Registrado</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>El activo {createdAsset.unique_code} ha sido registrado correctamente y está listo para préstamo.</p>
          
          {createdAsset.qr_data && (
            <div style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--surface-border)', marginBottom: '24px' }}>
              <img src={`data:image/png;base64,${createdAsset.qr_data}`} alt="QR" style={{ width: '120px', height: '120px', margin: '0 auto 12px', display: 'block' }} />
              <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '10px' }} onClick={handlePrintQR}>
                Imprimir QR
              </button>
            </div>
          )}
          
          <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>
            Volver al Catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Nuevo Activo</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Registrá un activo nuevo — el código QR se genera automáticamente a partir del código único.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Código único *</div>
            <input className="input-field" required value={form.unique_code} onChange={(e) => update('unique_code', e.target.value)} placeholder="ej. 821500" />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Módulo</div>
            <select className="input-field" value={assetModule} onChange={(e) => setAssetModule(e.target.value as Module)}>
              {warehouses.map((w) => (
                <option key={w.key} value={w.key}>{w.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Descripción *</div>
          <input className="input-field" required value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="ej. Portátil Lenovo" />
        </label>

        <label>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Marca / Modelo</div>
          <input className="input-field" value={form.brand_model} onChange={(e) => update('brand_model', e.target.value)} />
        </label>

        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tipo de Inventario</div>
            <select className="input-field" value={form.inventory_type} onChange={(e) => update('inventory_type', e.target.value as InventoryType)}>
              {(Object.keys(INVENTORY_TYPE_LABELS) as InventoryType[]).map((t) => (
                <option key={t} value={t}>{INVENTORY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Área</div>
            <select 
              className="input-field" 
              value={form.area} 
              onChange={(e) => update('area', e.target.value)}
            >
              {getAreaOptions(assetModule).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Responsable</div>
            <input className="input-field" value={form.responsible_name} onChange={(e) => update('responsible_name', e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Precio de compra (COP)</div>
            <input className="input-field" type="number" min="0" value={form.purchase_price} onChange={(e) => update('purchase_price', e.target.value)} placeholder="ej. 2500000" />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Fecha de compra</div>
            <input className="input-field" type="date" value={form.purchase_date} onChange={(e) => update('purchase_date', e.target.value)} />
          </label>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '-8px 0 0' }}>
          El precio y la fecha son opcionales, pero sin ellos el sistema no puede calcular la depreciación del activo. La categoría se detecta automáticamente a partir de la descripción.
        </p>

        <div style={{ padding: '12px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Accesorios</div>
            <button type="button" className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={addAccessory}>
              + Añadir Accesorio
            </button>
          </div>
          {form.accessories.map((acc, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input 
                className="input-field" 
                placeholder="Nombre (ej. Teclado)" 
                value={acc.name} 
                onChange={e => updateAccessoryName(i, e.target.value)} 
                style={{ flex: 2 }}
              />
              <input 
                className="input-field" 
                placeholder="Código Activo (opcional)" 
                value={acc.linked_asset_code || ''} 
                onChange={e => updateAccessoryLinked(i, e.target.value)} 
                style={{ flex: 1 }}
                title="Si este accesorio es otro activo registrado, ingresa su código aquí."
              />
              <button type="button" className="btn btn-outline" style={{ padding: '8px', color: 'var(--danger-color)' }} onClick={() => removeAccessory(i)} title="Quitar accesorio">
                ✕
              </button>
            </div>
          ))}
          {form.accessories.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Sin accesorios agregados.</p>}
        </div>

        <label>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Observaciones</div>
          <textarea className="input-field" rows={2} value={form.observations} onChange={(e) => update('observations', e.target.value)} />
        </label>

        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={14} /> Foto del activo
          </div>
          <div style={{ maxWidth: '280px' }}>
            <CameraCapture photo={photo} onCapture={setPhoto} onRetake={() => setPhoto(null)} aspect="4 / 3" facingMode="environment" />
          </div>
          
          {photo && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button" 
                onClick={handleEstimateWithAI} 
                className="btn btn-outline" 
                style={{ width: '100%', maxWidth: '280px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--gold)', color: 'var(--gold)' }}
                disabled={estimating}
              >
                {estimating ? 'Estimando con IA...' : '✨ Estimar Valor con IA'}
              </button>
            </div>
          )}
        </div>

        {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem' }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Package size={16} /> {submitting ? 'Guardando...' : 'Crear Activo'}
        </button>
      </form>
    </div>
  );
};

export default AddAsset;
