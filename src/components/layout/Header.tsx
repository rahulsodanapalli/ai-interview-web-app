import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getBackendHealth } from '../../api/healthService';
import './Header.css';

/** Page title lookup from pathname */
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/start': 'Start Interview',
  '/practice': 'Interview Practice',
  '/results': 'Evaluation Results',
  '/history': 'Interview History',
};

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

export default function Header() {
  const location = useLocation();
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [appName, setAppName] = useState('');

  // Determine page title (also handles dynamic routes)
  const pageTitle =
    pageTitles[location.pathname] ??
    (location.pathname.startsWith('/practice/') ? 'Interview Practice' : 'Page');

  // Check backend health on mount and every 30 seconds
  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const data = await getBackendHealth();
        if (mounted) {
          setStatus('connected');
          setAppName(data.app_name);
        }
      } catch {
        if (mounted) {
          setStatus('disconnected');
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="app-header" id="app-header">
      <div className="header-left">
        <h1 className="header-title">{pageTitle}</h1>
      </div>

      <div className="header-right">
        {/* Backend connection status indicator */}
        <div
          className={`connection-indicator ${status}`}
          id="backend-status-indicator"
          title={
            status === 'connected'
              ? `Connected to ${appName}`
              : status === 'disconnected'
                ? 'Backend unreachable'
                : 'Checking connection…'
          }
        >
          <span className="status-dot">
            {status === 'checking' && <span className="dot-pulse" />}
          </span>
          <span className="status-label">
            {status === 'connected'
              ? 'API Connected'
              : status === 'disconnected'
                ? 'API Offline'
                : 'Checking…'}
          </span>
        </div>
      </div>
    </header>
  );
}
