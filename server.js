import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

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
    const { rows } = await pool.query('SELECT * FROM libros ORDER BY titulo');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/libros', async (req, res) => {
  try {
    const { titulo, autor, isbn, editorial, cantidad_total, cantidad_disponible } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO libros (titulo, autor, isbn, editorial, cantidad_total, cantidad_disponible) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [titulo, autor, isbn, editorial, cantidad_total, cantidad_disponible]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/libros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, autor, isbn, editorial, cantidad_total, cantidad_disponible } = req.body;
    const { rows } = await pool.query(
      'UPDATE libros SET titulo=$1, autor=$2, isbn=$3, editorial=$4, cantidad_total=$5, cantidad_disponible=$6 WHERE id=$7 RETURNING *',
      [titulo, autor, isbn, editorial, cantidad_total, cantidad_disponible, id]
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
    const { rows } = await pool.query('SELECT * FROM prestamos ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prestamos', async (req, res) => {
  try {
    const { alumno_id, libro_id, fecha_prestamo, fecha_devolucion_esperada, estado } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO prestamos (alumno_id, libro_id, fecha_prestamo, fecha_devolucion_esperada, estado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [alumno_id, libro_id, fecha_prestamo, fecha_devolucion_esperada, estado]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/prestamos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_devolucion_real, estado } = req.body;
    const { rows } = await pool.query(
      'UPDATE prestamos SET fecha_devolucion_real=$1, estado=$2 WHERE id=$3 RETURNING *',
      [fecha_devolucion_real, estado, id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta catch-all para React Router (debe ir AL FINAL)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Puerto dinámico para Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});