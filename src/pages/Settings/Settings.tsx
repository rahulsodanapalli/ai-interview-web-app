import { useEffect, useState } from 'react';
import { getBackendHealth, getOllamaHealth, getDatabaseHealth } from '../../api/healthService';
import { useTheme } from '../../context/useTheme';
import type {
  HealthCheckResponse,
  OllamaHealthResponse,
  DatabaseHealthResponse,
} from '../../types';
import {
  SunIcon,
  MoonIcon,
  RefreshIcon,
  ServerIcon,
  CpuIcon,
  DatabaseIcon,
  CheckCircleIcon,
} from '../../components/ui/Icons';
import './Settings.css';

const SESSION_STORAGE_SOURCE_KEY = 'source_interview_active_source';

export default function Settings() {
  const { theme, setTheme } = useTheme();

  const [checking, setChecking] = useState(true);
  const [backendInfo, setBackendInfo] = useState<HealthCheckResponse | null>(null);
  const [ollamaInfo, setOllamaInfo] = useState<OllamaHealthResponse | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseHealthResponse | null>(null);

  const [hasCachedSource, setHasCachedSource] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem(SESSION_STORAGE_SOURCE_KEY));
    } catch {
      return false;
    }
  });
  const [clearedNotice, setClearedNotice] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function checkAll() {
      const [apiRes, ollamaRes, dbRes] = await Promise.allSettled([
        getBackendHealth({ signal: controller.signal }),
        getOllamaHealth({ signal: controller.signal }),
        getDatabaseHealth({ signal: controller.signal }),
      ]);

      if (!active || controller.signal.aborted) return;

      setBackendInfo(apiRes.status === 'fulfilled' ? apiRes.value : null);
      setOllamaInfo(ollamaRes.status === 'fulfilled' ? ollamaRes.value : null);
      setDbInfo(dbRes.status === 'fulfilled' ? dbRes.value : null);
      setChecking(false);
    }

    void checkAll();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadTick]);

  function handleRecheck() {
    setChecking(true);
    setReloadTick((t) => t + 1);
  }

  function handleClearCachedSource() {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_SOURCE_KEY);
      setHasCachedSource(false);
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    } catch {
      // Ignore storage errors
    }
  }

  return (
    <div className="page-container-narrow animate-fade-in" id="settings-page">
      <div className="page-header">
        <div className="page-header-text">
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">
            Manage interface appearance, inspect backend service connectivity, and manage local session data.
          </p>
        </div>
      </div>

      {/* Appearance */}
      <section className="surface-card settings-section">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">Appearance</h3>
            <p className="settings-section-desc">
              Choose between light and dark interface themes.
            </p>
          </div>
        </div>

        <div className="theme-options-grid" role="radiogroup" aria-label="Interface theme">
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'light'}
            className={`theme-option-card ${theme === 'light' ? 'is-active' : ''}`}
            onClick={() => setTheme('light')}
            id="theme-option-light"
          >
            <SunIcon size={18} />
            <div className="theme-option-copy">
              <span className="theme-option-name">Light</span>
              <span className="theme-option-hint">High-contrast daylight workspace</span>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={theme === 'dark'}
            className={`theme-option-card ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={() => setTheme('dark')}
            id="theme-option-dark"
          >
            <MoonIcon size={18} />
            <div className="theme-option-copy">
              <span className="theme-option-name">Dark</span>
              <span className="theme-option-hint">Low-glare dark workspace</span>
            </div>
          </button>
        </div>
      </section>

      {/* System Diagnostics */}
      <section className="surface-card settings-section">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">System Diagnostics</h3>
            <p className="settings-section-desc">
              Live connectivity and configuration reported by the FastAPI backend.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRecheck}
            disabled={checking}
            id="settings-refresh-health-btn"
          >
            <RefreshIcon size={13} />
            <span>{checking ? 'Checking…' : 'Re-check'}</span>
          </button>
        </div>

        <div className="diagnostics-list">
          <div className="diagnostic-row">
            <div className="diagnostic-left">
              <ServerIcon size={16} />
              <div>
                <span className="diagnostic-name">FastAPI Backend</span>
                <span className="diagnostic-detail">
                  {backendInfo
                    ? `${backendInfo.app_name} · ${backendInfo.environment}`
                    : checking
                    ? 'Checking…'
                    : 'Not reachable on port 8000'}
                </span>
              </div>
            </div>
            <span className={`badge ${backendInfo ? 'badge-success' : checking ? 'badge-neutral' : 'badge-error'}`}>
              {backendInfo ? 'Connected' : checking ? 'Checking' : 'Offline'}
            </span>
          </div>

          <div className="diagnostic-row">
            <div className="diagnostic-left">
              <CpuIcon size={16} />
              <div>
                <span className="diagnostic-name">Ollama Local LLM</span>
                <span className="diagnostic-detail">
                  {ollamaInfo
                    ? `Model: ${ollamaInfo.configured_model}${
                        ollamaInfo.available_models.length > 0
                          ? ` (${ollamaInfo.available_models.length} installed)`
                          : ''
                      }`
                    : checking
                    ? 'Checking…'
                    : 'Ollama service unreachable'}
                </span>
              </div>
            </div>
            <span
              className={`badge ${
                ollamaInfo?.model_available
                  ? 'badge-success'
                  : ollamaInfo?.ollama_connected
                  ? 'badge-warning'
                  : checking
                  ? 'badge-neutral'
                  : 'badge-error'
              }`}
            >
              {ollamaInfo?.model_available
                ? 'Ready'
                : ollamaInfo?.ollama_connected
                ? 'Model Missing'
                : checking
                ? 'Checking'
                : 'Offline'}
            </span>
          </div>

          <div className="diagnostic-row">
            <div className="diagnostic-left">
              <DatabaseIcon size={16} />
              <div>
                <span className="diagnostic-name">PostgreSQL Database</span>
                <span className="diagnostic-detail">
                  {dbInfo
                    ? `${dbInfo.database} · ${dbInfo.database_connected ? 'Connected' : 'Disconnected'}`
                    : checking
                    ? 'Checking…'
                    : 'Database status unavailable'}
                </span>
              </div>
            </div>
            <span
              className={`badge ${
                dbInfo?.database_connected
                  ? 'badge-success'
                  : dbInfo
                  ? 'badge-warning'
                  : checking
                  ? 'badge-neutral'
                  : 'badge-error'
              }`}
            >
              {dbInfo?.database_connected
                ? 'Connected'
                : dbInfo
                ? 'Disconnected'
                : checking
                ? 'Checking'
                : 'Offline'}
            </span>
          </div>
        </div>
      </section>

      {/* Local Workspace Cache */}
      <section className="surface-card settings-section">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">Local Session Cache</h3>
            <p className="settings-section-desc">
              Clear the active RAG document or repository reference stored in your browser session.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClearCachedSource}
            disabled={!hasCachedSource}
            id="clear-rag-cache-btn"
          >
            Clear Cached Source
          </button>
        </div>

        {clearedNotice && (
          <div className="cache-cleared-note animate-fade-in">
            <CheckCircleIcon size={14} />
            <span>Cached RAG source cleared.</span>
          </div>
        )}
      </section>
    </div>
  );
}
