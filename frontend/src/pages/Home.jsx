import { useState, useEffect, useRef } from 'react';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [visibleSections, setVisibleSections] = useState(new Set());
  const sectionRefs = useRef({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        navigate('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.15 }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const setSectionRef = (id) => (el) => {
    sectionRefs.current[id] = el;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
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

  const openAuth = (signUp = false) => {
    setIsSignUp(signUp);
    setShowAuthPopup(true);
    setError('');
    setConfirmPassword('');
  };

  const features = [
    {
      icon: "🤖",
      title: "AI Survey Generation",
      desc: "Describe what you need and our multi-stage AI pipeline creates optimized, voice-ready surveys in seconds."
    },
    {
      icon: "🎙️",
      title: "Voice AI Execution",
      desc: "Autonomous voice agents conduct phone surveys at scale, screening participants and collecting structured responses."
    },
    {
      icon: "🔍",
      title: "Intelligent QA Testing",
      desc: "Automatically detect bias, leading questions, demographic gaps, and ethical concerns before deployment."
    },
    {
      icon: "📊",
      title: "Real-Time Analytics",
      desc: "Visualize response distributions, track completion rates, and extract insights from every survey."
    },
    {
      icon: "✏️",
      title: "Flexible Question Types",
      desc: "Open-ended, multiple choice, scales, checkboxes, yes/no — all optimized for natural voice conversations."
    },
    {
      icon: "🛡️",
      title: "Bias Detection",
      desc: "AI-powered analysis catches sample bias, wording issues, order effects, and sensitivity concerns automatically."
    }
  ];

  const steps = [
    { number: "01", title: "Create", desc: "Build your survey manually or let AI generate one from a simple prompt" },
    { number: "02", title: "Refine", desc: "Run QA testing to catch bias and improve question quality with AI suggestions" },
    { number: "03", title: "Execute", desc: "Deploy autonomous voice AI agents to conduct surveys via phone at scale" },
    { number: "04", title: "Analyze", desc: "Get real-time analytics, response distributions, and actionable insights" }
  ];

  const stats = [
    { value: "5x", label: "Faster than manual surveying" },
    { value: "AI", label: "Powered quality assurance" },
    { value: "24/7", label: "Autonomous execution" },
    { value: "0", label: "Bias tolerance" }
  ];

  return (
    <div className="home-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">◈</span>
            SurVose
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#about" className="nav-link">About</a>
            <button className="sign-in-btn" onClick={() => openAuth(false)}>Sign In</button>
            <button className="get-started-btn" onClick={() => openAuth(true)}>Get Started</button>
          </div>
        </div>
      </nav>

      {showAuthPopup && (
        <div className="popup-overlay" onClick={() => setShowAuthPopup(false)}>
          <div className="auth-popup" onClick={(e) => e.stopPropagation()}>
            <button className="close-popup" onClick={() => setShowAuthPopup(false)}>×</button>
            <div className="auth-header">
              <span className="auth-logo">◈</span>
              <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
              <p className="auth-subtitle">
                {isSignUp ? 'Start automating surveys with AI' : 'Sign in to your SurVose account'}
              </p>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
              <div className="input-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {isSignUp && (
                <div className="input-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              <button type="submit" className="auth-submit-btn">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="divider">
              <span>or continue with</span>
            </div>

            <button className="google-btn" onClick={handleGoogleSignIn}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              <span>Google</span>
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
        <section className="hero">
          <div className="hero-bg">
            <div className="hero-orb hero-orb-1"></div>
            <div className="hero-orb hero-orb-2"></div>
            <div className="hero-orb hero-orb-3"></div>
            <div className="hero-grid"></div>
          </div>
          <div className="hero-content">
            <div className="hero-badge">AI-Powered Survey Platform</div>
            <h1>
              Surveys that <span className="gradient-text">speak</span> for themselves
            </h1>
            <p className="hero-subtitle">
              SurVose uses autonomous voice AI to create, quality-test, and execute surveys at scale, 
              making high-quality polling accessible to everyone.
            </p>
            <div className="hero-actions">
              <button className="hero-cta-primary" onClick={() => openAuth(true)}>
                Start Free
                <span className="cta-arrow">→</span>
              </button>
              <a href="#how-it-works" className="hero-cta-secondary">
                See How It Works
              </a>
            </div>
          </div>
        </section>

        <section
          className={`stats-bar ${visibleSections.has('stats') ? 'visible' : ''}`}
          id="stats"
          ref={setSectionRef('stats')}
        >
          <div className="stats-container">
            {stats.map((stat, i) => (
              <div className="stat-item" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          className={`features ${visibleSections.has('features') ? 'visible' : ''}`}
          id="features"
          ref={setSectionRef('features')}
        >
          <div className="section-container">
            <div className="section-header">
              <span className="section-tag">Features</span>
              <h2>Everything you need to run <br/>world-class surveys</h2>
              <p className="section-desc">
                From AI-powered creation to autonomous voice execution, SurVose handles the entire survey lifecycle.
              </p>
            </div>
            <div className="feature-grid">
              {features.map((feature, i) => (
                <div
                  className="feature-card"
                  key={i}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`how-it-works ${visibleSections.has('how-it-works') ? 'visible' : ''}`}
          id="how-it-works"
          ref={setSectionRef('how-it-works')}
        >
          <div className="section-container">
            <div className="section-header">
              <span className="section-tag">Process</span>
              <h2>From idea to insights <br/>in four steps</h2>
              <p className="section-desc">
                Our streamlined workflow takes you from concept to actionable data faster than ever.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map((step, i) => (
                <div
                  className="step-card"
                  key={i}
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <span className="step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                  {i < steps.length - 1 && <div className="step-connector"></div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`about ${visibleSections.has('about') ? 'visible' : ''}`}
          id="about"
          ref={setSectionRef('about')}
        >
          <div className="section-container">
            <div className="about-grid">
              <div className="about-content">
                <span className="section-tag">About SurVose</span>
                <h2>Reimagining how the world conducts surveys</h2>
                <p>
                  As AI voice and language models become capable of conducting long-form conversations, 
                  traditionally human-led phone surveys and polling can be automated. We believe voice AI 
                  will make it easier to conduct surveys.
                </p>
                <p>
                  We use AI not just to run surveys, but to improve them. Our platform helps creators 
                  understand intrinsic survey biases, craft better questions, and ultimately collect 
                  more representative data for better decision-making.
                </p>
                <button className="about-cta" onClick={() => openAuth(true)}>
                  Join the future of surveying
                  <span className="cta-arrow">→</span>
                </button>
              </div>
              <div className="about-visual">
                <div className="about-card-stack">
                  <div className="about-floating-card card-1">
                    <div className="mini-icon">🎙️</div>
                    <span>Voice AI Active</span>
                  </div>
                  <div className="about-floating-card card-2">
                    <div className="mini-icon">✓</div>
                    <span>QA Passed</span>
                  </div>
                  <div className="about-floating-card card-3">
                    <div className="mini-icon">📊</div>
                    <span>247 Responses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-bg">
            <div className="cta-orb cta-orb-1"></div>
            <div className="cta-orb cta-orb-2"></div>
          </div>
          <div className="cta-content">
            <h2>Ready to transform your surveys?</h2>
            <p>Join SurVose and start creating AI-powered, voice-driven surveys today.</p>
            <button className="cta-button" onClick={() => openAuth(true)}>
              Get Started — It's Free
              <span className="cta-arrow">→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-logo">
                <span className="logo-icon">◈</span>
                SurVose
              </div>
              <p>AI-powered survey automation for everyone.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#how-it-works">How It Works</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="#about">About</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 SurVose. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
