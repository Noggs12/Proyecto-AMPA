import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  ClipboardCheck,
  BellRing,
  FileDown,
} from 'lucide-react';
import {
  api,
  type Prestamo,
  type Alumno,
  type Libro,
  type Materia,
  type CatalogoParte,
  type LibroEjemplar,
} from '../lib/api';

type PrestamoConDetalles = Prestamo & {
  alumno?: Alumno;
  libro?: Libro;
};

const getDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString().split('T')[0];
};

const normasUso = [
  'Forrar el libro y mantenerlo identificado con el nombre del alumno.',
  'No escribir ni subrayar sobre los ejemplares salvo indicación expresa.',
  'Avisar al AMPA si se detectan desperfectos para valorarlos de inmediato.',
  'Transportar el libro protegido (mochila/funda) para evitar daños.',
  'En caso de pérdida o deterioro irreparable se repondrá o abonará el ejemplar.',
];

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
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [catalogoPartes, setCatalogoPartes] = useState<CatalogoParte[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'activo' | 'devuelto' | 'retrasado'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [ejemplaresDisponibles, setEjemplaresDisponibles] = useState<LibroEjemplar[]>([]);
  const [estadoEntrega, setEstadoEntrega] = useState<Record<string, string>>({});
  const [estadoDevolucion, setEstadoDevolucion] = useState<Record<string, string>>({});
  const [devolucionModal, setDevolucionModal] = useState<PrestamoConDetalles | null>(null);
  const [reemplazoEjemplares, setReemplazoEjemplares] = useState<LibroEjemplar[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

  // CAMBIO 1.1: Añadir fecha_prestamo a formData
  const [formData, setFormData] = useState({
    alumno_id: '',
    materia_id: '',
    libro_id: '',
    ejemplar_id: '',
    fecha_prestamo: new Date().toISOString().split('T')[0], 
    fecha_devolucion_esperada: getDefaultDueDate(),
    valoracion_entrega: '',
    observaciones_entrega: '',
    normas_aceptadas: false,
  });
  const [devolucionForm, setDevolucionForm] = useState({
    fecha_devolucion_real: new Date().toISOString().split('T')[0],
    valoracion_devolucion: '',
    observaciones_devolucion: '',
    importe_cobrar: 0,
    abonado: false,
    nuevo_ejemplar_id: '',
  });

  useEffect(() => {
    loadPrestamos();
    loadAlumnos();
    loadLibros();
    loadMaterias();
    loadCatalogo();
  }, []);

  useEffect(() => {
    if (catalogoPartes.length === 0) return;
    const base = catalogoPartes.reduce<Record<string, string>>((acc, parte) => {
      acc[parte.nombre] = parte.opciones[0] || '';
      return acc;
    }, {});
    setEstadoEntrega(base);
    setEstadoDevolucion(base);
  }, [catalogoPartes]);

  useEffect(() => {
    if (!formData.libro_id) {
      setEjemplaresDisponibles([]);
      setFormData((prev) => ({ ...prev, ejemplar_id: '' }));
      return;
    }
    loadEjemplaresDisponibles(formData.libro_id);
  }, [formData.libro_id]);

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

  const librosDisponibles = formData.materia_id
    ? libros.filter((libro) => libro.materia_id === formData.materia_id)
    : libros;

  const loadPrestamos = async () => {
    try {
      const data = await api.prestamos.getAll();
      const alumnos = await api.alumnos.getAll();
      const libros = (await api.libros.getAll()).map((libro) => ({
        ...libro,
        materia_id: libro.materia_id ? String(libro.materia_id) : '',
      }));

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
      const normalizados = data.map((libro) => ({
        ...libro,
        materia_id: libro.materia_id ? String(libro.materia_id) : '',
      }));
      setLibros(normalizados);
    } catch (error: any) {
      alert('Error al cargar libros: ' + error.message);
    }
  };

  const loadMaterias = async () => {
    try {
      const data = await api.materias.getAll();
      setMaterias(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  const loadCatalogo = async () => {
    try {
      const data = await api.catalogo.getPartes();
      setCatalogoPartes(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  const loadEjemplaresDisponibles = async (libroId: string) => {
    try {
      const data = await api.ejemplares.getByLibro(libroId);
      setEjemplaresDisponibles(data.filter((ejemplar) => ejemplar.disponible));
    } catch (error: any) {
      alert('Error al cargar ejemplares disponibles: ' + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const libro = libros.find((l) => l.id === formData.libro_id);
    if (!libro) {
      alert('Selecciona un libro válido');
      return;
    }

    if (!formData.ejemplar_id) {
      alert('Debes seleccionar un ejemplar específico para entregar.');
      return;
    }

    if (!formData.normas_aceptadas) {
      alert('Es necesario aceptar las normas para continuar.');
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
        ejemplar_id: formData.ejemplar_id,
        fecha_prestamo: fechaPrestamoISO,
        fecha_devolucion_esperada: fechaDevolucionEsperada.toISOString().split('T')[0],
        estado: 'activo',
        estado_componentes_entrega: estadoEntrega,
        valoracion_entrega: formData.valoracion_entrega,
        observaciones_entrega: formData.observaciones_entrega,
        normas_aceptadas: formData.normas_aceptadas,
      });
    } catch (error: any) {
      alert('Error: ' + error.message);
      return;
    }

    setShowModal(false);
    setFormData({
      alumno_id: '',
      materia_id: '',
      libro_id: '',
      ejemplar_id: '',
      // CAMBIO 1.3: Resetear fecha_prestamo
      fecha_prestamo: new Date().toISOString().split('T')[0],
      fecha_devolucion_esperada: getDefaultDueDate(),
      valoracion_entrega: '',
      observaciones_entrega: '',
      normas_aceptadas: false,
    });
    if (catalogoPartes.length) {
      const base = catalogoPartes.reduce<Record<string, string>>((acc, parte) => {
        acc[parte.nombre] = parte.opciones[0] || '';
        return acc;
      }, {});
      setEstadoEntrega(base);
    }
    loadPrestamos();
    loadLibros();
  };

  const openDevolucionModal = async (prestamo: PrestamoConDetalles) => {
    setDevolucionModal(prestamo);
    setDevolucionForm({
      fecha_devolucion_real: new Date().toISOString().split('T')[0],
      valoracion_devolucion: '',
      observaciones_devolucion: '',
      importe_cobrar: prestamo.importe_cobrar ?? prestamo.libro?.precio ?? 0,
      abonado: prestamo.abonado ?? false,
      nuevo_ejemplar_id: '',
    });

    const base = catalogoPartes.reduce<Record<string, string>>((acc, parte) => {
      acc[parte.nombre] =
        prestamo.estado_componentes_devolucion?.[parte.nombre] ||
        prestamo.estado_componentes_entrega?.[parte.nombre] ||
        parte.opciones[0] ||
        '';
      return acc;
    }, {});
    setEstadoDevolucion(base);

    try {
      const data = await api.ejemplares.getByLibro(prestamo.libro_id);
      setReemplazoEjemplares(data.filter((ejemplar) => ejemplar.disponible));
    } catch (error) {
      console.error(error);
    }
  };

  const closeDevolucionModal = () => {
    setDevolucionModal(null);
    setReemplazoEjemplares([]);
  };

  const handleDevolucionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devolucionModal) return;

    try {
      await api.prestamos.update(devolucionModal.id, {
        fecha_devolucion_real: devolucionForm.fecha_devolucion_real,
        estado: 'devuelto',
        estado_componentes_devolucion: estadoDevolucion,
        valoracion_devolucion: devolucionForm.valoracion_devolucion,
        observaciones_devolucion: devolucionForm.observaciones_devolucion,
        importe_cobrar: devolucionForm.importe_cobrar,
        abonado: devolucionForm.abonado,
        nuevo_ejemplar_id: devolucionForm.nuevo_ejemplar_id || undefined,
      });
      closeDevolucionModal();
      loadPrestamos();
      loadLibros();
    } catch (error: any) {
      alert('No se pudo registrar la devolución: ' + error.message);
    }
  };

  const handleGenerarPDF = async (prestamoId: string) => {
    try {
      setIsGeneratingPdf(prestamoId);
      const blob = await api.prestamos.generarPDF(prestamoId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prestamo-${prestamoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('No se pudo generar el PDF: ' + error.message);
    } finally {
      setIsGeneratingPdf(null);
    }
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
                materia_id: '',
                libro_id: '',
                ejemplar_id: '',
                // Resetear fecha de préstamo al abrir el modal
                fecha_prestamo: new Date().toISOString().split('T')[0], 
                fecha_devolucion_esperada: getDefaultDueDate(),
                valoracion_entrega: '',
                observaciones_entrega: '',
                normas_aceptadas: false,
              });
              if (catalogoPartes.length) {
                const base = catalogoPartes.reduce<Record<string, string>>((acc, parte) => {
                  acc[parte.nombre] = parte.opciones[0] || '';
                  return acc;
                }, {});
                setEstadoEntrega(base);
              }
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
                  Libro / Materia
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Código
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
                      <div className="text-xs text-slate-500">
                        {prestamo.libro?.materia?.nombre || 'Materia no asignada'} ·{' '}
                        {prestamo.libro?.curso || 'Curso general'}
                      </div>
                      <div className="text-xs text-slate-500">
                        Precio: {prestamo.libro?.precio ? `${prestamo.libro.precio.toFixed(2)} €` : 'n/d'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {prestamo.ejemplar_codigo || 'Sin código'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-y-2">
                      <button
                        onClick={() => handleGenerarPDF(prestamo.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-xs font-semibold hover:border-slate-300"
                        disabled={isGeneratingPdf === prestamo.id}
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        {isGeneratingPdf === prestamo.id ? 'Generando...' : 'PDF'}
                      </button>
                      {estadoActual !== 'devuelto' && (
                        <button
                          onClick={() => openDevolucionModal(prestamo)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Registrar devolución
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Materia / Optativa
                  </label>
                  <select
                    value={formData.materia_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        materia_id: e.target.value,
                        libro_id: '',
                        ejemplar_id: '',
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  >
                    <option value="">Ver todos los libros...</option>
                    {materias.map((materia) => (
                      <option key={materia.id} value={materia.id}>
                        {materia.nombre} {materia.es_optativa ? '(Optativa)' : ''}{' '}
                        {materia.curso ? `- ${materia.curso}` : ''}
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
                    {librosDisponibles.map((libro) => (
                      <option key={libro.id} value={libro.id}>
                        {libro.titulo} - {libro.autor} ({libro.cantidad_disponible} disponibles)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ejemplar (código AMPA)
                  </label>
                  <select
                    required
                    value={formData.ejemplar_id}
                    onChange={(e) => setFormData({ ...formData, ejemplar_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                    disabled={!formData.libro_id}
                  >
                    <option value="">
                      {formData.libro_id ? 'Selecciona el ejemplar...' : 'Selecciona un libro primero'}
                    </option>
                    {ejemplaresDisponibles.map((ejemplar) => (
                      <option key={ejemplar.id} value={ejemplar.id}>
                        {ejemplar.codigo}
                      </option>
                    ))}
                  </select>
                  {formData.libro_id && ejemplaresDisponibles.length === 0 && (
                    <p className="text-xs text-rose-500 mt-1">
                      No quedan ejemplares disponibles para este título. Genera nuevos desde el catálogo.
                    </p>
                  )}
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

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Estado del ejemplar entregado</p>
                  {catalogoPartes.map((parte) => (
                    <div key={parte.id} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-32">{parte.nombre}</span>
                      <select
                        value={estadoEntrega[parte.nombre] || ''}
                        onChange={(e) =>
                          setEstadoEntrega((prev) => ({ ...prev, [parte.nombre]: e.target.value }))
                        }
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        {parte.opciones.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valoración / notas de entrega
                  </label>
                  <textarea
                    value={formData.valoracion_entrega}
                    onChange={(e) => setFormData({ ...formData, valoracion_entrega: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Observaciones internas
                  </label>
                  <textarea
                    value={formData.observaciones_entrega}
                    onChange={(e) =>
                      setFormData({ ...formData, observaciones_entrega: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 p-3 bg-slate-50">
                  <label className="inline-flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.normas_aceptadas}
                      onChange={(e) =>
                        setFormData({ ...formData, normas_aceptadas: e.target.checked })
                      }
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                    />
                    <span>
                      La familia conoce y acepta las normas de uso del programa solidario.
                      <ul className="mt-2 space-y-1 text-xs text-slate-500 list-disc pl-4">
                        {normasUso.map((norma) => (
                          <li key={norma}>{norma}</li>
                        ))}
                      </ul>
                    </span>
                  </label>
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
                      materia_id: '',
                      libro_id: '',
                      ejemplar_id: '',
                      fecha_prestamo: new Date().toISOString().split('T')[0], 
                      fecha_devolucion_esperada: getDefaultDueDate(),
                      valoracion_entrega: '',
                      observaciones_entrega: '',
                      normas_aceptadas: false,
                    });
                    if (catalogoPartes.length) {
                      const base = catalogoPartes.reduce<Record<string, string>>((acc, parte) => {
                        acc[parte.nombre] = parte.opciones[0] || '';
                        return acc;
                      }, {});
                      setEstadoEntrega(base);
                    }
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

      {devolucionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">Revisión y cierre</h3>
                <p className="text-sm text-slate-500">
                  {devolucionModal.alumno?.nombre} · {devolucionModal.libro?.titulo}
                </p>
              </div>
              <button
                onClick={closeDevolucionModal}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleDevolucionSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha devolución real
                  </label>
                  <input
                    type="date"
                    required
                    value={devolucionForm.fecha_devolucion_real}
                    onChange={(e) =>
                      setDevolucionForm({ ...devolucionForm, fecha_devolucion_real: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Importe a cobrar (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={devolucionForm.importe_cobrar}
                    onChange={(e) =>
                      setDevolucionForm({
                        ...devolucionForm,
                        importe_cobrar: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 mt-2">
                    <input
                      type="checkbox"
                      checked={devolucionForm.abonado}
                      onChange={(e) =>
                        setDevolucionForm({ ...devolucionForm, abonado: e.target.checked })
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                    />
                    Importe abonado / libro repuesto por la familia
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sustituir por ejemplar
                  </label>
                  <select
                    value={devolucionForm.nuevo_ejemplar_id}
                    onChange={(e) =>
                      setDevolucionForm({ ...devolucionForm, nuevo_ejemplar_id: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  >
                    <option value="">No sustituir (revisión del mismo ejemplar)</option>
                    {reemplazoEjemplares.map((ejemplar) => (
                      <option key={ejemplar.id} value={ejemplar.id}>
                        {ejemplar.codigo}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Usa esta opción si entregan un ejemplar nuevo para dejarlo asignado al préstamo.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Estado al devolver</p>
                {catalogoPartes.map((parte) => (
                  <div key={parte.id} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-32">{parte.nombre}</span>
                    <select
                      value={estadoDevolucion[parte.nombre] || ''}
                      onChange={(e) =>
                        setEstadoDevolucion((prev) => ({ ...prev, [parte.nombre]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      {parte.opciones.map((opcion) => (
                        <option key={opcion} value={opcion}>
                          {opcion}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valoración AMPA
                  </label>
                  <textarea
                    rows={3}
                    value={devolucionForm.valoracion_devolucion}
                    onChange={(e) =>
                      setDevolucionForm({ ...devolucionForm, valoracion_devolucion: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={devolucionForm.observaciones_devolucion}
                    onChange={(e) =>
                      setDevolucionForm({
                        ...devolucionForm,
                        observaciones_devolucion: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-medium hover:shadow-lg hover:shadow-emerald-900/10 transition-all"
                >
                  Guardar devolución
                </button>
                <button
                  type="button"
                  onClick={closeDevolucionModal}
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