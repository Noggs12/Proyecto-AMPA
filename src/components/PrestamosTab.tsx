import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, CheckCircle, AlertCircle, Clock, Search, ClipboardCheck, BellRing } from 'lucide-react';
import { api, type Prestamo, type Alumno, type Libro } from '../lib/api';

type PrestamoConDetalles = Prestamo & {
  alumno?: Alumno;
  libro?: Libro;
};

const getDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString().split('T')[0];
};

// ===================================
// 🐛 CORRECCIÓN: Funciones movidas fuera del componente
// Esto resuelve el error "Cannot access 'getEstadoActual' before initialization"
// ===================================

const getDiasRestantes = (fechaDevolucionEsperada: string) => {
  const hoy = new Date();
  // Normalizar a medianoche de hoy para una comparación justa
  hoy.setHours(0, 0, 0, 0); 
  const fechaLimite = new Date(fechaDevolucionEsperada);
  const diferencia = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  return diferencia;
};

const getEstadoActual = (prestamo: Prestamo) => {
  if (prestamo.estado === 'devuelto') return 'devuelto';
  const diasRestantes = getDiasRestantes(prestamo.fecha_devolucion_esperada);
  if (diasRestantes < 0) return 'retrasado';
  return 'activo';
};

const describeDiasRestantes = (fecha: string) => {
  if (!fecha) return 'fecha pendiente';
  const dias = getDiasRestantes(fecha);
  if (dias < 0) {
    const abs = Math.abs(dias);
    return `retrasado ${abs} día${abs === 1 ? '' : 's'}`;
  }
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'resta 1 día';
  return `restan ${dias} días`;
};

// ===================================

