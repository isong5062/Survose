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

  return (
    <div className="dashboard-page dashboard-layout">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">SurVose</div>
          <div className="nav-right">
            <span>Welcome, {user?.email}</span>
            <button className="sign-out-btn" onClick={handleSignOut}>Log Out</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          <nav>
            <NavLink to="/dashboard/execution" className={({ isActive }) => (isActive ? 'active' : '')}>
              Survey Execution
            </NavLink>
            <NavLink to="/dashboard/qa" className={({ isActive }) => (isActive ? 'active' : '')}>
              QA Testing
            </NavLink>
            <NavLink to="/dashboard/analysis" className={({ isActive }) => (isActive ? 'active' : '')}>
              Analysis
            </NavLink>
          </nav>
        </aside>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
