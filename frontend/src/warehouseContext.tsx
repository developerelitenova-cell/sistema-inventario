import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getWarehouses, type Warehouse, isMasterAdmin } from './api';
import { getCachedUser } from './components/LoginGate';

interface WarehouseContextValue {
  warehouses: Warehouse[];
  labels: Record<string, string>;
  loading: boolean;
  reload: () => void;
}

const WarehouseContext = createContext<WarehouseContextValue | null>(null);

export const WarehouseProvider = ({ children }: { children: ReactNode }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getWarehouses()
      .then(setWarehouses)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const user = getCachedUser();
  const filteredWarehouses = isMasterAdmin(user) 
    ? warehouses 
    : warehouses.filter(w => user?.warehouses.some(uw => uw.id === w.id));

  const labels = Object.fromEntries(warehouses.map((w) => [w.key, w.name]));

  return (
    <WarehouseContext.Provider value={{ warehouses: filteredWarehouses, labels, loading, reload: load }}>
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouses = (): WarehouseContextValue => {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error('useWarehouses debe usarse dentro de WarehouseProvider');
  return ctx;
};
