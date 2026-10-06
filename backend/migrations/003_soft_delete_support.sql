-- Migración 003: Soporte para Soft Delete en usuarios y activos
-- Preserva trazabilidad histórica e integridad referencial sin borrado físico.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
