import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Search,
  School,
  Boxes,
  Recycle,
  Percent,
  Layers,
  ListChecks
} from 'lucide-react';
import { api, type Libro, type Materia, type LibroEjemplar, type CatalogoParte } from '../lib/api';

export default function LibrosTab() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLibro, setSelectedLibro] = useState<Libro | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [showMateriasPanel, setShowMateriasPanel] = useState(false);
  const [materiaForm, setMateriaForm] = useState({
    id: '',
    nombre: '',
    curso: '',
    es_optativa: false,
  });
  const [isEditingMateria, setIsEditingMateria] = useState(false);
  const [catalogoPartes, setCatalogoPartes] = useState<CatalogoParte[]>([]);
  const [catalogoForm, setCatalogoForm] = useState({
    id: '',
    nombre: '',
    opciones: '',
  });
  const [isEditingParte, setIsEditingParte] = useState(false);
  const [ejemplarModal, setEjemplarModal] = useState<{
    open: boolean;
    libro: Libro | null;
    data: LibroEjemplar[];
  }>({
    open: false,
    libro: null,
    data: [],
  });
  const [cantidadEjemplares, setCantidadEjemplares] = useState(1);
  const [isLoadingEjemplares, setIsLoadingEjemplares] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    isbn: '',
    editorial: '',
    curso: '',
    precio: 0,
    materia_id: '',
    cantidad_total: 0,
    cantidad_disponible: 0,
  });

  const resumen = useMemo(() => {
    const totalLibros = libros.length;
    const ejemplaresTotales = libros.reduce((acc, libro) => acc + (libro.cantidad_total || 0), 0);
    const ejemplaresDisponibles = libros.reduce(
      (acc, libro) => acc + (libro.cantidad_disponible || 0),
      0
    );
    const ejemplaresReservados = ejemplaresTotales - ejemplaresDisponibles;
    const disponibilidad =
      ejemplaresTotales === 0 ? 0 : Math.round((ejemplaresDisponibles / ejemplaresTotales) * 100);

    return {
      totalLibros,
      ejemplaresTotales,
      ejemplaresDisponibles,
      ejemplaresReservados,
      disponibilidad,
    };
  }, [libros]);

  useEffect(() => {
    loadLibros();
    loadMaterias();
    loadCatalogo();
  }, []);

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
      alert('Error al cargar materias: ' + error.message);
    }
  };

  const resetMateriaForm = () => {
    setMateriaForm({
      id: '',
      nombre: '',
      curso: '',
      es_optativa: false,
    });
    setIsEditingMateria(false);
  };

  const handleMateriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingMateria && materiaForm.id) {
        await api.materias.update(materiaForm.id, {
          nombre: materiaForm.nombre,
          curso: materiaForm.curso || null,
          es_optativa: materiaForm.es_optativa,
        });
      } else {
        await api.materias.create({
          nombre: materiaForm.nombre,
          curso: materiaForm.curso || null,
          es_optativa: materiaForm.es_optativa,
        });
      }
      resetMateriaForm();
      loadMaterias();
    } catch (error: any) {
      alert('Error al guardar la materia: ' + error.message);
    }
  };

  const handleMateriaEdit = (materia: Materia) => {
    setMateriaForm({
      id: materia.id,
      nombre: materia.nombre,
      curso: materia.curso || '',
      es_optativa: materia.es_optativa,
    });
    setIsEditingMateria(true);
    setShowMateriasPanel(true);
  };

  const handleMateriaDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta materia del catálogo?')) return;
    try {
      await api.materias.delete(id);
      if (materiaForm.id === id) {
        resetMateriaForm();
      }
      loadMaterias();
    } catch (error: any) {
      alert('No se pudo eliminar la materia: ' + error.message);
    }
  };

  const loadCatalogo = async () => {
    try {
      const data = await api.catalogo.getPartes();
      const normalizados = data.map((parte) => ({
        ...parte,
        id: String(parte.id),
        opciones: parte.opciones || [],
      }));
      setCatalogoPartes(normalizados);
    } catch (error: any) {
      console.error(error);
    }
  };

  const resetCatalogoForm = () => {
    setCatalogoForm({
      id: '',
      nombre: '',
      opciones: '',
    });
    setIsEditingParte(false);
  };

  const handleCatalogoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const opciones = catalogoForm.opciones
      .split(',')
      .map((opcion) => opcion.trim())
      .filter((opcion) => opcion.length > 0);

    if (opciones.length === 0) {
      alert('Añade al menos una opción de estado.');
      return;
    }

    try {
      if (isEditingParte && catalogoForm.id) {
        await api.catalogo.updateParte(catalogoForm.id, {
          nombre: catalogoForm.nombre,
          opciones,
        });
      } else {
        await api.catalogo.createParte({
          nombre: catalogoForm.nombre,
          opciones,
        });
      }
      resetCatalogoForm();
      loadCatalogo();
    } catch (error: any) {
      alert('No se pudo guardar el catálogo: ' + error.message);
    }
  };

  const handleCatalogoEdit = (parte: CatalogoParte) => {
    setCatalogoForm({
      id: parte.id,
      nombre: parte.nombre,
      opciones: parte.opciones.join(', '),
    });
    setIsEditingParte(true);
    setShowMateriasPanel(true);
  };

  const handleCatalogoDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta parte del catálogo?')) return;
    try {
      await api.catalogo.deleteParte(id);
      if (catalogoForm.id === id) resetCatalogoForm();
      loadCatalogo();
    } catch (error: any) {
      alert('No se pudo eliminar la parte: ' + error.message);
    }
  };

  const openEjemplarModal = async (libro: Libro) => {
    setEjemplarModal({ open: true, libro, data: [] });
    setIsLoadingEjemplares(true);
    try {
      const data = await api.ejemplares.getByLibro(libro.id);
      setEjemplarModal({ open: true, libro, data });
    } catch (error: any) {
      alert('Error al cargar ejemplares: ' + error.message);
    } finally {
      setIsLoadingEjemplares(false);
    }
  };

  const closeEjemplarModal = () => {
    setEjemplarModal({ open: false, libro: null, data: [] });
    setCantidadEjemplares(1);
  };

  const refreshEjemplares = async () => {
    if (!ejemplarModal.libro) return;
    try {
      const data = await api.ejemplares.getByLibro(ejemplarModal.libro.id);
      setEjemplarModal((prev) => ({ ...prev, data }));
      loadLibros();
    } catch (error: any) {
      alert('Error al refrescar ejemplares: ' + error.message);
    }
  };

  const handleCrearEjemplares = async () => {
    if (!ejemplarModal.libro) return;
    try {
      await api.ejemplares.create(ejemplarModal.libro.id, cantidadEjemplares);
      await refreshEjemplares();
      setCantidadEjemplares(1);
    } catch (error: any) {
      alert('No se pudieron generar los ejemplares: ' + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedLibro) {
        await api.libros.update(selectedLibro.id, formData);
      } else {
        await api.libros.create(formData);
      }

      setShowModal(false);
      setFormData({
        titulo: '',
        autor: '',
        isbn: '',
        editorial: '',
        curso: '',
        precio: 0,
        materia_id: '',
        cantidad_total: 0,
        cantidad_disponible: 0,
      });
      setSelectedLibro(null);
      loadLibros();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (libro: Libro) => {
    setSelectedLibro(libro);
    setFormData({
      titulo: libro.titulo,
      autor: libro.autor,
      isbn: libro.isbn || '',
      editorial: libro.editorial,
      curso: libro.curso || '',
      precio: libro.precio || 0,
      materia_id: libro.materia_id ? String(libro.materia_id) : '',
      cantidad_total: libro.cantidad_total,
      cantidad_disponible: libro.cantidad_disponible,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este libro?')) return;

    try {
      await api.libros.delete(id);
      loadLibros();
    } catch (error: any) {
      alert('Error al eliminar libro: ' + error.message);
    }
  };

  const filteredLibros = libros.filter((libro) => {
    const search = searchTerm.toLowerCase();
    return (
      libro.titulo.toLowerCase().includes(search) ||
      libro.autor.toLowerCase().includes(search) ||
      (libro.isbn && libro.isbn.toLowerCase().includes(search)) ||
      libro.editorial.toLowerCase().includes(search) ||
      (libro.curso && libro.curso.toLowerCase().includes(search)) ||
      (libro.materia?.nombre && libro.materia.nombre.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-600 text-xs font-medium">
              <School className="w-4 h-4" />
              Packs solidarios
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-slate-800">Catálogo AMPA listo para circular</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Actualiza el inventario compartido, detecta qué títulos necesitan reposición y prepara
              los packs por curso con información fiable para las familias.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedLibro(null);
              setFormData({
                titulo: '',
                autor: '',
                isbn: '',
                editorial: '',
                curso: '',
                precio: 0,
                materia_id: '',
                cantidad_total: 0,
                cantidad_disponible: 0,
              });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-medium rounded-full shadow-lg shadow-sky-900/10 hover:shadow-xl transition-shadow"
          >
            <Plus className="w-4 h-4" />
            Añadir nuevo título
          </button>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
              <Layers className="w-4 h-4" />
              Materias y optativas
            </span>
            <h3 className="text-lg font-semibold text-slate-800 mt-2">Catálogo base editable</h3>
            <p className="text-sm text-slate-500">
              Añade asignaturas, marca si son optativas y vincúlalas a cada título para personalizar los
              packs por curso.
            </p>
          </div>
          <button
            onClick={() => setShowMateriasPanel((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
          >
            <ListChecks className="w-4 h-4" />
            {showMateriasPanel ? 'Ocultar catálogo' : 'Gestionar catálogo'}
          </button>
        </div>

        {showMateriasPanel && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleMateriaSubmit}
              className="p-5 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">
                  {isEditingMateria ? 'Editar materia' : 'Nueva materia'}
                </h4>
                {isEditingMateria && (
                  <button
                    type="button"
                    onClick={resetMateriaForm}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={materiaForm.nombre}
                  onChange={(e) => setMateriaForm({ ...materiaForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Curso</label>
                <input
                  type="text"
                  value={materiaForm.curso}
                  onChange={(e) => setMateriaForm({ ...materiaForm, curso: e.target.value })}
                  placeholder="Ej: 1º ESO, 6º EP..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <label className="inline-flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={materiaForm.es_optativa}
                  onChange={(e) =>
                    setMateriaForm({ ...materiaForm, es_optativa: e.target.checked })
                  }
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                />
                Es optativa
              </label>
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium"
              >
                {isEditingMateria ? 'Actualizar materia' : 'Registrar materia'}
              </button>
            </form>

            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">Nombre</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">Curso</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">Optativa</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {materias.map((materia) => (
                    <tr key={materia.id}>
                      <td className="px-4 py-2 font-medium text-slate-700">{materia.nombre}</td>
                      <td className="px-4 py-2 text-slate-500">{materia.curso || 'General'}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            materia.es_optativa
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {materia.es_optativa ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <button
                          onClick={() => handleMateriaEdit(materia)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:text-emerald-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMateriaDelete(materia.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {materias.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">
                        Aún no hay materias registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-2 mt-4 border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Catálogo de estados del libro</h4>
                  <p className="text-xs text-slate-500">
                    Define las partes a revisar y las opciones disponibles en cada entrega/devolución.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleCatalogoSubmit}
                  className="p-5 rounded-2xl border border-slate-100 bg-white space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-slate-700">
                      {isEditingParte ? 'Editar parte' : 'Nueva parte'}
                    </h5>
                    {isEditingParte && (
                      <button
                        type="button"
                        onClick={resetCatalogoForm}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                    <input
                      type="text"
                      required
                      value={catalogoForm.nombre}
                      onChange={(e) => setCatalogoForm({ ...catalogoForm, nombre: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Opciones (separadas por coma)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={catalogoForm.opciones}
                      onChange={(e) => setCatalogoForm({ ...catalogoForm, opciones: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium"
                  >
                    {isEditingParte ? 'Actualizar parte' : 'Añadir parte'}
                  </button>
                </form>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
                  {catalogoPartes.map((parte) => (
                    <div
                      key={parte.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">{parte.nombre}</p>
                        <div className="space-x-2">
                          <button
                            onClick={() => handleCatalogoEdit(parte)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:text-emerald-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCatalogoDelete(parte.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parte.opciones.map((opcion) => (
                          <span
                            key={opcion}
                            className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600"
                          >
                            {opcion}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {catalogoPartes.length === 0 && (
                    <p className="text-sm text-slate-500 text-center">
                      Aún no hay partes configuradas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          title="Títulos gestionados"
          value={resumen.totalLibros}
          description="Libros dados de alta en el programa AMPA."
          accent="from-sky-500 to-blue-500"
        />
        <StatCard
          icon={Boxes}
          title="Ejemplares totales"
          value={resumen.ejemplaresTotales}
          description="Suma de unidades entre todos los títulos."
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={Recycle}
          title="Ejemplares en circulación"
          value={resumen.ejemplaresReservados}
          description="Material prestado o reservado por las familias."
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          icon={Percent}
          title="Disponibilidad actual"
          value={resumen.disponibilidad}
          suffix="%"
          description={`${resumen.ejemplaresDisponibles} ejemplares listos para entregar`}
          accent="from-emerald-500 to-sky-500"
        />
      </section>

      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Inventario colaborativo</h3>
            <p className="text-sm text-slate-500">
              Filtra por título, autor o ISBN. Escanea códigos de barras para ubicar ejemplares.
            </p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por título, autor, ISBN o editorial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredLibros.map((libro) => (
            <article
              key={libro.id}
              className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-lg shadow-emerald-900/5 transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-sky-500 via-emerald-500 to-blue-500 opacity-80" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-sky-100 text-sky-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 line-clamp-2">
                      {libro.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">
                      {libro.editorial || 'Editorial no indicada'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-400">ID {libro.id.slice(0, 6)}…</span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-700">Autor:</span> {libro.autor}
                </p>
                {libro.isbn && (
                  <p>
                    <span className="font-medium text-slate-700">ISBN:</span> {libro.isbn}
                  </p>
                )}
                <p>
                  <span className="font-medium text-slate-700">Curso:</span> {libro.curso || 'General'}
                </p>
                <p>
                  <span className="font-medium text-slate-700">Materia:</span>{' '}
                  {libro.materia ? (
                    <span>
                      {libro.materia.nombre}{' '}
                      {libro.materia.es_optativa && (
                        <span className="text-amber-600 text-xs font-semibold ml-1">Optativa</span>
                      )}
                    </span>
                  ) : (
                    'Sin asignar'
                  )}
                </p>
                <p>
                  <span className="font-medium text-slate-700">Precio referencia:</span>{' '}
                  {typeof libro.precio === 'number' ? `${libro.precio.toFixed(2)} €` : 'Sin definir'}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Disponibilidad</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {libro.cantidad_disponible} / {libro.cantidad_total}{' '}
                    <span
                      className={`text-xs font-medium ml-1 ${
                        libro.cantidad_disponible > 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {libro.cantidad_disponible > 0 ? 'Listo' : 'Agotar stock'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Ejemplares generados: {libro.ejemplares_creados ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEjemplarModal(libro)}
                    className="inline-flex items-center justify-center px-3 h-9 rounded-full border border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 text-xs font-semibold transition-colors"
                  >
                    Gestionar
                  </button>
                  <button
                    onClick={() => handleEdit(libro)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-500 hover:border-sky-200 hover:text-sky-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(libro.id)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filteredLibros.length === 0 && libros.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-500 border border-dashed border-slate-200 rounded-3xl">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            No hay libros registrados todavía. Añade el primer título para empezar.
          </div>
        )}

        {filteredLibros.length === 0 && libros.length > 0 && (
          <div className="text-center py-16 text-sm text-slate-500 border border-dashed border-slate-200 rounded-3xl">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            No se encontraron libros con ese criterio de búsqueda. Prueba con otro filtro.
          </div>
        )}
      </section>

      {ejemplarModal.open && ejemplarModal.libro && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">
                  Ejemplares de {ejemplarModal.libro.titulo}
                </h3>
                <p className="text-sm text-slate-500">
                  Curso {ejemplarModal.libro.curso || 'General'} · Código base generado automáticamente
                </p>
              </div>
              <button
                onClick={closeEjemplarModal}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Generar nuevos códigos
                </label>
                <input
                  type="number"
                  min="1"
                  value={cantidadEjemplares}
                  onChange={(e) => setCantidadEjemplares(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Se codifican con curso + 3 letras del título + número correlativo.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCrearEjemplares}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-semibold"
                >
                  Generar
                </button>
                <button
                  onClick={refreshEjemplares}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold"
                >
                  Refrescar
                </button>
              </div>
            </div>

            <div className="mt-6 max-h-72 overflow-y-auto border border-slate-100 rounded-2xl">
              {isLoadingEjemplares ? (
                <div className="py-8 text-center text-sm text-slate-500">Cargando ejemplares…</div>
              ) : ejemplarModal.data.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Todavía no hay ejemplares generados para este libro.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Código</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Serie</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Estado</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Disponibilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ejemplarModal.data.map((ejemplar) => (
                      <tr key={ejemplar.id}>
                        <td className="px-4 py-2 font-mono text-slate-700">{ejemplar.codigo}</td>
                        <td className="px-4 py-2">{ejemplar.serie.toString().padStart(3, '0')}</td>
                        <td className="px-4 py-2 text-slate-500">
                          {ejemplar.valoracion_devolucion || ejemplar.valoracion_entrega || 'Sin valoración'}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              ejemplar.disponible
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-600'
                            }`}
                          >
                            {ejemplar.disponible ? 'Disponible' : 'Asignado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              {selectedLibro ? 'Actualizar título solidario' : 'Registrar nuevo título'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Completa los datos clave del libro para incluirlo en los packs del AMPA.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Autor
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.autor}
                    onChange={(e) => setFormData({ ...formData, autor: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ISBN
                  </label>
                  <input
                    type="text"
                    value={formData.isbn}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Editorial
                  </label>
                  <input
                    type="text"
                    value={formData.editorial}
                    onChange={(e) => setFormData({ ...formData, editorial: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Curso asociado
                    </label>
                    <input
                      type="text"
                      value={formData.curso}
                      onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                      placeholder="Ej: 4º ESO, Infantil..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Precio referencia (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.precio}
                      onChange={(e) =>
                        setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Materia / Optativa
                  </label>
                  <select
                    value={formData.materia_id}
                    onChange={(e) => setFormData({ ...formData, materia_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-sm"
                  >
                    <option value="">Sin materia asignada</option>
                    {materias.map((materia) => (
                      <option key={materia.id} value={materia.id}>
                        {materia.nombre} {materia.es_optativa ? '(Optativa)' : ''}{' '}
                        {materia.curso ? `- ${materia.curso}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cantidad Total
                    </label>
                    <input
                      type="number"
                      value={formData.cantidad_total}
                      readOnly
                      className="w-full px-3 py-2.5 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Se actualiza automáticamente al generar ejemplares.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Disponibles
                    </label>
                    <input
                      type="number"
                      value={formData.cantidad_disponible}
                      readOnly
                      className="w-full px-3 py-2.5 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Calculado según los ejemplares libres del catálogo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-full font-medium hover:shadow-lg hover:shadow-sky-900/10 transition-all"
                >
                  {selectedLibro ? 'Guardar cambios' : 'Añadir al catálogo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedLibro(null);
                    setFormData({
                      titulo: '',
                      autor: '',
                      isbn: '',
                      editorial: '',
                      cantidad_total: 1,
                      cantidad_disponible: 1,
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

    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  accent,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  description: string;
  accent: string;
  suffix?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-lg shadow-emerald-900/5 border border-slate-100">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-800">
            {value}
            {suffix}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-100 text-slate-500">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
