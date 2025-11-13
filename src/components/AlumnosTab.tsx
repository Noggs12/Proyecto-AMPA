import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  Search,
  UsersRound,
  HandHeart,
  Link2,
  AlertTriangle
} from 'lucide-react';
import { api, type Alumno, type Padre } from '../lib/api';

export default function AlumnosTab() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [padres, setPadres] = useState<Padre[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showPadresModal, setShowPadresModal] = useState(false);
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [alumnosPadres, setAlumnosPadres] = useState<Record<string, Padre[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nia: '',
    nombre: '',
    curso: '',
  });

  useEffect(() => {
    loadAlumnos();
    loadPadres();
  }, []);

  const loadAlumnos = async () => {
    try {
      const data = await api.alumnos.getAll();
      setAlumnos(data);

      for (const alumno of data) {
        loadPadresForAlumno(alumno.id);
      }
    } catch (error: any) {
      alert('Error al cargar alumnos: ' + error.message);
    }
  };

  const loadPadres = async () => {
    try {
      const data = await api.padres.getAll();
      setPadres(data);
    } catch (error: any) {
      alert('Error al cargar padres: ' + error.message);
    }
  };

  const loadPadresForAlumno = async (alumnoId: string) => {
    try {
      const data = await api.padres.getForAlumno(alumnoId);
      setAlumnosPadres(prev => ({
        ...prev,
        [alumnoId]: data
      }));
    } catch (error) {
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedAlumno) {
        await api.alumnos.update(selectedAlumno.id, formData);
      } else {
        await api.alumnos.create(formData);
      }

      setShowModal(false);
      setFormData({ nia: '', nombre: '', curso: '' });
      setSelectedAlumno(null);
      loadAlumnos();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (alumno: Alumno) => {
    setSelectedAlumno(alumno);
    setFormData({
      nia: alumno.nia,
      nombre: alumno.nombre,
      curso: alumno.curso,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este alumno?')) return;

    try {
      await api.alumnos.delete(id);
      loadAlumnos();
    } catch (error: any) {
      alert('Error al eliminar alumno: ' + error.message);
    }
  };

  const openPadresModal = (alumno: Alumno) => {
    setSelectedAlumno(alumno);
    setShowPadresModal(true);
  };

  const stats = useMemo(() => {
    const familiasActivas = padres.length;
    const totalAlumnos = alumnos.length;
    const totalVinculaciones = Object.values(alumnosPadres).reduce(
      (acc, listaPadres) => acc + listaPadres.length,
      0
    );
    const alumnosSinContacto = alumnos.filter(
      (alumno) => (alumnosPadres[alumno.id]?.length ?? 0) === 0
    ).length;

    return {
      familiasActivas,
      totalAlumnos,
      totalVinculaciones,
      alumnosSinContacto,
    };
  }, [padres.length, alumnos.length, alumnosPadres]);

  const filteredAlumnos = alumnos.filter((alumno) => {
    const search = searchTerm.toLowerCase();
    return (
      alumno.nombre.toLowerCase().includes(search) ||
      alumno.nia.toLowerCase().includes(search) ||
      alumno.curso.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <HandHeart className="w-4 h-4" />
              Familias AMPA
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-slate-800">
              Mapa de familias y alumnado participante
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Gestiona los vínculos entre alumnos y tutores, controla qué familias necesitan apoyo y
              asegúrate de que todos reciban los packs solidarios a tiempo.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedAlumno(null);
              setFormData({ nia: '', nombre: '', curso: '' });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-full shadow-lg shadow-emerald-900/10 hover:shadow-xl transition-shadow"
          >
            <Plus className="w-4 h-4" />
            Nuevo alumno AMPA
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={UsersRound}
          title="Familias activas"
          value={stats.familiasActivas}
          description="Madres, padres y tutores con contacto directo."
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={HandHeart}
          title="Alumnado becado"
          value={stats.totalAlumnos}
          description="Participantes AMPA en packs solidarios."
          accent="from-sky-500 to-blue-500"
        />
        <StatCard
          icon={Link2}
          title="Vínculos activos"
          value={stats.totalVinculaciones}
          description="Relaciones alumno-familia registradas."
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          icon={AlertTriangle}
          title="Seguimiento urgente"
          value={stats.alumnosSinContacto}
          description="Alumnos sin familias asociadas. Prioridad alta."
          accent="from-rose-500 to-pink-500"
        />
      </section>

      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Directorio AMPA</h3>
            <p className="text-sm text-slate-500">
              Busca por nombre, NIA o curso y gestiona las familias vinculadas.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, NIA o curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  NIA
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Alumno/a
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Familia vinculada
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredAlumnos.map((alumno) => {
                const padresAsignados = alumnosPadres[alumno.id] || [];

                return (
                  <tr key={alumno.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                      {alumno.nia}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{alumno.nombre}</div>
                      <div className="text-xs text-slate-500">ID: {alumno.id.slice(0, 6)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {alumno.curso}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        {padresAsignados.length === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-medium">
                            Sin contacto asociado
                          </span>
                        ) : (
                          padresAsignados.map((padre) => (
                            <span
                              key={padre.id}
                              className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium"
                            >
                              {padre.nombre}
                            </span>
                          ))
                        )}
                        <button
                          onClick={() => openPadresModal(alumno)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Gestionar
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => handleEdit(alumno)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(alumno.id)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredAlumnos.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500">
              No encontramos coincidencias. Prueba con otro nombre o curso.
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              {selectedAlumno ? 'Actualizar ficha del alumno' : 'Registrar nuevo alumno AMPA'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Vincula a la familia correspondiente y apunta el curso para preparar el pack solidario.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    NIA
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nia}
                    onChange={(e) => setFormData({ ...formData, nia: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Curso
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.curso}
                    onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-medium hover:shadow-lg hover:shadow-emerald-900/10 transition-all"
                >
                  {selectedAlumno ? 'Guardar cambios' : 'Crear ficha'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedAlumno(null);
                    setFormData({ nia: '', nombre: '', curso: '' });
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

      {showPadresModal && selectedAlumno && (
        <PadresModal
          alumno={selectedAlumno}
          allPadres={padres}
          currentPadres={alumnosPadres[selectedAlumno.id] || []}
          onClose={() => {
            setShowPadresModal(false);
            setSelectedAlumno(null);
            loadAlumnos();
          }}
        />
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

function PadresModal({
  alumno,
  allPadres,
  currentPadres,
  onClose,
}: {
  alumno: Alumno;
  allPadres: Padre[];
  currentPadres: Padre[];
  onClose: () => void;
}) {
  const [showNewPadreForm, setShowNewPadreForm] = useState(false);
  const [newPadreData, setNewPadreData] = useState({
    nombre: '',
    email: '',
    telefono: '',
  });

  const handleAddExistingPadre = async (padreId: string) => {
    if (currentPadres.length >= 2) {
      alert('Un alumno no puede tener más de 2 padres');
      return;
    }

    try {
      await api.padres.linkToAlumno(alumno.id, padreId);
      onClose();
    } catch (error: any) {
      alert('Error al vincular padre: ' + error.message);
    }
  };

  const handleCreateAndAddPadre = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentPadres.length >= 2) {
      alert('Un alumno no puede tener más de 2 padres');
      return;
    }

    try {
      const data = await api.padres.create(newPadreData);
      await handleAddExistingPadre(data.id);
    } catch (error: any) {
      alert('Error al crear padre: ' + error.message);
    }
  };

  const handleRemovePadre = async (padreId: string) => {
    if (!confirm('¿Desvincular este padre del alumno?')) return;

    try {
      await api.padres.unlinkFromAlumno(alumno.id, padreId);
      onClose();
    } catch (error: any) {
      alert('Error al desvincular padre: ' + error.message);
    }
  };

  const availablePadres = allPadres.filter(
    (padre) => !currentPadres.find((cp) => cp.id === padre.id)
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-500 font-semibold">
              Vínculos familiares
            </p>
            <h3 className="text-xl font-semibold text-slate-800">
              Contactos de {alumno.nombre}
            </h3>
            <p className="text-sm text-slate-500">
              Puedes asociar hasta dos responsables. Mantén actualizados correo y teléfono para
              coordinar las entregas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Padres actuales</h4>
            {currentPadres.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
                No hay contactos asociados. Añade al menos uno para enviar avisos y coordinar
                recogida.
              </div>
            ) : (
              <div className="grid gap-3">
                {currentPadres.map((padre) => (
                  <div
                    key={padre.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{padre.nombre}</p>
                      <p className="text-xs text-slate-500">{padre.email}</p>
                      {padre.telefono && (
                        <p className="text-xs text-slate-400 mt-0.5">Tel: {padre.telefono}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemovePadre(padre.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {currentPadres.length < 2 && (
            <>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Asociar contacto existente
                </h4>
                {availablePadres.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                    No hay más familias disponibles. Crea un nuevo contacto para añadirlo.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {availablePadres.map((padre) => (
                      <button
                        key={padre.id}
                        onClick={() => handleAddExistingPadre(padre.id)}
                        className="w-full text-left"
                      >
                        <div className="flex justify-between items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50/60 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{padre.nombre}</p>
                            <p className="text-xs text-slate-500">{padre.email}</p>
                          </div>
                          <Plus className="w-4 h-4 text-emerald-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => setShowNewPadreForm(!showNewPadreForm)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  {showNewPadreForm ? (
                    <>
                      <span className="text-lg leading-none">–</span>
                      Cancelar nuevo contacto
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Crear nuevo contacto
                    </>
                  )}
                </button>

                {showNewPadreForm && (
                  <form onSubmit={handleCreateAndAddPadre} className="mt-4 space-y-3">
                    <input
                      type="text"
                      required
                      placeholder="Nombre completo"
                      value={newPadreData.nombre}
                      onChange={(e) =>
                        setNewPadreData({ ...newPadreData, nombre: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={newPadreData.email}
                      onChange={(e) =>
                        setNewPadreData({ ...newPadreData, email: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="Teléfono"
                      value={newPadreData.telefono}
                      onChange={(e) =>
                        setNewPadreData({ ...newPadreData, telefono: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm"
                    />
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-medium hover:shadow-lg hover:shadow-emerald-900/10 transition-all"
                    >
                      Crear y vincular contacto
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2.5 bg-slate-100 text-slate-600 rounded-full font-medium hover:bg-slate-200 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
