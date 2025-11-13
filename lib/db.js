import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { DATABASE_URL } = process.env;

if (typeof DATABASE_URL !== 'string' || DATABASE_URL.trim().length === 0) {
  throw new Error(
    'DATABASE_URL no está definido o no es una cadena válida. Asegúrate de configurar el entorno antes de iniciar el servidor.'
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default pool;