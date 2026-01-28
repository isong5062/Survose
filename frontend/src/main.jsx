import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import { SurveysProvider } from './context/SurveysContext'
import SurveyExecution from './pages/dashboard/SurveyExecution'
import SurveyQA from './pages/dashboard/SurveyQA'
import SurveyAnalysis from './pages/dashboard/SurveyAnalysis'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <SurveysProvider>
                <Dashboard />
              </SurveysProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="execution" replace />} />
          <Route path="execution" element={<SurveyExecution />} />
          <Route path="qa" element={<SurveyQA />} />
          <Route path="analysis" element={<SurveyAnalysis />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
