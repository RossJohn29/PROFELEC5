//Login.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { apiUrl } from '../api/base'
import { useNavigate } from 'react-router-dom'
import { LifeLine } from 'react-loading-indicators'
import '../Styles/Login.css'
import PasswordInput from '../components/PasswordInput'
import LogoImg from '../Images/Auth Images/Logo.jpg'
import Pic1 from '../Images/Auth Images/AuthPic1.jpg'
import Pic2 from '../Images/Auth Images/AuthPic2.jpg'
import Pic3 from '../Images/Auth Images/AuthPic3.jpg'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Patient')            // role state exists
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('signin')
  const navigate = useNavigate()
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpTimer, setOtpTimer] = useState(0)
  const [passwordVerified, setPasswordVerified] = useState(false)
  const [tempUserId, setTempUserId] = useState(null)
  const [tempUserRole, setTempUserRole] = useState(null)

  // 1 picture per slide with auto-swipe
  const slideImgs = [LogoImg, Pic1, Pic2, Pic3]
  const [current, setCurrent] = useState(0)
  const [lastInteraction, setLastInteraction] = useState(Date.now())

  const goPrev = () => {
    setCurrent((c) => (c - 1 + slideImgs.length) % slideImgs.length)
    setLastInteraction(Date.now())
  }

  const goNext = () => {
    setCurrent((c) => (c + 1) % slideImgs.length)
    setLastInteraction(Date.now())
  }

  const goTo = (i) => {
    setCurrent(i)
    setLastInteraction(Date.now())
  }

  // Auto-swipe after 7.5 seconds of no interaction
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteraction
      if (timeSinceLastInteraction >= 7500) {
        setCurrent((c) => (c + 1) % slideImgs.length)
      }
    }, 7500)
    return () => clearInterval(interval)
  }, [lastInteraction, slideImgs.length])

  const profileIsComplete = (p) => {
    if (!p) return false
    return !!(p.firstName && p.lastName && p.birthday && p.age && p.gender && p.contact && p.address && p.hmoNumber 
      && p.emergencyName && p.emergencyContact && p.emergencyAddress
    )
  }

  // Add OTP timer effect
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpTimer])

