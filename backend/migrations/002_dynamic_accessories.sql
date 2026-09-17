-- Migración 002: Transición de 3 accesorios estáticos a una lista JSON dinámica

-- 1. Agregar la nueva columna tipo JSONB
ALTER TABLE assets ADD COLUMN accessories JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar datos existentes: agrupar accessory_1, accessory_2 y accessory_3 en el array JSONB
UPDATE assets
SET accessories = (
    SELECT COALESCE(jsonb_agg(acc), '[]'::jsonb)
    FROM (
        SELECT accessory_1 AS acc WHERE accessory_1 IS NOT NULL AND TRIM(accessory_1) != ''
        UNION ALL
        SELECT accessory_2 WHERE accessory_2 IS NOT NULL AND TRIM(accessory_2) != ''
        UNION ALL
        SELECT accessory_3 WHERE accessory_3 IS NOT NULL AND TRIM(accessory_3) != ''
    ) sub
)
WHERE accessory_1 IS NOT NULL OR accessory_2 IS NOT NULL OR accessory_3 IS NOT NULL;

-- 3. Asegurar que los registros sin accesorios tengan un array vacío
UPDATE assets SET accessories = '[]'::jsonb WHERE accessories IS NULL;

-- 4. Eliminar las columnas antiguas
ALTER TABLE assets DROP COLUMN accessory_1;
ALTER TABLE assets DROP COLUMN accessory_2;
ALTER TABLE assets DROP COLUMN accessory_3;
