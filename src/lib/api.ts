const API_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:3001/api';

export interface Materia {
  id: string;
  nombre: string;
  curso?: string | null;
  es_optativa: boolean;
}

export interface CatalogoParte {
  id: string;
  nombre: string;
  opciones: string[];
}

export interface Libro {
  id: string;
  titulo: string;
  autor: string;
  isbn: string;
  editorial: string;
  cantidad_total: number;
  cantidad_disponible: number;
  curso?: string;
  precio?: number;
  materia_id?: string | null;
  materia?: Materia | null;
  ejemplares_creados?: number;
  ejemplares_disponibles?: number;
}

export interface LibroEjemplar {
  id: string;
  libro_id: string;
  codigo: string;
  serie: number;
  disponible: boolean;
  estado_entrega?: Record<string, string>;
  estado_devolucion?: Record<string, string>;
  valoracion_entrega?: string;
  valoracion_devolucion?: string;
  observaciones?: string;
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
  ejemplar_id?: string;
  ejemplar_codigo?: string | null;
  fecha_prestamo: string;
  fecha_devolucion_esperada: string;
  fecha_devolucion_real?: string;
  estado: string;
  estado_componentes_entrega?: Record<string, string>;
  estado_componentes_devolucion?: Record<string, string>;
  valoracion_entrega?: string | null;
  valoracion_devolucion?: string | null;
  observaciones_entrega?: string | null;
  observaciones_devolucion?: string | null;
  normas_aceptadas?: boolean;
  importe_cobrar?: number;
  abonado?: boolean;
  reemplazado_por?: string | null;
  created_at: string;
}

type PrestamoCreatePayload = {
  alumno_id: string;
  libro_id?: string;
  ejemplar_id: string;
  fecha_prestamo: string;
  fecha_devolucion_esperada: string;
  estado?: string;
  estado_componentes_entrega?: Record<string, string>;
  valoracion_entrega?: string;
  observaciones_entrega?: string;
  normas_aceptadas: boolean;
};

type PrestamoUpdatePayload = Partial<
  Omit<Prestamo, 'id' | 'created_at' | 'alumno_id' | 'libro_id'>
> & {
  nuevo_ejemplar_id?: string;
};

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
    create: (data: Omit<Libro, 'id' | 'ejemplares_creados' | 'ejemplares_disponibles' | 'materia'>): Promise<Libro> =>
      fetchAPI('/libros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Omit<Libro, 'id'>>): Promise<Libro> =>
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
  materias: {
    getAll: (): Promise<Materia[]> => fetchAPI('/materias'),
    create: (data: Omit<Materia, 'id'>): Promise<Materia> =>
      fetchAPI('/materias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Omit<Materia, 'id'>): Promise<Materia> =>
      fetchAPI(`/materias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<{ success: boolean }> =>
      fetchAPI(`/materias/${id}`, { method: 'DELETE' }),
  },
  catalogo: {
    getPartes: (): Promise<CatalogoParte[]> => fetchAPI('/catalogo/partes'),
    createParte: (data: Omit<CatalogoParte, 'id'>): Promise<CatalogoParte> =>
      fetchAPI('/catalogo/partes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updateParte: (id: string, data: Omit<CatalogoParte, 'id'>): Promise<CatalogoParte> =>
      fetchAPI(`/catalogo/partes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    deleteParte: (id: string): Promise<{ success: boolean }> =>
      fetchAPI(`/catalogo/partes/${id}`, { method: 'DELETE' }),
  },
  ejemplares: {
    getByLibro: (libroId: string): Promise<LibroEjemplar[]> =>
      fetchAPI(`/libros/${libroId}/ejemplares`),
    create: (libroId: string, cantidad = 1): Promise<LibroEjemplar[]> =>
      fetchAPI(`/libros/${libroId}/ejemplares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad }),
      }),
    update: (id: string, data: Partial<LibroEjemplar>): Promise<LibroEjemplar> =>
      fetchAPI(`/ejemplares/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
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
    create: (data: PrestamoCreatePayload): Promise<Prestamo> =>
      fetchAPI('/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: PrestamoUpdatePayload): Promise<Prestamo> =>
      fetchAPI(`/prestamos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    generarPDF: (id: string): Promise<Blob> =>
      fetch(`${API_URL}/prestamos/${id}/pdf`).then((response) => {
        if (!response.ok) {
          throw new Error('No se pudo generar el PDF');
        }
        return response.blob();
      }),
  },
};