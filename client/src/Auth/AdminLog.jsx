import { useState, useEffect } from 'react'
import LogoImg from '../Images/Auth Images/Logo.jpg'
import Pic1 from '../Images/Auth Images/AuthPic1.jpg'
import Pic2 from '../Images/Auth Images/AuthPic2.jpg'
import Pic3 from '../Images/Auth Images/AuthPic3.jpg'
import { useNavigate } from 'react-router-dom'
import '../Styles/Login.css'
import PasswordInput from '../components/PasswordInput'

function AdminLogin() {
  const [adminName, setAdminName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.remove('theme-dark');
    document.body.classList.remove('theme-dark', 'patient-page', 'with-sidebar-open', 'with-sidebar-collapsed');
    return () => {
      document.documentElement.classList.remove('theme-dark');
      document.body.classList.remove('theme-dark');
    };
  }, []);

  const slideImgs = [LogoImg, Pic1, Pic2, Pic3]
  const [current, setCurrent] = useState(0)
  const [lastInteraction, setLastInteraction] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteraction
      if (timeSinceLastInteraction >= 7500) {
        setCurrent((c) => (c + 1) % slideImgs.length)
      }
    }, 7500)
    return () => clearInterval(interval)
  }, [lastInteraction, slideImgs.length])
  const goPrev = () => { setCurrent((c) => (c - 1 + slideImgs.length) % slideImgs.length); setLastInteraction(Date.now()) }
  const goNext = () => { setCurrent((c) => (c + 1) % slideImgs.length); setLastInteraction(Date.now()) }
  const goTo = (i) => { setCurrent(i); setLastInteraction(Date.now()) }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (adminName.trim() === 'admin' && password === 'admin') {
      localStorage.setItem('isAdmin', 'true')
      localStorage.setItem('adminEmail', 'Admin')
      navigate('/Admin')
    } else {
      setError('Invalid username or password')
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="auth-container">
        <div className="slider" aria-hidden="false">
          {/* One picture per slide - only show current image */}
          <div
            className="slide active-slide"
            style={{ backgroundImage: `url(${slideImgs[current]})` }}
          />
          <div className="slider-overlay" />
          <button className="slider-arrow prev" aria-label="Previous" onClick={goPrev}></button>
          <button className="slider-arrow next" aria-label="Next" onClick={goNext}></button>
          <div className="dots">
            {slideImgs.map((_, i) => (
              <button key={i} className={`dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} aria-label={`Go to slide ${i+1}`} />
            ))}
          </div>
        </div>

        <div className="glass-card auth-panel dark-card">
          <h2>Admin Login</h2>
          
          {error && <p className="auth-error">{error}</p>}
          {loading && <p className="auth-loading">Loading...</p>}

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Username"
              name="username"
              autoComplete="username"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
            />
            <PasswordInput
              placeholder="Password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="submit-btn" disabled={loading}>
              Sign in
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p style={{ fontSize: '0.9em', color: '#FAF8F1' }}>
              Need help?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{ background: 'transparent', border: 'none', color: '#a28ef9', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9em' }}
              >
                Regular login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
