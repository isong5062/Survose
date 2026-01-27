import './Home.css'

function Home() {
  return (
    <div className="home-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">SurVose</div>
          <button className="sign-in-btn">Sign In/Sign Up</button>
        </div>
      </nav>

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
