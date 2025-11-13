import { useEffect, useMemo, useState } from 'react';
import {
  UsersRound,
  LibraryBig,
  ClipboardList,
  Timer,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  PackageCheck
} from 'lucide-react';
import { api, type Alumno, type Libro, type Padre, type Prestamo } from '../lib/api';

type DashboardState = {
  alumnos: Alumno[];
  padres: Padre[];
  libros: Libro[];
  prestamos: Prestamo[];
};

const initialState: DashboardState = {
  alumnos: [],
  padres: [],
  libros: [],
  prestamos: [],
};

export default function DashboardTab() {
  const [data, setData] = useState<DashboardState>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [alumnos, padres, libros, prestamos] = await Promise.all([
          api.alumnos.getAll(),
          api.padres.getAll(),
          api.libros.getAll(),
          api.prestamos.getAll(),
        ]);
        setData({ alumnos, padres, libros, prestamos });
      } catch (err: any) {
        setError('No se pudo cargar el panel. Revisa la conexión con el servidor AMPA.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const alumnosPorId = useMemo(() => {
    const map = new Map<string, Alumno>();
    data.alumnos.forEach((alumno) => map.set(alumno.id, alumno));
    return map;
  }, [data.alumnos]);

  const librosPorId = useMemo(() => {
    const map = new Map<string, Libro>();
    data.libros.forEach((libro) => map.set(libro.id, libro));
    return map;
  }, [data.libros]);

  const stats = useMemo(() => {
    const totalFamilias = data.padres.length;
    const totalAlumnos = data.alumnos.length;
    const totalLibros = data.libros.length;
    const stockDisponible = data.libros.reduce(
      (acc, libro) => acc + (libro.cantidad_disponible ?? 0),
      0
    );

    const prestamosActivos = data.prestamos.filter((prestamo) => getEstado(prestamo) !== 'devuelto');
    const prestamosRetrasados = prestamosActivos.filter(
      (prestamo) => getEstado(prestamo) === 'retrasado'
    );

    return {
      totalFamilias,
      totalAlumnos,
      totalLibros,
      stockDisponible,
      prestamosActivos: prestamosActivos.length,
      prestamosRetrasados: prestamosRetrasados.length,
    };
  }, [data]);

  const proximasEntregas = useMemo(() => {
    const pendientes = data.prestamos
      .filter((prestamo) => getEstado(prestamo) !== 'devuelto')
      .map((prestamo) => ({
        ...prestamo,
        alumno: alumnosPorId.get(prestamo.alumno_id),
        libro: librosPorId.get(prestamo.libro_id),
        diasRestantes: getDiasRestantes(prestamo.fecha_devolucion_esperada),
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 5);

    return pendientes;
  }, [data.prestamos, alumnosPorId, librosPorId]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-32 animate-pulse rounded-3xl bg-white shadow-lg shadow-emerald-900/5"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-3xl bg-white shadow-lg shadow-emerald-900/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-100 text-red-600 rounded-2xl px-6 py-8 shadow-lg shadow-red-900/10">
        <h2 className="text-xl font-semibold mb-2">Ups, algo no fue bien</h2>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Pulso general del AMPA</h2>
            <p className="text-sm text-slate-500 mt-2">
              Mantén a la comunidad coordinada: familias informadas, packs preparados y entregas en
              tiempo.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-sky-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg shadow-emerald-900/10 hover:shadow-xl transition-shadow">
            <Sparkles className="w-4 h-4" />
            Crear iniciativa AMPA
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            title="Familias en la red"
            value={stats.totalFamilias}
            subtext="Contactos con los que podemos hablar hoy mismo"
            icon={UsersRound}
            accent="from-emerald-500 to-teal-500"
          />
          <SummaryCard
            title="Alumnado gestionado"
            value={stats.totalAlumnos}
            subtext="NIA vinculados al programa de libros solidarios"
            icon={PackageCheck}
            accent="from-sky-500 to-blue-500"
          />
          <SummaryCard
            title="Libros activos"
            value={stats.totalLibros}
            subtext={`${stats.stockDisponible} ejemplares listos para entregar`}
            icon={LibraryBig}
            accent="from-amber-500 to-orange-500"
          />
          <SummaryCard
            title="Entregas en seguimiento"
            value={stats.prestamosActivos}
            subtext={
              stats.prestamosRetrasados > 0
                ? `${stats.prestamosRetrasados} requieren un recordatorio`
                : 'Todo en plazo ✔'
            }
            icon={ClipboardList}
            accent="from-rose-500 to-pink-500"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-600">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Próximas entregas y avisos</h3>
              <p className="text-sm text-slate-500">
                Agenda los recordatorios desde aquí para evitar retrasos.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {proximasEntregas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 text-slate-500 text-sm px-4 py-10 text-center">
                No hay entregas pendientes. Una buena oportunidad para revisar packs reutilizables.
              </div>
            ) : (
              proximasEntregas.map((prestamo) => (
                <div
                  key={prestamo.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3 bg-slate-50/50 hover:bg-slate-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {prestamo.libro?.titulo || 'Libro sin título'}
                      <span className="text-xs text-slate-400 ml-2">
                        {prestamo.alumno?.nombre || 'Alumno sin vincular'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Curso {prestamo.alumno?.curso || 'N/A'} · vence el{' '}
                      {formatDate(prestamo.fecha_devolucion_esperada)} ·{' '}
                      {describeDias(prestamo.diasRestantes)}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                      prestamo.diasRestantes < 0
                        ? 'bg-rose-100 text-rose-600'
                        : prestamo.diasRestantes <= 3
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    <Timer className="w-4 h-4" />
                    {prestamo.diasRestantes < 0
                      ? 'Retraso'
                      : prestamo.diasRestantes === 0
                      ? 'Hoy'
                      : `${prestamo.diasRestantes} días`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg shadow-emerald-900/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-sky-100 text-sky-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Acciones para la comunidad</h3>
                <p className="text-sm text-slate-500">
                  Ideas rápidas para reforzar la participación de las familias.
                </p>
              </div>
            </div>
            <ArrowRight className="hidden sm:block w-5 h-5 text-slate-300" />
          </div>

          <div className="mt-5 grid gap-4">
            <QuickAction
              title="Lanzar campaña de donación"
              description="Anima a las familias a donar los libros en buen estado de cursos anteriores."
              tag="Reutilización"
              color="emerald"
            />
            <QuickAction
              title="Coordinar packs por ciclo"
              description="Prepara un mensaje con el listado de packs y precios sociales de este curso."
              tag="Comunicación"
              color="sky"
            />
            <QuickAction
              title="Registrar incidencias abiertas"
              description="Revisa qué entregas están retrasadas y envía recordatorio a las tutorías."
              tag="Seguimiento"
              color="rose"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtext,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
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
      <p className="mt-4 text-xs leading-5 text-slate-500">{subtext}</p>
    </div>
  );
}

function QuickAction({
  title,
  description,
  tag,
  color,
}: {
  title: string;
  description: string;
  tag: string;
  color: 'emerald' | 'sky' | 'rose';
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    sky: 'bg-sky-50 text-sky-600 border-sky-200',
    rose: 'bg-rose-50 text-rose-600 border-rose-200',
  } as const;

  return (
    <div className="rounded-2xl border border-slate-100 p-4 hover:border-slate-200 transition-colors">
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium ${colorMap[color]}`}>
        {tag}
      </span>
      <h4 className="mt-3 text-sm font-semibold text-slate-700">{title}</h4>
      <p className="mt-2 text-xs text-slate-500 leading-5">{description}</p>
    </div>
  );
}

function getDiasRestantes(fechaDevolucionEsperada: string) {
  const hoy = new Date();
  const fecha = new Date(fechaDevolucionEsperada);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function getEstado(prestamo: Prestamo) {
  if (prestamo.estado === 'devuelto') return 'devuelto';
  const diasRestantes = getDiasRestantes(prestamo.fecha_devolucion_esperada);
  if (diasRestantes < 0) return 'retrasado';
  return 'activo';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

function describeDias(dias: number) {
  if (dias < 0) {
    return `con ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'} de retraso`;
  }
  if (dias === 0) {
    return 'vence hoy';
  }
  if (dias === 1) {
    return 'queda 1 día';
  }
  return `quedan ${dias} días`;
}

