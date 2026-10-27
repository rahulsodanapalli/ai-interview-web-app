import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './AppLayout.css';

/**
 * Root layout component that wraps all pages.
 * Provides the sidebar navigation, sticky header, and scrollable content area.
 */
export default function AppLayout() {
  return (
    <div className="app-layout" id="app-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
