import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getBackendHealth } from '../../api/healthService';
import { useTheme } from '../../context/useTheme';
import { isRequestAborted } from '../../utils/error';
import { MenuIcon, MoonIcon, SunIcon, SparklesIcon, ChevronRightIcon } from '../ui/Icons';
import './Header.css';

interface BreadcrumbInfo {
  section?: string;
  title: string;
}

function getBreadcrumb(pathname: string): BreadcrumbInfo {
  if (pathname === '/') {
    return { title: 'Dashboard' };
  }
  if (pathname === '/start') {
    return { section: 'Practice', title: 'AI Interview' };
  }
  if (pathname === '/rag' || pathname === '/source' || pathname === '/document-rag') {
    return { section: 'RAG Pipeline', title: 'Document & GitHub RAG' };
  }
  if (pathname === '/github') {
    return { section: 'Explore', title: 'GitHub Analysis' };
  }
  if (pathname.startsWith('/practice/')) {
    return { section: 'AI Interview', title: 'Live Practice Session' };
  }
  if (pathname === '/practice') {
    return { section: 'AI Interview', title: 'Sessions' };
  }
  if (pathname.startsWith('/results/')) {
    return { section: 'Interview History', title: 'Interview Results' };
  }
  if (pathname === '/results') {
    return { section: 'Interview History', title: 'Evaluation Results' };
  }
  if (pathname.startsWith('/history/')) {
    return { section: 'Interview History', title: 'Session Details' };
  }
  if (pathname === '/history') {
    return { title: 'Interview History' };
  }
  if (pathname === '/settings') {
    return { title: 'Settings' };
  }
  return { title: 'InterviewPrep AI' };
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export default function Header({ onOpenMobileMenu }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [appName, setAppName] = useState('');
  const { theme, toggleTheme } = useTheme();

  const breadcrumb = getBreadcrumb(location.pathname);

  useEffect(() => {
    let active = true;
    let controller = new AbortController();

    async function checkHealth() {
      controller.abort();
      controller = new AbortController();
      try {
        const data = await getBackendHealth({ signal: controller.signal });
        if (active) {
          setStatus('connected');
          setAppName(data.app_name);
        }
      } catch (err) {
        if (active && !isRequestAborted(err)) {
          setStatus('disconnected');
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30_000);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const showQuickAction =
    location.pathname !== '/rag' &&
    location.pathname !== '/source' &&
    !location.pathname.startsWith('/practice/');

  return (
    <header className="app-header" id="app-header">
      <div className="header-left">
        <button
          type="button"
          id="sidebar-mobile-toggle"
          className="header-mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <MenuIcon size={18} />
        </button>

        <nav className="header-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.section && (
            <>
              <Link to="/" className="breadcrumb-parent">
                {breadcrumb.section}
              </Link>
              <ChevronRightIcon size={14} className="breadcrumb-sep" />
            </>
          )}
          <h1 className="header-title">{breadcrumb.title}</h1>
        </nav>
      </div>

      <div className="header-right">
        <div
          className={`connection-indicator ${status}`}
          id="backend-status-indicator"
          title={
            status === 'connected'
              ? `Connected to ${appName || 'Backend API'}`
              : status === 'disconnected'
                ? 'Backend API unreachable on port 8000'
                : 'Checking backend connectivity…'
          }
        >
          <span className="status-dot" />
          <span className="status-label">
            {status === 'connected'
              ? 'API Connected'
              : status === 'disconnected'
                ? 'API Offline'
                : 'Checking…'}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          id="theme-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>

        {showQuickAction && (
          <button
            type="button"
            className="btn btn-primary btn-sm header-cta-btn"
            onClick={() => navigate('/rag')}
            id="header-quick-rag-btn"
          >
            <SparklesIcon size={14} />
            <span className="header-cta-label">RAG Interview</span>
          </button>
        )}
      </div>
    </header>
  );
}
