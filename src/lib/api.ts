const API_URL = 'http://localhost:3001/api';

export interface Libro {
  id: string;
  titulo: string;
  autor: string;
  isbn: string;
  editorial: string;
  cantidad_total: number;
  cantidad_disponible: number;
}

export interface Alumno {
  id: string;
  nia: string;
  nombre: string;
  curso: string;
}

export interface Padre {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
}

export interface Prestamo {
  id: string;
  alumno_id: string;
  libro_id: string;
  fecha_prestamo: string;
  fecha_devolucion_esperada: string;
  fecha_devolucion_real?: string;
  estado: string;
  created_at: string;
}

const fetchAPI = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`${API_URL}${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en la petición');
  }
  return response.json();
};

export const api = {
  libros: {
    getAll: (): Promise<Libro[]> => fetchAPI('/libros'),
    create: (data: Omit<Libro, 'id'>): Promise<Libro> =>
      fetchAPI('/libros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Omit<Libro, 'id'>): Promise<Libro> =>
      fetchAPI(`/libros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<{ success: boolean }> =>
      fetchAPI(`/libros/${id}`, { method: 'DELETE' }),
  },
  alumnos: {
    getAll: (): Promise<Alumno[]> => fetchAPI('/alumnos'),
    create: (data: Omit<Alumno, 'id'>): Promise<Alumno> =>
      fetchAPI('/alumnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Omit<Alumno, 'id'>): Promise<Alumno> =>
      fetchAPI(`/alumnos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<{ success: boolean }> =>
      fetchAPI(`/alumnos/${id}`, { method: 'DELETE' }),
  },
  padres: {
    getAll: (): Promise<Padre[]> => fetchAPI('/padres'),
    create: (data: Omit<Padre, 'id'>): Promise<Padre> =>
      fetchAPI('/padres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    getForAlumno: (alumnoId: string): Promise<Padre[]> =>
      fetchAPI(`/alumnos/${alumnoId}/padres`),
    linkToAlumno: (alumnoId: string, padreId: string): Promise<{ success: boolean }> =>
      fetchAPI(`/alumnos/${alumnoId}/padres/${padreId}`, { method: 'POST' }),
    unlinkFromAlumno: (alumnoId: string, padreId: string): Promise<{ success: boolean }> =>
      fetchAPI(`/alumnos/${alumnoId}/padres/${padreId}`, { method: 'DELETE' }),
  },
  prestamos: {
    getAll: (): Promise<Prestamo[]> => fetchAPI('/prestamos'),
    create: (data: Omit<Prestamo, 'id' | 'created_at'>): Promise<Prestamo> =>
      fetchAPI('/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Prestamo>): Promise<Prestamo> =>
      fetchAPI(`/prestamos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
  },
};
