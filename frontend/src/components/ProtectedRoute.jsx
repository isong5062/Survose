import { Navigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

// ProtectedRoute component to protect routes from unauthorized access, so if go to /dashboard without being logged in, it will redirect to home page
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return null;
  }

  return user ? children : <Navigate to="/" />;
}

export default ProtectedRoute;
