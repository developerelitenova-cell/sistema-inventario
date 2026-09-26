import { getCachedUser } from './LoginGate';
import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Camera } from 'lucide-react';
import { updateAsset, deleteAsset, isMasterAdmin, uploadAssetPhoto, getAssetDepreciation, formatCOP, CATEGORY_LABELS, STATUS_LABELS, INVENTORY_TYPE_LABELS, getAreaOptions, type Asset, type Module, type AssetStatus, type Depreciation, type InventoryType } from '../api';
import { useWarehouses } from '../warehouseContext';
import CameraCapture from './CameraCapture';

interface AssetEditModalProps {
  asset: Asset;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
}

const AssetEditModal = ({ asset, onClose, onSaved }: AssetEditModalProps) => {
  const { warehouses } = useWarehouses();
  const [form, setForm] = useState({
    description: asset.description ?? '',
    brand_model: asset.brand_model ?? '',
    // Si el activo estaba "pendiente de registro" (código generado en lote,
    // todavía sin datos), completar y guardar el formulario lo pasa a
    // disponible automáticamente -- si no, quedaba pegado en "pendiente"
    // para siempre porque nadie tocaba el desplegable de Estado a mano.
    status: asset.status === 'pending_registration' ? 'available' : asset.status,
    module: asset.module,
    area: asset.area ?? '',
    responsible_name: asset.responsible_name ?? '',
    purchase_price: asset.purchase_price?.toString() ?? '',
    purchase_date: asset.purchase_date ? asset.purchase_date.slice(0, 10) : '',
    accessories: asset.accessories ? [...asset.accessories] : ([] as import('../api').AccessoryItem[]),
    observations: asset.observations ?? '',
    inventory_type: asset.inventory_type,
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>(asset.additional_photos || []);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentUser = getCachedUser();
  const isMaster = isMasterAdmin(currentUser);
  const [error, setError] = useState<string | null>(null);
  const [depreciation, setDepreciation] = useState<Depreciation | null>(null);

  useEffect(() => {
    getAssetDepreciation(asset.id).then(setDepreciation).catch(() => setDepreciation(null));
  }, [asset.id, asset.purchase_price, asset.purchase_date]);

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

  const handleDelete = async () => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este activo? Esta acción no se puede deshacer.")) return;
    setSaving(true);
    try {
      await deleteAsset(asset.id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let saved = await updateAsset(asset.id, {
        description: form.description,
        brand_model: form.brand_model,
        status: form.status,
        module: form.module,
        area: form.area || undefined,
        responsible_name: form.responsible_name || undefined,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
        purchase_date: form.purchase_date ? new Date(form.purchase_date).toISOString() : undefined,
        accessories: form.accessories,
        observations: form.observations || undefined,
        inventory_type: form.inventory_type,
      });
      if (photo) {
        const arr = photo.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], `photo_${asset.id}.jpg`, { type: mime });
        saved = await uploadAssetPhoto(asset.id, file);
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePrintQR = () => {
    const isFutu = asset.module.toLowerCase().includes('futu');
    const logoSrc = isFutu
      ? `${window.location.origin}/logo_futupro.png`
      : `${window.location.origin}/logo_elite_nutrition.jpeg`;
    const accent = isFutu ? '#b8960c' : '#1e3a6e';

    const printWindow = window.open('', '', 'width=400,height=160');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR - ${asset.unique_code}</title>
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
              <div class="code">${asset.unique_code}</div>
            </div>
            <img class="qr" src="data:image/png;base64,${asset.qr_data}" alt="QR" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };


  const modalContent = (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
    }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>Editar Activo — {asset.unique_code}</h2>
          <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Descripción</div>
            <input className="input-field" value={form.description} onChange={(e) => update('description', e.target.value)} required />
          </label>

          <label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Marca / Modelo</div>
            <input className="input-field" value={form.brand_model} onChange={(e) => update('brand_model', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Estado</div>
              <select className="input-field" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Módulo</div>
              <select className="input-field" value={form.module} onChange={(e) => update('module', e.target.value as Module)}>
                {warehouses.map((w) => (
                  <option key={w.key} value={w.key}>{w.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tipo de Inventario</div>
              <select className="input-field" value={form.inventory_type} onChange={(e) => update('inventory_type', e.target.value as InventoryType)}>
                {(Object.keys(INVENTORY_TYPE_LABELS) as InventoryType[]).map((type) => (
                  <option key={type} value={type}>{INVENTORY_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Área</div>
              <select className="input-field" value={form.area} onChange={(e) => update('area', e.target.value)}>
                <option value="">Sin especificar</option>
                {form.area && !getAreaOptions(form.module).includes(form.area) && (
                  <option value={form.area}>{form.area} (valor anterior)</option>
                )}
                {getAreaOptions(form.module).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
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
              <input className="input-field" type="number" min="0" value={form.purchase_price} onChange={(e) => update('purchase_price', e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Fecha de compra</div>
              <input className="input-field" type="date" value={form.purchase_date} onChange={(e) => update('purchase_date', e.target.value)} />
            </label>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px' }}>
            <div>Categoría detectada: <strong style={{ color: 'var(--text-primary)' }}>{asset.category ? CATEGORY_LABELS[asset.category] : '—'}</strong></div>
            {!form.purchase_price && asset.estimated_value != null && (
              <div style={{ marginTop: '4px' }}>
                Valor estimado de referencia: <strong style={{ color: 'var(--text-primary)' }}>{formatCOP(asset.estimated_value)}</strong>
                <span style={{ opacity: 0.8 }}> — no oficial, se reemplaza al cargar el precio real de compra.</span>
              </div>
            )}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--surface-border)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Depreciación:</strong>{' '}
              {depreciation?.computable ? (
                <>
                  Valor en libros <strong style={{ color: 'var(--text-primary)' }}>{formatCOP(depreciation.book_value as number)}</strong>
                  {' '}({depreciation.percent_depreciated}% depreciado, vida útil {depreciation.useful_life_years} años)
                </>
              ) : (
                <span>{depreciation?.reason ?? 'Falta precio y/o fecha de compra.'}</span>
              )}
            </div>
          </div>

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
            <textarea className="input-field" rows={3} value={form.observations} onChange={(e) => update('observations', e.target.value)} />
          </label>

          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={14} /> Foto del activo
            </div>
            {(photo || asset.photo_url) && (
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src={photo || asset.photo_url || ''} 
                  alt={asset.description ?? asset.unique_code} 
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--surface-border)' }} 
                  onClick={() => setShowFullPhoto(true)}
                  title="Click para ver en grande"
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Haz click en la foto para verla completa</span>
              </div>
            )}
            <div style={{ maxWidth: '280px' }}>
              <CameraCapture photo={photo} onCapture={setPhoto} onRetake={() => setPhoto(null)} aspect="4 / 3" facingMode="environment" />
            </div>
          </div>
          
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={14} /> Fotos adicionales ({additionalPhotos.length})
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {additionalPhotos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
                  <img src={p} alt={`Extra ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  <button type="button" onClick={() => setAdditionalPhotos(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
            
            <div style={{ maxWidth: '280px' }}>
              <CameraCapture 
                photo={null} 
                onCapture={(dataUrl) => setAdditionalPhotos(prev => [...prev, dataUrl])} 
                onRetake={() => {}} 
                aspect="4 / 3" 
                facingMode="environment" 
              />
            </div>
          </div>

          {asset.qr_data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface-bg)', padding: '12px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
              <img src={`data:image/png;base64,${asset.qr_data}`} alt="QR" style={{ width: '64px', height: '64px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Código QR asignado</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pégalo en el activo para control de préstamos</div>
                <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handlePrintQR}>
                  <Printer size={14} /> Imprimir QR
                </button>
              </div>
            </div>
          )}

          {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            {isMaster && (
              <button type="button" disabled={saving} onClick={handleDelete} className="btn" style={{ background: 'var(--danger-color)', color: 'white', flex: 1 }}>
                Eliminar
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
      {showFullPhoto && (photo || asset.photo_url) && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => setShowFullPhoto(false)}
        >
          <img 
            src={photo || asset.photo_url || ''} 
            alt="Activo a tamaño completo" 
            style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: '12px' }} 
          />
          <button 
            type="button"
            className="btn btn-outline" 
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}
            onClick={(e) => { e.stopPropagation(); setShowFullPhoto(false); }}
          >
            <X size={28} />
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AssetEditModal;
