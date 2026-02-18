import { useNavigate, Outlet, NavLink } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="dashboard-page dashboard-layout">
      <nav className="dash-navbar">
        <div className="dash-nav-container">
          <div className="dash-logo" onClick={() => navigate('/dashboard')} role="button" tabIndex={0}>
            <span className="dash-logo-icon">◈</span>
            SurVose
          </div>
          <div className="dash-nav-right">
            <div className="dash-user-info">
              <div className="dash-user-avatar">{userInitial}</div>
              <span className="dash-user-email">{user?.email}</span>
            </div>
            <button className="dash-sign-out-btn" onClick={handleSignOut}>
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <div className="dash-body">
        <aside className="dash-sidebar">
          <div className="dash-sidebar-section">
            <span className="dash-sidebar-label">Workspace</span>
            <nav className="dash-sidebar-nav">
              <NavLink to="/dashboard/execution" className={({ isActive }) => `dash-sidebar-link ${isActive ? 'active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                Execution
              </NavLink>
              <NavLink to="/dashboard/qa" className={({ isActive }) => `dash-sidebar-link ${isActive ? 'active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                QA Testing
              </NavLink>
              <NavLink to="/dashboard/analysis" className={({ isActive }) => `dash-sidebar-link ${isActive ? 'active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Analysis
              </NavLink>
            </nav>
          </div>
        </aside>
        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