// Add function to handle sending OTP for login
  const handleSendOtp = async () => {
    if (!email) {
      setError('Please enter your email first')
      return
    }

    setSendingOtp(true)
    setOtpError('')
    setError('')

    try {
      const result = await axios.post(apiUrl('/auth/send-otp'), {
        email: email.trim(),
        purpose: 'login'
      })

      if (result.data.status === 'success') {
        setOtpSent(true)
        setOtpTimer(300) // 5 minutes countdown
        setError('')
      }
    } catch (err) {
      console.error('Send OTP error:', err)
      if (err.response?.status === 404) {
        setError('User not registered. Please sign up first.')
      } else {
        setOtpError(err.response?.data?.message || 'Failed to send OTP. Please try again.')
      }
    } finally {
      setSendingOtp(false)
    }
  }

  // Add function to handle OTP verification
    const handleVerifyOtp = async () => {
      if (!otpValue || otpValue.length !== 6) {
        setOtpError('Please enter the 6-digit OTP')
        return
      }

      setVerifyingOtp(true)
      setOtpError('')

      try {
        const result = await axios.post(apiUrl('/auth/verify-otp'), {
          email: email.trim(),
          otp: otpValue,
          purpose: 'login'
        })

        if (result.data.status === 'success') {
          setOtpVerified(true)
          setOtpError('')
          setError('')
          // Automatically proceed with login after OTP verification
          await performLogin(true)
        } else {
          setOtpError(result.data.message || 'Invalid OTP. Please try again.')
        }
      } catch (err) {
        console.error('Verify OTP error:', err)
        setOtpError(err.response?.data?.message || 'Failed to verify OTP. Please try again.')
      } finally {
        setVerifyingOtp(false)
      }
    }

  // Modified handleSubmit to check credentials first, then require OTP
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // If OTP already verified, proceed with full login
    if (otpVerified) {
      await performLogin(true)
      setLoading(false)
      return
    }

    // First, verify email and password
    try {
      const result = await axios.post(apiUrl('/login'), {
        email: email.trim(),
        password,
        role,
        otpVerified: false // Indicate we're just checking credentials
      })

      const data = result.data

      if (data && data.status === 'otp_required') {
        // Credentials are correct, now require OTP
        setPasswordVerified(true)
        setTempUserId(data.userId)
        setTempUserRole(data.role)
        setError('')
        setLoading(false)
        // Don't proceed to OTP sending automatically - wait for user to click
      } else if (data && data.status === 'success') {
        // Should not happen, but handle it
        await performLogin(true)
      } else if (data && data.status === 'role_mismatch') {
        setError('Selected role does not match this account')
      } else if (data && data.status === 'wrong_password') {
        setError('Incorrect password')
      } else if (data && data.status === 'not_found') {
        setError('User not registered')
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      console.error('login error', err)
      if (role === 'Psychiatrist') {
        setError('Your account is not for Psychiatrist. Use patient Login instead.')
      } else {
        setError('Your account is not for Patient. Use psychiatrist Login instead.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Separated login logic for after OTP verification
  const performLogin = async (isOtpVerified) => {
    setLoading(true)
    try {
      const result = await axios.post(apiUrl('/login'), {
        email: email.trim(),
        password,
        role,
        otpVerified: isOtpVerified
      })

      const data = result.data

      if (data && data.status === 'success') {
        const userEmail = email.trim()
        localStorage.setItem('email', userEmail)
        if (data.userId) localStorage.setItem('userId', data.userId)

        const roleFromServer = data.user?.role || data.role || null
        if (roleFromServer) localStorage.setItem('role', roleFromServer)

        if (roleFromServer === 'Psychiatrist') {
          localStorage.setItem('doctorEmail', userEmail)
          navigate('/dashboard')
          return
        }

        // For patients, check profile completion
        try {
          const check = await axios.post(apiUrl('/patient/check-profile'), { email: userEmail })
          if (check.data && check.data.complete) {
            navigate('/PatientDashboard')
          } else {
            navigate('/PatientForm')
          }
          return
        } catch (_) {}

        try {
          const res = await axios.post(apiUrl('/patient/get-profile'), { email: userEmail })
          const patient = res.data?.patient || null
          if (profileIsComplete(patient)) {
            navigate('/PatientDashboard')
          } else {
            navigate('/PatientForm')
          }
        } catch {
          navigate('/PatientForm')
        }
      } else if (data && data.status === 'otp_required') {
        setError('OTP verification required')
      } else if (data && data.status === 'otp_not_verified') {
        setError('Please verify OTP first')
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      console.error('performLogin error', err)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
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
          <div className="tabs">
            <div className="tabs-bg">
              <motion.div
                className="indicator"
                initial={{ x: '0%' }}
                animate={{ x: activeTab === 'signup' ? '0%' : '100%' }}
                transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 1 }}
                style={{ transition: 'none', willChange: 'transform' }}
              />
              <button
                type="button"
                className={`tab ${activeTab === 'signup' ? 'active-tab' : ''}`}
                onClick={() => {
                  // Navigate immediately (no delay)
                  navigate('/register')
                }}
              >
                Sign up
              </button>
              <button type="button" className={`tab ${activeTab === 'signin' ? 'active-tab' : ''}`}>Log in</button>
            </div>
          </div>

          <h2>Login to your Account</h2>

          {error && <p className="auth-error">{error}</p>}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <LifeLine color="#8EACCD" size="small" text="" textColor="" />
            </div>
          )}

          {/* Role select (replaces previous radio toggle) */}
          <div className="role-field">
            <select className="role-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select Role</option>
              <option value="Patient">Patient</option>
              <option value="Psychiatrist">Psychiatrist</option>
            </select>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              name="email"
              value={email}
              onChange={(e) => {
                const val = e.target.value
                setEmail(val)
                try {
                  if (val && val.trim()) {
                    localStorage.setItem('lastLoginEmail', val.trim())
                  }
                } catch (_) {}
              }}
              required
            />

            <PasswordInput
              placeholder="Password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* Show OTP section after both email and password are filled */}
            {email && password && !otpVerified && (
              <div className="otp-section">
                <div className="otp-notice">
                  <p>
                    <strong>Email verification required</strong><br />
                    Click below to receive a one-time password
                  </p>
                </div>

                {!otpSent ? (
                  <button
                    type="button"
                    className="send-otp-btn"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? 'Sending OTP...' : 'Send OTP to Email'}
                  </button>
                ) : (
                  <div className="otp-verify-section">
                    <div className="otp-input-group">
                      <input
                        type="text"
                        className="otp-input"
                        placeholder="Enter 6-digit OTP"
                        value={otpValue}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setOtpValue(val)
                          setOtpError('')
                        }}
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                      <button
                        type="button"
                        className="verify-otp-btn"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otpValue.length !== 6}
                      >
                        {verifyingOtp ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                    
                    <div className="otp-timer-row">
                      <span className="otp-timer">
                        {otpTimer > 0 ? (
                          <>Expires in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}</>
                        ) : (
                          <span className="otp-expired">OTP expired</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="resend-otp-btn"
                        onClick={() => {
                          setOtpSent(false)
                          setOtpValue('')
                          setOtpTimer(0)
                          handleSendOtp()
                        }}
                        disabled={sendingOtp || otpTimer > 240}
                      >
                        Resend OTP
                      </button>
                    </div>

                    {otpError && <p className="otp-error">{otpError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Success indicator when OTP is verified */}
            {otpVerified && (
              <div className="otp-success">
                <span className="otp-success-icon">✓</span>
                <span className="otp-success-text">Email verified - Logging you in...</span>
              </div>
            )}

            <button 
              type="submit" 
              className="submit-btn" 
              disabled={loading || (email && password && !otpVerified)}
            >
              {loading ? 'Processing...' : (email && password && !otpVerified) ? 'Verify OTP to Continue' : 'Sign in'}
            </button>

            <div className="forgot-password-link">
              <button
                type="button"
                onClick={() => {
                  try {
                    const typed = (email || '').trim()
                    if (typed) {
                      localStorage.setItem('lastLoginEmail', typed)
                    }
                  } catch (_) {}
                  navigate('/forgot-password', { state: { email: (email || '').trim() } })
                }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login