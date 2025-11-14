import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import pool from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const defaultNormas = [
  'Forrar el libro y mantenerlo identificado con el nombre del alumno.',
  'No escribir ni subrayar sobre los ejemplares salvo que se indique lo contrario.',
  'Evitar dobleces, manchas o roturas y avisar al AMPA si se detecta algún desperfecto.',
  'Guardar el libro en la mochila o funda para transportarlo de forma segura.',
  'En caso de pérdida o deterioro irreparable, reponer el ejemplar o abonar su coste.'
];

const defaultCatalogoPartes = [
  { nombre: 'Cubierta', opciones: ['Excelente', 'Bueno', 'Revisar', 'Sustituir'] },
  { nombre: 'Lomo', opciones: ['Excelente', 'Bueno', 'Revisar', 'Sustituir'] },
  { nombre: 'Páginas internas', opciones: ['Excelente', 'Bueno', 'Revisar', 'Sustituir'] },
  { nombre: 'Anotaciones', opciones: ['Sin marcas', 'Pocas anotaciones', 'Revisar', 'Sustituir'] }
];

const dbReady = initializeDatabase();

function sanitizeSegment(value, fallback = 'GEN') {
  if (!value || typeof value !== 'string') return fallback;
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6) || fallback;
}

function parseJsonColumn(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map((item) => item.replace(/^"|"$/g, '').trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function toJson(value, emptyFallback = {}) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return JSON.stringify(emptyFallback);
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS materias (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL,
        curso TEXT,
        es_optativa BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS catalogo_partes (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL,
        opciones TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
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
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS libro_ejemplares_libro_serie_idx
      ON libro_ejemplares (libro_id, serie)
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'libro_ejemplares_updated_at'
        ) THEN
          CREATE TRIGGER libro_ejemplares_updated_at
          BEFORE UPDATE ON libro_ejemplares
          FOR EACH ROW
          EXECUTE FUNCTION set_updated_at();
        END IF;
      END;
      $$;
    `);

    await client.query(
      `ALTER TABLE libros ADD COLUMN IF NOT EXISTS curso TEXT DEFAULT ''`
    );
    await client.query(
      `ALTER TABLE libros ADD COLUMN IF NOT EXISTS precio NUMERIC(10,2) DEFAULT 0`
    );
    await client.query(
      `ALTER TABLE libros ADD COLUMN IF NOT EXISTS materia_id INTEGER REFERENCES materias(id)`
    );

    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS ejemplar_id INTEGER REFERENCES libro_ejemplares(id)`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS estado_componentes_entrega JSONB DEFAULT '{}'::jsonb`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS estado_componentes_devolucion JSONB DEFAULT '{}'::jsonb`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS valoracion_entrega TEXT`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS valoracion_devolucion TEXT`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS observaciones_entrega TEXT`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS observaciones_devolucion TEXT`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS normas_aceptadas BOOLEAN DEFAULT false`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS importe_cobrar NUMERIC(10,2) DEFAULT 0`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS abonado BOOLEAN DEFAULT false`
    );
    await client.query(
      `ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS reemplazado_por INTEGER REFERENCES libro_ejemplares(id)`
    );

    await client.query(
      `INSERT INTO materias (nombre, curso, es_optativa)
       VALUES ('Francés', NULL, true)
       ON CONFLICT (nombre) DO NOTHING`
    );

    for (const parte of defaultCatalogoPartes) {
      await client.query(
        `INSERT INTO catalogo_partes (nombre, opciones)
         VALUES ($1, $2)
         ON CONFLICT (nombre) DO NOTHING`,
        [parte.nombre, parte.opciones]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inicializando la base de datos', error);
    throw error;
  } finally {
    client.release();
  }
}

async function generarCodigoEjemplar(client, libroId) {
  const libroResult = await client.query(
    'SELECT titulo, curso FROM libros WHERE id=$1',
    [libroId]
  );

  if (!libroResult.rowCount) {
    throw new Error('Libro no encontrado para generar código');
  }

  const libro = libroResult.rows[0];
  const cursoSegment = sanitizeSegment(libro.curso || 'GEN', 'GEN');
  const tituloSegment = (sanitizeSegment(libro.titulo || 'LIB', 'LIB') + 'XXX').slice(0, 3);

  const serieResult = await client.query(
    'SELECT serie FROM libro_ejemplares WHERE libro_id=$1 ORDER BY serie DESC LIMIT 1',
    [libroId]
  );
  const nextSerie = serieResult.rowCount ? Number(serieResult.rows[0].serie) + 1 : 1;
  const codigo = `${cursoSegment}-${tituloSegment}-${String(nextSerie).padStart(3, '0')}`;

  return { codigo, serie: nextSerie };
}

async function crearEjemplares(libroId, cantidad = 1) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const creados = [];
    for (let i = 0; i < cantidad; i += 1) {
      const { codigo, serie } = await generarCodigoEjemplar(client, libroId);
      const result = await client.query(
        `INSERT INTO libro_ejemplares (libro_id, codigo, serie)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [libroId, codigo, serie]
      );
      creados.push(result.rows[0]);
    }
    await client.query('COMMIT');
    return creados;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (error) {
    next(error);
  }
});

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

