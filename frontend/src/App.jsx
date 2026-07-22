import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ContestDashboard from './pages/ContestDashboard';
import ClusterDetails from './pages/ClusterDetails';
import GenerateReport from './pages/GenerateReport';
import AISuspects from './pages/AISuspects';
import KeywordSuspects from './pages/KeywordSuspects';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contest/:slug" element={<ContestDashboard />} />
        <Route path="/contest/:slug/cluster/:questionId" element={<ClusterDetails />} />
        <Route path="/contest/:slug/ai-suspects" element={<AISuspects />} />
        <Route path="/contest/:slug/keyword-suspects" element={<KeywordSuspects />} />
        <Route path="/generate-report" element={<GenerateReport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
