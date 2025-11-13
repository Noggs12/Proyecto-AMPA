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
  Percent
} from 'lucide-react';
import { api, type Libro } from '../lib/api';

export default function LibrosTab() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLibro, setSelectedLibro] = useState<Libro | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    isbn: '',
    editorial: '',
    cantidad_total: 1,
    cantidad_disponible: 1,
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
  }, []);

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
        cantidad_total: 1,
        cantidad_disponible: 1,
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
      libro.editorial.toLowerCase().includes(search)
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
                cantidad_total: 1,
                cantidad_disponible: 1,
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
                </div>
                <div className="flex items-center gap-2">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cantidad Total
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.cantidad_total}
                      onChange={(e) =>
                        setFormData({ ...formData, cantidad_total: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Disponibles
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.cantidad_disponible}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cantidad_disponible: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                    />
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