export default function PrestamosTab() {
  const [prestamos, setPrestamos] = useState<PrestamoConDetalles[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [libros, setLibros] = useState<Libro[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'activo' | 'devuelto' | 'retrasado'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // CAMBIO 1.1: Añadir fecha_prestamo a formData
  const [formData, setFormData] = useState({
    alumno_id: '',
    libro_id: '',
    fecha_prestamo: new Date().toISOString().split('T')[0], 
    fecha_devolucion_esperada: getDefaultDueDate(),
  });

  useEffect(() => {
    loadPrestamos();
    loadAlumnos();
    loadLibros();
  }, []);

  // useMemo ahora puede acceder a getEstadoActual sin error
  const resumen = useMemo(() => {
    const totalPrestamos = prestamos.length;
    const activos = prestamos.filter((prestamo) => getEstadoActual(prestamo) === 'activo').length;
    const retrasados = prestamos.filter(
      (prestamo) => getEstadoActual(prestamo) === 'retrasado'
    ).length;
    const devueltos = prestamos.filter((prestamo) => prestamo.estado === 'devuelto').length;

    return {
      totalPrestamos,
      activos,
      retrasados,
      devueltos,
    };
  }, [prestamos]);

  const loadPrestamos = async () => {
    try {
      const data = await api.prestamos.getAll();
      const alumnos = await api.alumnos.getAll();
      const libros = await api.libros.getAll();

      const prestamosConDetalles: PrestamoConDetalles[] = data.map(prestamo => ({
        ...prestamo,
        alumno: alumnos.find(a => a.id === prestamo.alumno_id),
        libro: libros.find(l => l.id === prestamo.libro_id),
      }));

      setPrestamos(prestamosConDetalles);
    } catch (error: any) {
      alert('Error al cargar préstamos: ' + error.message);
    }
  };

  const loadAlumnos = async () => {
    try {
      const data = await api.alumnos.getAll();
      setAlumnos(data);
    } catch (error: any) {
      alert('Error al cargar alumnos: ' + error.message);
    }
  };

  const loadLibros = async () => {
    try {
      const data = await api.libros.getAll();
      setLibros(data);
    } catch (error: any) {
      alert('Error al cargar libros: ' + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const libro = libros.find((l) => l.id === formData.libro_id);
    if (!libro || libro.cantidad_disponible <= 0) {
      alert('Este libro no está disponible');
      return;
    }

    // CAMBIO 2.1: Usar la fecha del formulario en lugar de la fecha actual
    const fechaPrestamoISO = formData.fecha_prestamo; 
    const fechaPrestamo = new Date(fechaPrestamoISO);
    const fechaDevolucionEsperada = new Date(formData.fecha_devolucion_esperada);

    if (Number.isNaN(fechaDevolucionEsperada.getTime())) {
      alert('Selecciona una fecha de devolución válida.');
      return;
    }

    // CAMBIO 2.2: La fecha de devolución no puede ser anterior a la fecha de PRESTAMO
    if (fechaDevolucionEsperada < fechaPrestamo) {
      alert('La fecha de devolución no puede ser anterior a la fecha de préstamo.');
      return;
    }

    try {
      await api.prestamos.create({
        alumno_id: formData.alumno_id,
        libro_id: formData.libro_id,
        // CAMBIO 1.2: Enviar la fecha del formulario
        fecha_prestamo: fechaPrestamoISO, 
        fecha_devolucion_esperada: fechaDevolucionEsperada.toISOString().split('T')[0],
        estado: 'activo',
      });

      await api.libros.update(formData.libro_id, {
        ...libro,
        cantidad_disponible: libro.cantidad_disponible - 1
      });
    } catch (error: any) {
      alert('Error: ' + error.message);
      return;
    }

    setShowModal(false);
    setFormData({
      alumno_id: '',
      libro_id: '',
      // CAMBIO 1.3: Resetear fecha_prestamo
      fecha_prestamo: new Date().toISOString().split('T')[0],
      fecha_devolucion_esperada: getDefaultDueDate(),
    });
    loadPrestamos();
    loadLibros();
  };

  const handleDevolucion = async (prestamo: PrestamoConDetalles) => {
    if (!confirm('¿Marcar este libro como devuelto?')) return;

    const fechaDevolucion = new Date().toISOString().split('T')[0];

    try {
      await api.prestamos.update(prestamo.id, {
        fecha_devolucion_real: fechaDevolucion,
        estado: 'devuelto',
      });

      if (prestamo.libro) {
        await api.libros.update(prestamo.libro_id, {
          ...prestamo.libro,
          cantidad_disponible: prestamo.libro.cantidad_disponible + 1
        });
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
      return;
    }

    loadPrestamos();
    loadLibros();
  };
  
  // *** NOTA: getDiasRestantes, getEstadoActual y describeDiasRestantes han sido movidas arriba ***

  const prestamosFiltrados = prestamos.filter((prestamo) => {
    const matchesFilter = filter === 'todos' || getEstadoActual(prestamo) === filter;

    if (!matchesFilter) return false;

    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      prestamo.alumno?.nombre.toLowerCase().includes(search) ||
      prestamo.alumno?.nia.toLowerCase().includes(search) ||
      prestamo.libro?.titulo.toLowerCase().includes(search) ||
      prestamo.libro?.autor.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
              <ClipboardCheck className="w-4 h-4" />
              Entregas y Seguimiento
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-slate-800">
              Controla las entregas y devuelve tranquilidad a las familias
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Visualiza qué packs están activos, quién necesita un recordatorio y marca las
              devoluciones al instante para mantener el stock actualizado.
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                alumno_id: '',
                libro_id: '',
                // Resetear fecha de préstamo al abrir el modal
                fecha_prestamo: new Date().toISOString().split('T')[0], 
                fecha_devolucion_esperada: getDefaultDueDate(),
              });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-full shadow-lg shadow-emerald-900/10 hover:shadow-xl transition-shadow"
          >
            <Plus className="w-4 h-4" />
            Nuevo movimiento AMPA
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardCheck}
          title="Entregas registradas"
          value={resumen.totalPrestamos}
          description="Histórico de packs gestionados desde el AMPA."
          accent="from-emerald-500 to-sky-500"
        />
        <StatCard
          icon={Clock}
          title="Activos en curso"
          value={resumen.activos}
          description="Packs que siguen en manos de las familias."
          accent="from-sky-500 to-blue-500"
        />
        <StatCard
          icon={BellRing}
          title="Recordatorios urgentes"
          value={resumen.retrasados}
          description="Entregas que necesitan seguimiento inmediato."
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          icon={CheckCircle}
          title="Cerrados"
          value={resumen.devueltos}
          description="Material devuelto al stock solidario."
          accent="from-emerald-500 to-teal-500"
        />
      </section>

      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Seguimiento de familias</h3>
            <p className="text-sm text-slate-500">
              Busca por alumnado o libro para localizar entregas y acorta los tiempos de respuesta.
            </p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por alumno o libro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['todos', 'activo', 'retrasado', 'devuelto'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-900/10'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {key === 'todos'
                ? 'Todos'
                : key === 'activo'
                ? 'Activos'
                : key === 'retrasado'
                ? 'Retrasados'
                : 'Devueltos'}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Alumno
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Libro
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Fecha préstamo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Devolución prevista
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {prestamosFiltrados.map((prestamo) => {
                const estadoActual = getEstadoActual(prestamo);
                const diasRestantes = getDiasRestantes(prestamo.fecha_devolucion_esperada);

                return (
                  <tr key={prestamo.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-800">
                        {prestamo.alumno?.nombre || 'Sin registro'}
                      </div>
                      <div className="text-xs text-slate-500">
                        NIA: {prestamo.alumno?.nia || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">
                        {prestamo.libro?.titulo || 'Desconocido'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {prestamo.libro?.autor || 'Autor no indicado'}
                      </div>
                    </td>
                    {/* CAMBIO 3: Mostrar la fecha de préstamo en la tabla */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {new Date(prestamo.fecha_prestamo).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {new Date(prestamo.fecha_devolucion_esperada).toLocaleDateString('es-ES')}
                      {estadoActual !== 'devuelto' && (
                        <div className="text-xs mt-1">
                          {diasRestantes > 0 ? (
                            <span className="text-emerald-600">Faltan {diasRestantes} días</span>
                          ) : diasRestantes === 0 ? (
                            <span className="text-amber-600">Vence hoy</span>
                          ) : (
                            <span className="text-rose-600">
                              Retraso de {Math.abs(diasRestantes)} día
                              {Math.abs(diasRestantes) === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {estadoActual === 'devuelto' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Devuelto
                        </span>
                      )}
                      {estadoActual === 'activo' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <Clock className="w-3.5 h-3.5" />
                          Activo
                        </span>
                      )}
                      {estadoActual === 'retrasado' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Retrasado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {estadoActual !== 'devuelto' && (
                        <button
                          onClick={() => handleDevolucion(prestamo)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Marcar devuelto
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {prestamosFiltrados.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              No hay movimientos para mostrar con este filtro.
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Registrar entrega solidaria</h3>
            <p className="text-sm text-slate-500 mb-4">
              Selecciona al alumno y el libro asociado. Puedes ajustar los días de préstamo según el
              plan del AMPA.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Alumno
                  </label>
                  <select
                    required
                    value={formData.alumno_id}
                    onChange={(e) => setFormData({ ...formData, alumno_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  >
                    <option value="">Seleccionar alumno...</option>
                    {alumnos.map((alumno) => (
                      <option key={alumno.id} value={alumno.id}>
                        {alumno.nombre} ({alumno.nia})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Libro</label>
                  <select
                    required
                    value={formData.libro_id}
                    onChange={(e) => setFormData({ ...formData, libro_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  >
                    <option value="">Seleccionar libro...</option>
                    {libros
                      .filter((libro) => libro.cantidad_disponible > 0)
                      .map((libro) => (
                        <option key={libro.id} value={libro.id}>
                          {libro.titulo} - {libro.autor} ({libro.cantidad_disponible}{' '}
                          disponibles)
                        </option>
                      ))}
                  </select>
                </div>

                {/* CAMBIO 1.4: Nuevo campo de Fecha de Préstamo con fechas anteriores permitidas */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de inicio del préstamo
                  </label>
                  <input
                    type="date"
                    required
                    // Se permite cualquier fecha (no hay restricción "min")
                    value={formData.fecha_prestamo}
                    onChange={(e) =>
                      setFormData({ ...formData, fecha_prestamo: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Puedes registrar entregas realizadas en días anteriores.
                  </p>
                </div>
                {/* FIN CAMBIO 1.4 */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de devolución esperada
                  </label>
                  <input
                    type="date"
                    required
                    // La devolución mínima se enlaza a la fecha de préstamo seleccionada
                    min={formData.fecha_prestamo}
                    value={formData.fecha_devolucion_esperada}
                    onChange={(e) =>
                      setFormData({ ...formData, fecha_devolucion_esperada: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Devolución prevista el{' '}
                    {new Date(formData.fecha_devolucion_esperada).toLocaleDateString('es-ES')} (
                    {describeDiasRestantes(formData.fecha_devolucion_esperada)})
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-medium hover:shadow-lg hover:shadow-emerald-900/10 transition-all"
                >
                  Registrar entrega
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({
                      alumno_id: '',
                      libro_id: '',
                      fecha_prestamo: new Date().toISOString().split('T')[0], 
                      fecha_devolucion_esperada: getDefaultDueDate(),
                    });
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-full font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Se mantiene la función StatCard sin cambios */}
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  description: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-lg shadow-emerald-900/5 border border-slate-100">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-800">{value}</p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-100 text-slate-500">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}