import { useNavigate } from 'react-router-dom';
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
    <div className="dashboard-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">SurVose</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#1f2937' }}>Welcome, {user?.email}</span>
            <button className="sign-out-btn" onClick={handleSignOut}>Log Out</button>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Dashboard;
