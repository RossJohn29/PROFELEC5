import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiUrl } from '../api/base'
import { LifeLine } from 'react-loading-indicators'
import '../Styles/Login.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  // Pull the email from navigation state first, then from query string, then from storage; lock when found
  useEffect(() => {
    try {
      // 1) route state
      const fromState = (location.state?.email || '').trim?.() || ''
      if (fromState) {
        setEmail(fromState)
        setIsLocked(true)
        return
      }

      // 2) query string
      const params = new URLSearchParams(window.location.search)
      const fromQuery = (params.get('email') || '').trim()
      if (fromQuery) {
        setEmail(fromQuery)
        setIsLocked(true)
        return
      }

      // 3) local storage (typed on login)
      const last = (localStorage.getItem('lastLoginEmail') || '').trim()
      if (last) {
        setEmail(last)
        setIsLocked(true)
        return
      }
      // Optional fallback: if user is already logged in, use stored email
      const stored = (localStorage.getItem('email') || '').trim()
      if (stored) {
        setEmail(stored)
        setIsLocked(true)
      }
    } catch (_) {}
  }, [location.state])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    setLoading(true)

    try {
      const lockedEmail = (email || '').trim()
      if (!lockedEmail) {
        setError('Enter your email on the Login screen, then click "Forgot password?" to proceed.')
        setLoading(false)
        return
      }

  const res = await axios.post(apiUrl('/auth/forgot-password'), { email: lockedEmail })
      if (res.data?.preview) {
        setStatusMessage(`Check your inbox! Preview: ${res.data.preview}`)
      } else {
        setStatusMessage('If an account exists, a reset link has been sent to your email.')
      }
    } catch (err) {
      setError('Something went wrong. Please try again later.')
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="auth-container" style={{ maxWidth: '500px', justifyContent: 'center' }}>
        <div className="glass-card auth-panel"  style={{ width: '100%', maxWidth: '500px' }}>
          <h2>Forgot Password</h2>
          
          {error && <p className="auth-error">{error}</p>}
          {statusMessage && <p className="auth-success">{statusMessage}</p>}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <LifeLine color="#8EACCD" size="small" text="" textColor="" />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ width: '100%', marginBottom: '1rem' }}>
              <label htmlFor="locked-email" style={{ display: 'block', marginBottom: 8, color: '#2C3E50', fontSize: '0.95em', fontWeight: '500' }}>
                Email address
              </label>
              <input
                id="locked-email"
                type="email"
                value={email}
                readOnly
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '2px solid rgba(142, 172, 205, 0.3)',
                  background: '#F8F9FA',
                  color: '#6b7280',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
              {!isLocked && (
                <p style={{ marginTop: 8, fontSize: '0.85em', color: '#7A99BA', fontWeight: '500' }}>
                  Enter your email on the Login page first, then click "Forgot password?".
                </p>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              Send Reset Link
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p style={{ fontSize: '0.9em', color: '#2C3E50', fontWeight: '500' }}>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{ background: 'transparent', border: 'none', color: '#000000ff', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9em', fontWeight: '600' }}
              >
                Back to login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
