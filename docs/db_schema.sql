-- AMPA Books Schema (DDL)
-- Ejecutar con privilegios suficientes en la base de datos destino

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla: curso_academico
CREATE TABLE IF NOT EXISTS curso_academico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(20) NOT NULL UNIQUE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'planificado',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (fecha_fin > fecha_inicio)
);

-- 2. Tabla: familias
CREATE TABLE IF NOT EXISTS familias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    miembro_ampa BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla: padres (contactos individuales)
CREATE TABLE IF NOT EXISTS padres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    familia_id UUID REFERENCES familias(id) ON DELETE SET NULL,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE,
    telefono VARCHAR(30),
    observaciones TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla: alumnos
CREATE TABLE IF NOT EXISTS alumnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    familia_id UUID REFERENCES familias(id) ON DELETE SET NULL,
    nia VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    curso VARCHAR(40) NOT NULL,
    necesidades_especiales TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla: coordinadores (voluntariado AMPA)
CREATE TABLE IF NOT EXISTS coordinadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    telefono VARCHAR(30),
    rol VARCHAR(40) NOT NULL DEFAULT 'coordinacion',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla: libros
CREATE TABLE IF NOT EXISTS libros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_academico_id UUID REFERENCES curso_academico(id) ON DELETE SET NULL,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(160) NOT NULL,
    isbn VARCHAR(32),
    editorial VARCHAR(120),
    curso_destino VARCHAR(40),
    precio_ampa NUMERIC(10,2) NOT NULL DEFAULT 0,
    cantidad_total INTEGER NOT NULL CHECK (cantidad_total >= 0),
    cantidad_disponible INTEGER NOT NULL CHECK (cantidad_disponible >= 0),
    estado_predominante VARCHAR(20) NOT NULL DEFAULT 'reutilizable',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_libros_curso ON libros(curso_destino);
CREATE INDEX IF NOT EXISTS idx_libros_isbn ON libros(isbn);

-- 7. Tabla: packs (packs solidarios)
CREATE TABLE IF NOT EXISTS packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_academico_id UUID REFERENCES curso_academico(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    curso_destino VARCHAR(40) NOT NULL,
    precio_ampa NUMERIC(10,2) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (curso_academico_id, nombre)
);

-- 8. Tabla: pack_items (detalle de packs)
CREATE TABLE IF NOT EXISTS pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    libro_id UUID NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pack_id, libro_id)
);

-- 9. Tabla: inventario_movimientos
CREATE TABLE IF NOT EXISTS inventario_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    libro_id UUID NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    cantidad INTEGER NOT NULL,
    motivo TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    coordinador_id UUID REFERENCES coordinadores(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (cantidad <> 0)
);

-- 10. Tabla: prestamos (seguimiento de libros)
CREATE TABLE IF NOT EXISTS prestamos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    libro_id UUID NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
    fecha_prestamo DATE NOT NULL,
    fecha_devolucion_esperada DATE NOT NULL,
    fecha_devolucion_real DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos(estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_alumno ON prestamos(alumno_id);

-- 11. Tabla: asignaciones (reservas/entregas)
CREATE TABLE IF NOT EXISTS asignaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_academico_id UUID REFERENCES curso_academico(id) ON DELETE SET NULL,
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    pack_id UUID REFERENCES packs(id) ON DELETE SET NULL,
    libro_id UUID REFERENCES libros(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'reservado',
    fecha_reserva DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega DATE,
    fecha_devolucion DATE,
    observaciones TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (pack_id IS NOT NULL) OR (libro_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_estado ON asignaciones(estado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_alumno ON asignaciones(alumno_id);

-- 12. Tabla: pagos
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asignacion_id UUID REFERENCES asignaciones(id) ON DELETE CASCADE,
    familia_id UUID REFERENCES familias(id) ON DELETE CASCADE,
    monto_total NUMERIC(10,2) NOT NULL,
    monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0,
    metodo VARCHAR(20) NOT NULL DEFAULT 'transferencia',
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_pago DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tabla: comunicaciones
CREATE TABLE IF NOT EXISTS comunicaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    familia_id UUID REFERENCES familias(id) ON DELETE CASCADE,
    coordinador_id UUID REFERENCES coordinadores(id) ON DELETE SET NULL,
    tipo VARCHAR(30) NOT NULL,
    mensaje TEXT NOT NULL,
    canal VARCHAR(20) NOT NULL DEFAULT 'email',
    fecha_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'enviado',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tabla pivote: alumno_padres (multiples tutores)
CREATE TABLE IF NOT EXISTS alumno_padres (
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    padre_id UUID NOT NULL REFERENCES padres(id) ON DELETE CASCADE,
    relacion VARCHAR(40) NOT NULL DEFAULT 'tutor',
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (alumno_id, padre_id)
);

COMMIT;
