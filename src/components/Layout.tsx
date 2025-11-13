import {
  LayoutDashboard,
  Users2,
  Library,
  ClipboardCheck,
  HeartHandshake
} from 'lucide-react';

type LayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const tabs = [
    { id: 'dashboard', label: 'Resumen AMPA', icon: LayoutDashboard },
    { id: 'alumnos', label: 'Familias y Alumnado', icon: Users2 },
    { id: 'libros', label: 'Catálogo AMPA', icon: Library },
    { id: 'prestamos', label: 'Entregas y Seguimiento', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,white,transparent_55%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-xs uppercase tracking-wide text-white/90">
                <HeartHandshake className="w-4 h-4" />
                AMPA • Comunidad de Familias
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
                Gestión Solidaria de Libros AMPA
              </h1>
              <p className="mt-3 text-white/80 max-w-2xl text-sm sm:text-base">
                Coordina familias, stock y entregas desde un panel enfocado en la realidad del AMPA:
                visibilidad rápida, seguimiento de entregas y control de packs solidarios por curso.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-white/90">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 shadow-lg shadow-emerald-900/10">
                <p className="text-xs uppercase tracking-wide">Cursos activos</p>
                <p className="mt-1 text-2xl font-semibold">24/25</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 shadow-lg shadow-emerald-900/10">
                <p className="text-xs uppercase tracking-wide">Familias colaboradoras</p>
                <p className="mt-1 text-2xl font-semibold">AMPA</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 shadow-lg shadow-emerald-900/10 col-span-2">
                <p className="text-xs uppercase tracking-wide">Objetivo</p>
                <p className="mt-1 text-sm">
                  Priorizar reutilización, reducir costes y mantener seguimiento transparente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 py-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-900/15'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
