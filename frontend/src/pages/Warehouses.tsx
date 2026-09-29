import { useState } from 'react';
import { Plus, Building2, Save, X, Loader2 } from 'lucide-react';
import { useWarehouses } from '../warehouseContext';
import { createWarehouse, isMasterAdmin } from '../api';
import { getCachedUser } from '../components/LoginGate';

export default function Warehouses() {
  const { warehouses, reload } = useWarehouses();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = getCachedUser();
  const isMaster = isMasterAdmin(user);

  if (!isMaster) {
    return (
      <div className="p-8 text-center text-red-500">
        No tienes permisos para ver esta página. Solo el Administrador Maestro puede gestionar bodegas.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !key) return;

    setLoading(true);
    setError(null);

    try {
      await createWarehouse({ name, key });
      setShowForm(false);
      setName('');
      setKey('');
      reload(); // Recargar la lista de bodegas
    } catch (err: any) {
      setError(err.message || 'Error al crear la bodega');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--primary)] flex items-center">
            <Building2 className="mr-3" />
            Gestión de Bodegas
          </h1>
          <p className="text-slate-500 mt-2">
            Administra las sucursales, empresas o unidades de negocio del sistema.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center">
            <Plus size={18} className="mr-2" />
            Nueva Bodega
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel mb-8 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">Crear Nueva Bodega</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label>
              <span className="block text-sm font-medium text-slate-600 mb-1">Nombre (Visible)</span>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Sede Norte"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label>
              <span className="block text-sm font-medium text-slate-600 mb-1">Clave Interna (ID)</span>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. sede_norte"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                required
              />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex items-center" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
              Guardar Bodega
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel overflow-hidden border border-slate-200 p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-bold text-slate-600">Bodega</th>
              <th className="p-4 font-bold text-slate-600">Clave Interna</th>
              <th className="p-4 font-bold text-slate-600 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500">
                  No hay bodegas registradas en el sistema.
                </td>
              </tr>
            ) : (
              warehouses.map((w) => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-800 font-medium flex items-center">
                    <Building2 size={16} className="text-slate-400 mr-2" />
                    {w.name}
                  </td>
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-sm font-mono border border-slate-200">
                      {w.key}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${w.is_active ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {w.is_active ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
