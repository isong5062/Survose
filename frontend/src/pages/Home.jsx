import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css'
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        navigate('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setError(error.message);
    }
  };
  return (
    <div className="home-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">SurVose</div>
          <button className="sign-in-btn" onClick={() => setShowAuthPopup(true)}>Sign In/Sign Up</button>
        </div>
      </nav>

      {showAuthPopup && (
        <div className="popup-overlay" onClick={() => setShowAuthPopup(false)}>
          <div className="auth-popup" onClick={(e) => e.stopPropagation()}>
            <button className="close-popup" onClick={() => setShowAuthPopup(false)}>×</button>
            <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="auth-submit-btn">
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            <div className="divider">
              <span>OR</span>
            </div>

            <button className="google-btn" onClick={handleGoogleSignIn}>
              <span>Continue with Google</span>
            </button>

            <p className="toggle-auth">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      )}

      <main>
        <section className="intro-banner">
          <div className="intro-content">
            <h1>Survey Automation</h1>
            <p className="subtitle">
              Transform how you conduct surveys with autonomous voice AI that makes high-quality polling accessible to everyone
            </p>
          </div>
        </section>

        <section className="about">
          <div className="section-container">
            <h2>About</h2>
            <p className="about-text">
              As AI voice and language models become capable of conducting long-form conversations, 
              traditionally human-led phone surveys and polling can be automated. We believe that voice AI 
              will make it easier to conduct surveys—from local governments to large enterprises looking to 
              improve their products.
            </p>
            <p className="about-text">
              We also believe that we can use AI to improve survey quality and help survey creators understand 
              intrinsic survey biases. Empowering users to a higher quality survey creation and conducting service 
              will provide more representative data, more honest responses, and ultimately better decision-making.
            </p>
          </div>
        </section>

        <section className="features">
          <div className="section-container">
            <h2>Key Features</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>Autonomous Survey Execution</h3>
                <p>
                  Voice AI autonomously conducts surveys, screens participants in real-time, 
                  and collects structured responses at scale
                </p>
              </div>
              <div className="feature-card">
                <h3>Survey QA Testing</h3>
                <p>
                  Automatically identify potential bias, missing demographics, and leading questions 
                  before surveys are deployed
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2026 SurVose. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default Home
