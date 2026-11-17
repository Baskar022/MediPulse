import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import Dashboard from './components/Dashboard';
import RiskPredictor from './components/RiskPredictor';
import PopulationInsights from './components/PopulationInsights';
import ModelTransparency from './components/ModelTransparency';
import BigDataPipeline from './components/BigDataPipeline';
import DataExplorer from './components/DataExplorer';
import InteractivePipeline from './components/InteractivePipeline';
import SparkSqlWorkspace from './components/SparkSqlWorkspace';
import StorageExplorer from './components/StorageExplorer';
import SystemMonitor from './components/SystemMonitor';

export default function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Enterprise Left Navigation Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      />

      {/* Main Content Workspace with TopNav */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav activeNav={activeNav} onRefresh={handleRefresh} />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-7xl mx-auto pb-12">
            {activeNav === 'overview' && <Dashboard key={refreshTrigger} />}
            {activeNav === 'predictor' && <RiskPredictor key={refreshTrigger} />}
            {activeNav === 'population' && <PopulationInsights key={refreshTrigger} />}
            {activeNav === 'transparency' && <ModelTransparency key={refreshTrigger} />}
            {activeNav === 'explorer' && <DataExplorer key={refreshTrigger} />}
            {activeNav === 'spark_sql' && <SparkSqlWorkspace key={refreshTrigger} />}
            {activeNav === 'pipeline' && <InteractivePipeline key={refreshTrigger} />}
            {activeNav === 'benchmark' && <BigDataPipeline key={refreshTrigger} />}
            {activeNav === 'storage' && <StorageExplorer key={refreshTrigger} />}
            {activeNav === 'system' && <SystemMonitor key={refreshTrigger} />}
          </div>
        </main>
      </div>
    </div>
  );
}
