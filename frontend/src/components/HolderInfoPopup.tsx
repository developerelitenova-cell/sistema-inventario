import { useState, useEffect } from 'react';
import { getAssetHolder, type AssetHolderInfo } from '../api';
import UserProfileCard from './UserProfileCard';
import { formatBogotaTime } from '../utils/dateUtils';
import { Loader2 } from 'lucide-react';

interface HolderInfoPopupProps {
  assetId: number;
}

export default function HolderInfoPopup({ assetId }: HolderInfoPopupProps) {
  const [holder, setHolder] = useState<AssetHolderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssetHolder(assetId)
      .then(setHolder)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Loader2 size={14} className="animate-spin" /> Cargando datos...
      </div>
    );
  }

  if (error || !holder) {
    return <div className="text-sm text-red-500">Error al cargar responsable</div>;
  }

  return (
    <div className="mt-2 bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.05)] rounded-xl p-3">
      <UserProfileCard 
        user={holder.user} 
        subtitle={`${holder.type === 'loan' ? 'Préstamo' : 'Asignado'} desde ${formatBogotaTime(holder.since)}`} 
      />
      {holder.notes && (
        <div className="mt-2 text-sm text-[var(--text-secondary)] bg-white p-2 rounded-lg border border-[rgba(0,0,0,0.05)]">
          <strong>Notas: </strong>{holder.notes}
        </div>
      )}
    </div>
  );
}
