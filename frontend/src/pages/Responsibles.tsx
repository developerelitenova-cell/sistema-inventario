import { useState, useEffect, useMemo } from 'react';
import { getAssets, getUsers, CATEGORY_LABELS, type Asset, type User } from '../api';
import { useModule } from '../moduleContext';
import { UserCheck, Search, ChevronDown, ChevronUp } from 'lucide-react';

const Responsibles = () => {
  const { module } = useModule();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedResponsibles, setExpandedResponsibles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    Promise.all([getAssets(module), getUsers()])
      .then(([assetsData, usersData]) => {
        setAssets(assetsData);
        setUsers(usersData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [module]);

  // Agrupar activos por responsable
  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    assets.forEach(asset => {
      // Si el activo no tiene un responsable, lo ignoramos para esta vista
      if (!asset.responsible_name || asset.responsible_name.trim() === '') return;
      
      const responsible = asset.responsible_name.trim();
      if (!groups[responsible]) {
        groups[responsible] = [];
      }
      groups[responsible].push(asset);
    });
    return groups;
  }, [assets]);

  // Filtrar responsables basado en el buscador y si son usuarios reales (con foto)
  const filteredResponsibles = useMemo(() => {
    // Validamos que el responsable exista en la tabla de usuarios con foto
    const validResponsibles = new Set(
      users.filter(u => u.photo_url && u.photo_url.trim() !== '').map(u => u.full_name.trim().toLowerCase())
    );

    return Object.keys(groupedAssets)
      .filter(name => {
        const isRealUser = validResponsibles.has(name.toLowerCase());
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
        return isRealUser && matchesSearch;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [groupedAssets, searchTerm, users]);

  const toggleResponsible = (name: string) => {
    setExpandedResponsibles(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  return (
    <div className="animate-fade-in">
      <div className="header" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={28} style={{ color: 'var(--gold)' }} />
            Personal A Cargo
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Listado del personal que tiene activos de la empresa asignados a su nombre.
          </p>
        </div>
        
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Buscar responsable..."
            style={{ paddingLeft: '38px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : filteredResponsibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          {searchTerm ? 'No se encontraron responsables que coincidan con la búsqueda.' : 'No hay activos con responsables asignados en este módulo.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredResponsibles.map((responsible) => {
            const responsibleAssets = groupedAssets[responsible];
            const isExpanded = expandedResponsibles[responsible] || false;
            
            return (
              <div key={responsible} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header (Clicable para expandir) */}
                <div 
                  onClick={() => toggleResponsible(responsible)}
                  style={{ 
                    padding: '20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(0,0,0,0.2)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: 'var(--gold)', color: '#000', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '1.2rem'
                    }}>
                      {responsible.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{responsible}</h3>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                        {responsibleAssets.length} activo{responsibleAssets.length !== 1 ? 's' : ''} a cargo
                      </div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px 20px' }}>
                    <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {responsibleAssets.map((asset) => (
                          <div key={asset.id} style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            borderRadius: '8px', 
                            padding: '12px',
                            border: '1px solid var(--surface-border)',
                            display: 'flex',
                            gap: '12px'
                          }}>
                            {asset.photo_url ? (
                              <img src={asset.photo_url} alt={asset.description || ''} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                            ) : (
                              <div style={{ width: '60px', height: '60px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                Sin foto
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {asset.description || 'Sin descripción'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                Código: {asset.unique_code}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Categoría: {asset.category ? CATEGORY_LABELS[asset.category] : 'No especificada'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Responsibles;
