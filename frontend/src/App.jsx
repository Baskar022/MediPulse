import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import RiskPredictor from './components/RiskPredictor';
import PopulationInsights from './components/PopulationInsights';
import ModelTransparency from './components/ModelTransparency';
import BigDataPipeline from './components/BigDataPipeline';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'predictor' && <RiskPredictor />}
        {activeTab === 'population' && <PopulationInsights />}
        {activeTab === 'transparency' && <ModelTransparency />}
        {activeTab === 'pipeline' && <BigDataPipeline />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">MediPulse Analytics Platform</span>
            <span>•</span>
            <span>Dual Academic Curriculum: Big Data Analytics & AIML in Healthcare</span>
          </div>
          <div>
            Built with Apache PySpark, Parquet Lakehouse, XGBoost, SHAP & FastAPI
          </div>
        </div>
      </footer>
    </div>
  );
}