app.get('/api/test', async (req, res) => {
  try {
    const librosResult = await pool.query('SELECT * FROM libros');
    const padresResult = await pool.query('SELECT * FROM padres');

    res.json({
      success: true,
      libros: librosResult.rows,
      padres: padresResult.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/test/padre', async (req, res) => {
  try {
    const nombre = 'Padre Prueba ' + Date.now();
    const email = 'prueba' + Date.now() + '@test.com';

    await pool.query(
      'INSERT INTO padres (nombre, email) VALUES ($1, $2)',
      [nombre, email]
    );

    res.json({ success: true, message: 'Padre añadido' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/libros', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        l.*,
        m.id AS materia_id,
        m.nombre AS materia_nombre,
        m.es_optativa AS materia_es_optativa,
        m.curso AS materia_curso,
        COALESCE((
          SELECT COUNT(*) FROM libro_ejemplares le WHERE le.libro_id = l.id
        ), 0) AS ejemplares_creados,
        COALESCE((
          SELECT COUNT(*) FROM libro_ejemplares le WHERE le.libro_id = l.id AND le.disponible = true
        ), 0) AS ejemplares_disponibles
      FROM libros l
      LEFT JOIN materias m ON m.id = l.materia_id
      ORDER BY l.titulo
    `);

    const parsed = rows.map((row) => {
      const totalEjemplares = Number(row.ejemplares_creados ?? row.cantidad_total ?? 0);
      const disponibles = Number(row.ejemplares_disponibles ?? row.cantidad_disponible ?? 0);
      return {
        ...row,
        precio: row.precio ? Number(row.precio) : 0,
        cantidad_total: totalEjemplares,
        cantidad_disponible: disponibles,
        ejemplares_creados: totalEjemplares,
        ejemplares_disponibles: disponibles,
        materia:
          row.materia_id && row.materia_nombre
            ? {
                id: row.materia_id,
                nombre: row.materia_nombre,
                es_optativa: row.materia_es_optativa,
                curso: row.materia_curso,
              }
            : null,
      };
    });

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/libros', async (req, res) => {
  try {
    const {
      titulo,
      autor,
      isbn,
      editorial,
      cantidad_total,
      cantidad_disponible,
      curso,
      precio,
      materia_id,
    } = req.body;

    const precioNumber = Number(precio ?? 0);
    const { rows } = await pool.query(
      `INSERT INTO libros (
        titulo, autor, isbn, editorial, cantidad_total, cantidad_disponible,
        curso, precio, materia_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        titulo,
        autor,
        isbn,
        editorial,
        cantidad_total,
        cantidad_disponible,
        curso || '',
        precioNumber,
        materia_id || null,
      ]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/libros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      autor,
      isbn,
      editorial,
      cantidad_total,
      cantidad_disponible,
      curso,
      precio,
      materia_id,
    } = req.body;

    const precioNumber = Number(precio ?? 0);
    const { rows } = await pool.query(
      `UPDATE libros SET
        titulo=$1,
        autor=$2,
        isbn=$3,
        editorial=$4,
        cantidad_total=$5,
        cantidad_disponible=$6,
        curso=$7,
        precio=$8,
        materia_id=$9
      WHERE id=$10 RETURNING *`,
      [
        titulo,
        autor,
        isbn,
        editorial,
        cantidad_total,
        cantidad_disponible,
        curso || '',
        precioNumber,
        materia_id || null,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/libros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM libros WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Materias / Optativas
app.get('/api/materias', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM materias ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materias', async (req, res) => {
  try {
    const { nombre, curso, es_optativa } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO materias (nombre, curso, es_optativa) VALUES ($1, $2, $3) RETURNING *',
      [nombre, curso || null, Boolean(es_optativa)]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, curso, es_optativa } = req.body;
    const { rows } = await pool.query(
      'UPDATE materias SET nombre=$1, curso=$2, es_optativa=$3 WHERE id=$4 RETURNING *',
      [nombre, curso || null, Boolean(es_optativa), id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM materias WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catálogo de partes/estados
app.get('/api/catalogo/partes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM catalogo_partes ORDER BY id');
    const parsed = rows.map((row) => ({
      ...row,
      opciones: normalizeTextArray(row.opciones),
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/catalogo/partes', async (req, res) => {
  try {
    const { nombre, opciones } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO catalogo_partes (nombre, opciones) VALUES ($1, $2) RETURNING *',
      [nombre, opciones && Array.isArray(opciones) ? opciones : []]
    );
    const [row] = rows;
    res.json({
      ...row,
      opciones: normalizeTextArray(row.opciones),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/catalogo/partes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, opciones } = req.body;
    const { rows } = await pool.query(
      'UPDATE catalogo_partes SET nombre=$1, opciones=$2 WHERE id=$3 RETURNING *',
      [nombre, opciones && Array.isArray(opciones) ? opciones : [], id]
    );
    const [row] = rows;
    res.json({
      ...row,
      opciones: normalizeTextArray(row.opciones),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/catalogo/partes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM catalogo_partes WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ejemplares por libro
app.get('/api/libros/:libroId/ejemplares', async (req, res) => {
  try {
    const { libroId } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM libro_ejemplares WHERE libro_id=$1 ORDER BY serie',
      [libroId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/libros/:libroId/ejemplares', async (req, res) => {
  try {
    const { libroId } = req.params;
    const { cantidad = 1 } = req.body;
    const cantidadSegura = Math.max(1, Number(cantidad) || 1);
    const ejemplares = await crearEjemplares(libroId, cantidadSegura);
    res.json(ejemplares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ejemplares/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      disponible,
      estado_entrega,
      estado_devolucion,
      valoracion_entrega,
      valoracion_devolucion,
      observaciones,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE libro_ejemplares SET
        disponible = COALESCE($1, disponible),
        estado_entrega = COALESCE($2, estado_entrega),
        estado_devolucion = COALESCE($3, estado_devolucion),
        valoracion_entrega = COALESCE($4, valoracion_entrega),
        valoracion_devolucion = COALESCE($5, valoracion_devolucion),
        observaciones = COALESCE($6, observaciones)
       WHERE id=$7
       RETURNING *`,
      [
        typeof disponible === 'boolean' ? disponible : null,
        estado_entrega ? toJson(estado_entrega) : null,
        estado_devolucion ? toJson(estado_devolucion) : null,
        valoracion_entrega || null,
        valoracion_devolucion || null,
        observaciones || null,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alumnos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM alumnos ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alumnos', async (req, res) => {
  try {
    const { nia, nombre, curso } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO alumnos (nia, nombre, curso) VALUES ($1, $2, $3) RETURNING *',
      [nia, nombre, curso]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nia, nombre, curso } = req.body;
    const { rows } = await pool.query(
      'UPDATE alumnos SET nia=$1, nombre=$2, curso=$3 WHERE id=$4 RETURNING *',
      [nia, nombre, curso, id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM alumnos WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/padres', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM padres ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/padres', async (req, res) => {
  try {
    const { nombre, email, telefono } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO padres (nombre, email, telefono) VALUES ($1, $2, $3) RETURNING *',
      [nombre, email, telefono || null]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alumnos/:alumnoId/padres', async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const { rows } = await pool.query(
      'SELECT p.* FROM padres p INNER JOIN alumno_padres ap ON p.id = ap.padre_id WHERE ap.alumno_id = $1',
      [alumnoId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alumnos/:alumnoId/padres/:padreId', async (req, res) => {
  try {
    const { alumnoId, padreId } = req.params;
    await pool.query(
      'INSERT INTO alumno_padres (alumno_id, padre_id) VALUES ($1, $2)',
      [alumnoId, padreId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/alumnos/:alumnoId/padres/:padreId', async (req, res) => {
  try {
    const { alumnoId, padreId } = req.params;
    await pool.query(
      'DELETE FROM alumno_padres WHERE alumno_id=$1 AND padre_id=$2',
      [alumnoId, padreId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/prestamos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.*,
        le.codigo AS ejemplar_codigo
      FROM prestamos p
      LEFT JOIN libro_ejemplares le ON le.id = p.ejemplar_id
      ORDER BY p.created_at DESC
    `);

    const parsed = rows.map((row) => ({
      ...row,
      importe_cobrar: row.importe_cobrar ? Number(row.importe_cobrar) : 0,
      estado_componentes_entrega: parseJsonColumn(row.estado_componentes_entrega),
      estado_componentes_devolucion: parseJsonColumn(row.estado_componentes_devolucion),
      ejemplar_codigo: row.ejemplar_codigo || null,
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prestamos', async (req, res) => {
  const {
    alumno_id,
    libro_id,
    ejemplar_id,
    fecha_prestamo,
    fecha_devolucion_esperada,
    estado_componentes_entrega,
    valoracion_entrega,
    observaciones_entrega,
    normas_aceptadas,
    estado = 'activo',
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!alumno_id || !ejemplar_id) {
      throw new Error('Debes seleccionar un alumno y un ejemplar para registrar el préstamo.');
    }

    const ejemplarResult = await client.query(
      'SELECT id, libro_id, disponible FROM libro_ejemplares WHERE id=$1 FOR UPDATE',
      [ejemplar_id]
    );

    if (!ejemplarResult.rowCount) {
      throw new Error('El ejemplar seleccionado no existe.');
    }

    const ejemplar = ejemplarResult.rows[0];
    if (!ejemplar.disponible) {
      throw new Error('El ejemplar seleccionado no está disponible.');
    }

    const libroDestino = libro_id || ejemplar.libro_id;

    const insertResult = await client.query(
      `INSERT INTO prestamos (
        alumno_id,
        libro_id,
        ejemplar_id,
        fecha_prestamo,
        fecha_devolucion_esperada,
        estado,
        estado_componentes_entrega,
        valoracion_entrega,
        observaciones_entrega,
        normas_aceptadas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        alumno_id,
        libroDestino,
        ejemplar_id,
        fecha_prestamo,
        fecha_devolucion_esperada,
        estado,
        toJson(estado_componentes_entrega),
        valoracion_entrega || null,
        observaciones_entrega || null,
        Boolean(normas_aceptadas),
      ]
    );

    await client.query(
      `UPDATE libro_ejemplares
       SET disponible=false,
           estado_entrega=$1,
           valoracion_entrega=$2,
           observaciones=$3
       WHERE id=$4`,
      [
        toJson(estado_componentes_entrega),
        valoracion_entrega || null,
        observaciones_entrega || null,
        ejemplar_id,
      ]
    );

    await client.query(
      `UPDATE libros
       SET cantidad_disponible = GREATEST(cantidad_disponible - 1, 0)
       WHERE id=$1`,
      [libroDestino]
    );

    await client.query('COMMIT');
    res.json(insertResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put('/api/prestamos/:id', async (req, res) => {
  const {
    fecha_devolucion_real,
    estado,
    estado_componentes_devolucion,
    valoracion_devolucion,
    observaciones_devolucion,
    importe_cobrar,
    abonado,
    normas_aceptadas,
    estado_componentes_entrega,
    valoracion_entrega,
    observaciones_entrega,
    nuevo_ejemplar_id,
  } = req.body;

  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const actualResult = await client.query(
      'SELECT * FROM prestamos WHERE id=$1 FOR UPDATE',
      [id]
    );

    if (!actualResult.rowCount) {
      throw new Error('Préstamo no encontrado');
    }

    const actual = actualResult.rows[0];
    const updates = [];
    const values = [];
    let index = 1;

    const pushUpdate = (column, value) => {
      updates.push(`${column}=$${index}`);
      values.push(value);
      index += 1;
    };

    if (fecha_devolucion_real) pushUpdate('fecha_devolucion_real', fecha_devolucion_real);
    if (estado) pushUpdate('estado', estado);
    if (estado_componentes_devolucion)
      pushUpdate('estado_componentes_devolucion', toJson(estado_componentes_devolucion));
    if (estado_componentes_entrega)
      pushUpdate('estado_componentes_entrega', toJson(estado_componentes_entrega));
    if (valoracion_entrega !== undefined)
      pushUpdate('valoracion_entrega', valoracion_entrega || null);
    if (valoracion_devolucion !== undefined)
      pushUpdate('valoracion_devolucion', valoracion_devolucion || null);
    if (observaciones_entrega !== undefined)
      pushUpdate('observaciones_entrega', observaciones_entrega || null);
    if (observaciones_devolucion !== undefined)
      pushUpdate('observaciones_devolucion', observaciones_devolucion || null);
    if (importe_cobrar !== undefined)
      pushUpdate('importe_cobrar', Number(importe_cobrar) || 0);
    if (typeof abonado === 'boolean') pushUpdate('abonado', abonado);
    if (typeof normas_aceptadas === 'boolean') pushUpdate('normas_aceptadas', normas_aceptadas);

    let nuevoEjemplarAsignado = null;
    if (nuevo_ejemplar_id) {
      const nuevoResult = await client.query(
        'SELECT id, libro_id, disponible FROM libro_ejemplares WHERE id=$1 FOR UPDATE',
        [nuevo_ejemplar_id]
      );
      if (!nuevoResult.rowCount) {
        throw new Error('El ejemplar de reemplazo no existe.');
      }
      const nuevo = nuevoResult.rows[0];
      if (!nuevo.disponible) {
        throw new Error('El ejemplar de reemplazo no está disponible.');
      }
      if (Number(nuevo.libro_id) !== Number(actual.libro_id)) {
        throw new Error('El ejemplar de reemplazo debe pertenecer al mismo libro.');
      }
      pushUpdate('ejemplar_id', nuevo_ejemplar_id);
      pushUpdate('reemplazado_por', nuevo_ejemplar_id);
      nuevoEjemplarAsignado = nuevo_ejemplar_id;
      await client.query(
        'UPDATE libro_ejemplares SET disponible=false WHERE id=$1',
        [nuevo_ejemplar_id]
      );
    }

    if (!updates.length) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No se proporcionaron cambios' });
      return;
    }

    values.push(id);
    const updateResult = await client.query(
      `UPDATE prestamos SET ${updates.join(', ')} WHERE id=$${index} RETURNING *`,
      values
    );

    const nuevoEstado = estado || actual.estado;
    const seDevuelveAhora =
      nuevoEstado === 'devuelto' && !actual.fecha_devolucion_real && fecha_devolucion_real;

    if (seDevuelveAhora && actual.ejemplar_id) {
      await client.query(
        `UPDATE libro_ejemplares
         SET disponible=true,
             estado_devolucion=$1,
             valoracion_devolucion=$2,
             observaciones=$3
         WHERE id=$4`,
        [
          estado_componentes_devolucion
            ? toJson(estado_componentes_devolucion)
            : actual.estado_componentes_devolucion,
          valoracion_devolucion || actual.valoracion_devolucion || null,
          observaciones_devolucion || actual.observaciones_devolucion || null,
          actual.ejemplar_id,
        ]
      );

      await client.query(
        'UPDATE libros SET cantidad_disponible = cantidad_disponible + 1 WHERE id=$1',
        [actual.libro_id]
      );
    }

    if (estado_componentes_entrega || valoracion_entrega || observaciones_entrega) {
      await client.query(
        `UPDATE libro_ejemplares
         SET estado_entrega = COALESCE($1, estado_entrega),
             valoracion_entrega = COALESCE($2, valoracion_entrega),
             observaciones = COALESCE($3, observaciones)
         WHERE id=$4`,
        [
          estado_componentes_entrega ? toJson(estado_componentes_entrega) : null,
          valoracion_entrega || null,
          observaciones_entrega || null,
          nuevoEjemplarAsignado || actual.ejemplar_id,
        ]
      );
    }

    if (estado_componentes_devolucion || valoracion_devolucion || observaciones_devolucion) {
      await client.query(
        `UPDATE libro_ejemplares
         SET estado_devolucion = COALESCE($1, estado_devolucion),
             valoracion_devolucion = COALESCE($2, valoracion_devolucion),
             observaciones = COALESCE($3, observaciones)
         WHERE id=$4`,
        [
          estado_componentes_devolucion ? toJson(estado_componentes_devolucion) : null,
          valoracion_devolucion || null,
          observaciones_devolucion || null,
          actual.ejemplar_id,
        ]
      );
    }

    await client.query('COMMIT');
    res.json(updateResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/prestamos/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `
      SELECT
        p.*,
        a.nombre AS alumno_nombre,
        a.nia AS alumno_nia,
        a.curso AS alumno_curso,
        l.titulo AS libro_titulo,
        l.autor AS libro_autor,
        l.curso AS libro_curso,
        l.precio AS libro_precio,
        m.nombre AS materia_nombre,
        m.es_optativa AS materia_es_optativa,
        le.codigo AS ejemplar_codigo
      FROM prestamos p
      JOIN alumnos a ON a.id = p.alumno_id
      JOIN libros l ON l.id = p.libro_id
      LEFT JOIN materias m ON m.id = l.materia_id
      LEFT JOIN libro_ejemplares le ON le.id = p.ejemplar_id
      WHERE p.id = $1
      `,
      [id]
    );

    if (!rows.length) {
      res.status(404).json({ error: 'Préstamo no encontrado' });
      return;
    }

    const prestamo = rows[0];
    const estadoEntrega = parseJsonColumn(prestamo.estado_componentes_entrega);
    const estadoDevolucion = parseJsonColumn(prestamo.estado_componentes_devolucion);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=prestamo-${prestamo.id}.pdf`
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text('Informe de estado del libro', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Datos del alumno');
    doc.font('Helvetica').text(`Nombre: ${prestamo.alumno_nombre}`);
    doc.text(`NIA: ${prestamo.alumno_nia}`);
    doc.text(`Curso: ${prestamo.alumno_curso || 'No indicado'}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Libro entregado');
    doc.font('Helvetica').text(`Título: ${prestamo.libro_titulo}`);
    doc.text(`Autor: ${prestamo.libro_autor}`);
    doc.text(`Curso: ${prestamo.libro_curso || 'General'}`);
    doc.text(`Materia: ${prestamo.materia_nombre || 'No asignada'}`);
    doc.text(`Optativa: ${prestamo.materia_es_optativa ? 'Sí' : 'No'}`);
    doc.text(`Código ejemplar: ${prestamo.ejemplar_codigo || '-'}`);
    doc.text(`Precio de referencia: ${Number(prestamo.libro_precio || 0).toFixed(2)} €`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Seguimiento');
    doc.font('Helvetica').text(`Fecha de préstamo: ${prestamo.fecha_prestamo || '-'}`);
    doc.text(`Devolución prevista: ${prestamo.fecha_devolucion_esperada || '-'}`);
    doc.text(`Devolución real: ${prestamo.fecha_devolucion_real || 'Pendiente'}`);
    doc.text(`Estado actual: ${prestamo.estado}`);
    doc.text(
      `Importe a cobrar: ${Number(prestamo.importe_cobrar || 0).toFixed(2)} € (${
        prestamo.abonado ? 'abonado' : 'pendiente'
      })`
    );
    doc.moveDown();

    const renderEstados = (titulo, estados) => {
      doc.font('Helvetica-Bold').text(titulo);
      doc.font('Helvetica');
      if (!estados || Object.keys(estados).length === 0) {
        doc.text('Sin datos registrados');
      } else {
        Object.entries(estados).forEach(([parte, valor]) => {
          doc.text(`- ${parte}: ${valor}`);
        });
      }
      doc.moveDown();
    };

    renderEstados('Estado al entregar', estadoEntrega);
    renderEstados('Estado al devolver', estadoDevolucion);

    doc.font('Helvetica-Bold').text('Observaciones');
    doc.font('Helvetica').text(`Entrega: ${prestamo.observaciones_entrega || 'Sin observaciones'}`);
    doc.text(`Devolución: ${prestamo.observaciones_devolucion || 'Sin observaciones'}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Normas de uso');
    doc.font('Helvetica');
    defaultNormas.forEach((norma) => {
      const marcado = prestamo.normas_aceptadas ? '[x]' : '[ ]';
      doc.text(`${marcado} ${norma}`);
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta catch-all para React Router (debe ir AL FINAL, después de todas las rutas API)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Puerto dinámico para Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});