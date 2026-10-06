import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Module } from './api';
import { useWarehouses } from './warehouseContext';

const STORAGE_KEY = 'current_module';

interface ModuleContextValue {
  module: Module;
  setModule: (module: Module) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

const readStored = (): Module => sessionStorage.getItem(STORAGE_KEY) || '';

export const ModuleProvider = ({ children }: { children: ReactNode }) => {
  const { warehouses, loading } = useWarehouses();
  const [module, setModuleState] = useState<Module>(readStored);

  useEffect(() => {
    if (loading || warehouses.length === 0) return;

    // Verificar si el módulo guardado es válido entre las bodegas autorizadas del usuario
    const isValid = warehouses.some((w) => w.key === module);
    if (!module || !isValid) {
      const defaultWarehouse = warehouses[0]?.key || '';
      if (defaultWarehouse) {
        setModuleState(defaultWarehouse);
        sessionStorage.setItem(STORAGE_KEY, defaultWarehouse);
      }
    }
  }, [warehouses, loading, module]);

  const setModule = (next: Module) => {
    setModuleState(next);
    sessionStorage.setItem(STORAGE_KEY, next);
  };

  return <ModuleContext.Provider value={{ module, setModule }}>{children}</ModuleContext.Provider>;
};

export const useModule = (): ModuleContextValue => {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error('useModule debe usarse dentro de ModuleProvider');
  return ctx;
};
