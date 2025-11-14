-- ============================================
-- MIGRACIÓN: Nuevas tablas y columnas para el sistema de gestión de libros AMPA
-- ============================================
-- Este script crea las nuevas tablas y columnas necesarias para:
-- - Gestión de materias y optativas
-- - Catálogo de partes del libro y estados
-- - Ejemplares individuales con códigos únicos
-- - Seguimiento detallado de préstamos con valoraciones
-- ============================================

BEGIN;

-- ============================================
-- 1. NUEVAS TABLAS
-- ============================================

-- Tabla de materias (asignaturas y optativas)
CREATE TABLE IF NOT EXISTS materias (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  curso TEXT,
  es_optativa BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Catálogo de partes del libro y sus opciones de estado
CREATE TABLE IF NOT EXISTS catalogo_partes (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  opciones TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ejemplares individuales de cada libro
CREATE TABLE IF NOT EXISTS libro_ejemplares (
  id SERIAL PRIMARY KEY,
  libro_id INTEGER NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
  codigo VARCHAR(64) UNIQUE NOT NULL,
  serie INTEGER NOT NULL,
  disponible BOOLEAN DEFAULT true,
  estado_entrega JSONB DEFAULT '{}'::jsonb,
  estado_devolucion JSONB DEFAULT '{}'::jsonb,
  valoracion_entrega TEXT,
  valoracion_devolucion TEXT,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. ÍNDICES
-- ============================================

-- Índice único para evitar duplicados de serie por libro
CREATE UNIQUE INDEX IF NOT EXISTS libro_ejemplares_libro_serie_idx
  ON libro_ejemplares (libro_id, serie);

-- ============================================
-- 3. FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at en libro_ejemplares
DROP TRIGGER IF EXISTS libro_ejemplares_updated_at ON libro_ejemplares;
CREATE TRIGGER libro_ejemplares_updated_at
  BEFORE UPDATE ON libro_ejemplares
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================
-- 4. MODIFICACIONES A TABLAS EXISTENTES
-- ============================================

-- Añadir columnas a la tabla libros
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='libros' AND column_name='curso') THEN
    ALTER TABLE libros ADD COLUMN curso TEXT DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='libros' AND column_name='precio') THEN
    ALTER TABLE libros ADD COLUMN precio NUMERIC(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='libros' AND column_name='materia_id') THEN
    ALTER TABLE libros ADD COLUMN materia_id INTEGER REFERENCES materias(id);
  END IF;
END $$;

-- Añadir columnas a la tabla prestamos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='ejemplar_id') THEN
    ALTER TABLE prestamos ADD COLUMN ejemplar_id INTEGER REFERENCES libro_ejemplares(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='estado_componentes_entrega') THEN
    ALTER TABLE prestamos ADD COLUMN estado_componentes_entrega JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='estado_componentes_devolucion') THEN
    ALTER TABLE prestamos ADD COLUMN estado_componentes_devolucion JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='valoracion_entrega') THEN
    ALTER TABLE prestamos ADD COLUMN valoracion_entrega TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='valoracion_devolucion') THEN
    ALTER TABLE prestamos ADD COLUMN valoracion_devolucion TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='observaciones_entrega') THEN
    ALTER TABLE prestamos ADD COLUMN observaciones_entrega TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='observaciones_devolucion') THEN
    ALTER TABLE prestamos ADD COLUMN observaciones_devolucion TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='normas_aceptadas') THEN
    ALTER TABLE prestamos ADD COLUMN normas_aceptadas BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='importe_cobrar') THEN
    ALTER TABLE prestamos ADD COLUMN importe_cobrar NUMERIC(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='abonado') THEN
    ALTER TABLE prestamos ADD COLUMN abonado BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='prestamos' AND column_name='reemplazado_por') THEN
    ALTER TABLE prestamos ADD COLUMN reemplazado_por INTEGER REFERENCES libro_ejemplares(id);
  END IF;
END $$;

-- ============================================
-- 5. DATOS INICIALES
-- ============================================

-- Insertar materia "Francés" como optativa (si no existe)
INSERT INTO materias (nombre, curso, es_optativa)
VALUES ('Francés', NULL, true)
ON CONFLICT (nombre) DO NOTHING;

-- Insertar catálogo base de partes del libro (si no existen)
INSERT INTO catalogo_partes (nombre, opciones)
VALUES 
  ('Cubierta', ARRAY['Excelente', 'Bueno', 'Revisar', 'Sustituir']),
  ('Lomo', ARRAY['Excelente', 'Bueno', 'Revisar', 'Sustituir']),
  ('Páginas internas', ARRAY['Excelente', 'Bueno', 'Revisar', 'Sustituir']),
  ('Anotaciones', ARRAY['Sin marcas', 'Pocas anotaciones', 'Revisar', 'Sustituir'])
ON CONFLICT (nombre) DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICACIÓN (opcional - descomentar para verificar)
-- ============================================
-- SELECT 'materias' as tabla, COUNT(*) as registros FROM materias
-- UNION ALL
-- SELECT 'catalogo_partes', COUNT(*) FROM catalogo_partes
-- UNION ALL
-- SELECT 'libro_ejemplares', COUNT(*) FROM libro_ejemplares;

