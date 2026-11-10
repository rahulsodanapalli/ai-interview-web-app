import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import StartInterview from './pages/StartInterview/StartInterview';
import InterviewPractice from './pages/InterviewPractice/InterviewPractice';
import EvaluationResults from './pages/EvaluationResults/EvaluationResults';
import InterviewHistory from './pages/InterviewHistory/InterviewHistory';
import DocumentRAG from './pages/DocumentRAG/DocumentRAG';
import GitHubAnalysis from './pages/GitHubAnalysis/GitHubAnalysis';
import Settings from './pages/Settings/Settings';

/**
 * Root application component with client-side routing.
 * All pages are rendered within the AppLayout (Sidebar + Header).
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/start" element={<StartInterview />} />
          <Route path="/rag" element={<DocumentRAG />} />
          <Route path="/source" element={<DocumentRAG />} />
          <Route path="/github" element={<GitHubAnalysis />} />
          <Route path="/practice" element={<InterviewHistory />} />
          <Route path="/practice/:sessionId" element={<InterviewPractice />} />
          <Route path="/results" element={<EvaluationResults />} />
          <Route path="/results/:sessionId" element={<EvaluationResults />} />
          <Route path="/history" element={<InterviewHistory />} />
          <Route path="/history/:sessionId" element={<InterviewHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
