import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiUrl } from '../api/base'
import { LifeLine } from 'react-loading-indicators'
import '../Styles/Login.css'
import { evaluatePasswordStrength, isAcceptablePassword, PASSWORD_POLICY } from '../api/passwordUtils'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token') || ''
    setToken(t)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    setLoading(true)

    if (!token) {
      setError('Missing token. Use the link from your email.')
      setLoading(false)
      return
    }
    if (!isAcceptablePassword(password)) {
      setError(`Password should be at least ${PASSWORD_POLICY.minLength} characters and reasonably strong.`)
      setLoading(false)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
  const res = await axios.post(apiUrl('/auth/reset-password'), { token, password })
      if (res.data?.status === 'success') {
        setStatusMessage('Password reset successful. Redirecting to login...')
        setTimeout(() => navigate('/login'), 2000)
      } else {
        setError(res.data?.message || 'Invalid or expired link.')
      }
    } catch (err) {
      setError('Invalid or expired link.')
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="auth-container" style={{ maxWidth: '500px', justifyContent: 'center' }}>
        <div className="glass-card auth-panel" style={{ width: '100%', maxWidth: '500px' }}>
          <h2>Reset Password</h2>
          
          {error && <p className="auth-error">{error}</p>}
          {statusMessage && <p className="auth-success">{statusMessage}</p>}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <LifeLine color="#8EACCD" size="small" text="" textColor="" />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="pw-field-group">
              <PasswordInput
                placeholder="New password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <PasswordStrength password={password} />
            </div>
            <PasswordInput
              placeholder="Confirm password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
            />
            <PasswordMessage password={password} />
            <button type="submit" className="submit-btn" disabled={loading || !isAcceptablePassword(password) || password !== confirm}>
              Set New Password
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p style={{ fontSize: '0.9em', color: '#2C3E50', fontWeight: '500' }}>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{ background: 'transparent', border: 'none', color: '#000000', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9em', fontWeight: '600' }}
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

function PasswordStrength({ password }) {
  const { percent, label } = evaluatePasswordStrength(password)
  const classes = percent >= 80 ? 'strong' : percent >= 60 ? 'good' : percent >= 40 ? 'fair' : percent > 0 ? 'weak' : 'empty'
  return (
    <div className="pw-meter" aria-live="polite">
      <div className={`pw-meter__bar ${classes}`} style={{ width: `${percent}%` }} />
      <div className="pw-meter__label">{label}</div>
    </div>
  )
}

function PasswordMessage({ password }) {
  const { score } = evaluatePasswordStrength(password)
  if (!password) return null
  const msg = score < 2
    ? 'Password is weak — try adding numbers or special characters.'
    : score < 4
    ? 'Password looks okay. Stronger with numbers and special characters.'
    : 'Strong password.'
  const cls = score < 2 ? 'weak' : score < 4 ? 'fair' : 'good'
  return <p className={`pw-hint ${cls}`} role="status">{msg}</p>
}
