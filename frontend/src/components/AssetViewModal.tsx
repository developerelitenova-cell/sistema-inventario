import { type Asset, STATUS_LABELS, CATEGORY_LABELS, INVENTORY_TYPE_LABELS } from '../api';
import { X, User as UserIcon } from 'lucide-react';
import HolderInfoPopup from './HolderInfoPopup';

interface AssetViewModalProps {
  asset: Asset;
  onClose: () => void;
}

export default function AssetViewModal({ asset, onClose }: AssetViewModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-panel relative w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--danger-color)] transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="title" style={{ margin: 0, fontSize: '1.5rem' }}>Detalle de Activo</h2>
            <span className={`badge badge-${asset.status}`}>
              {STATUS_LABELS[asset.status]}
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              {asset.photo_url || asset.appsheet_photo_ref ? (
                <img
                  src={asset.photo_url || asset.appsheet_photo_ref!}
                  alt={asset.description || 'Activo'}
                  className="w-full h-auto rounded-xl border"
                  style={{ maxHeight: '400px', objectFit: 'contain', borderColor: 'rgba(0,0,0,0.1)' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-xl flex items-center justify-center text-[var(--text-secondary)]">
                  Sin imagen
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Código</label>
                <div className="font-mono text-lg">{asset.unique_code}</div>
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Descripción</label>
                <div className="text-base">{asset.description || 'N/A'}</div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Marca / Modelo</label>
                <div className="text-base">{asset.brand_model || 'N/A'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Tipo</label>
                  <div className="text-sm">{INVENTORY_TYPE_LABELS[asset.inventory_type]}</div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Categoría</label>
                  <div className="text-sm">{asset.category ? CATEGORY_LABELS[asset.category] : 'N/A'}</div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Área</label>
                  <div className="text-sm">{asset.area || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold flex items-center gap-1">
                    <UserIcon size={12} /> Responsable
                  </label>
                  {(asset.status === 'assigned' || asset.status === 'loaned') ? (
                    <HolderInfoPopup assetId={asset.id} />
                  ) : (
                    <div className="text-sm mt-1">{asset.responsible_name || 'N/A'}</div>
                  )}
                </div>
              </div>

              {asset.observations && (
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Observaciones</label>
                  <div className="text-sm bg-black/5 p-3 rounded-lg whitespace-pre-wrap">{asset.observations}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
