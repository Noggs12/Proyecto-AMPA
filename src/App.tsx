import { useState } from 'react';
import Layout from './components/Layout';
import DashboardTab from './components/DashboardTab';
import AlumnosTab from './components/AlumnosTab';
import LibrosTab from './components/LibrosTab';
import PrestamosTab from './components/PrestamosTab';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'alumnos' && <AlumnosTab />}
      {activeTab === 'libros' && <LibrosTab />}
      {activeTab === 'prestamos' && <PrestamosTab />}
    </Layout>
  );
}

export default App;
