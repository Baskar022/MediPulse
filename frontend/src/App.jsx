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
import GuidedDemo from './components/GuidedDemo';

export default function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDemoNavigate = (targetTab) => {
    setActiveNav(targetTab);
    setIsDemoMode(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Persistent Enterprise Left Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        isDemoMode={isDemoMode}
        setIsDemoMode={setIsDemoMode}
      />

      {/* Main Content Workspace with TopNav */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav activeNav={isDemoMode ? 'demo' : activeNav} onRefresh={handleRefresh} />

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-7xl mx-auto pb-12">
            {isDemoMode && <GuidedDemo onNavigateTab={handleDemoNavigate} />}

            {!isDemoMode && activeNav === 'overview' && <Dashboard key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'predictor' && <RiskPredictor key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'population' && <PopulationInsights key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'explorer' && <DataExplorer key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'pipeline' && <InteractivePipeline key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'spark_sql' && <SparkSqlWorkspace key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'benchmark' && <BigDataPipeline key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'transparency' && <ModelTransparency key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'storage' && <StorageExplorer key={refreshTrigger} />}
            {!isDemoMode && activeNav === 'system' && <SystemMonitor key={refreshTrigger} />}
          </div>
        </main>
      </div>
    </div>
  );
}
