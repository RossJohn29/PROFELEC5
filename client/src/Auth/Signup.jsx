//Signup,jsx
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { apiUrl } from '../api/base'
import '../Styles/Signup.css'
import { motion } from 'framer-motion'
import LogoImg from '../Images/Auth Images/Logo.jpg'
import Pic1 from '../Images/Auth Images/AuthPic1.jpg'
import Pic2 from '../Images/Auth Images/AuthPic2.jpg'
import Pic3 from '../Images/Auth Images/AuthPic3.jpg'
import { evaluatePasswordStrength, isAcceptablePassword, PASSWORD_POLICY } from '../api/passwordUtils'
import { formatLicense, isValidLicense } from '../api/licenseUtils'
import PasswordInput from '../components/PasswordInput'

function Signup() {
  const [activeTab, setActiveTab] = useState('signup')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [termsChecked, setTermsChecked] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [formError, setFormError] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const navigate = useNavigate()
  const slideImgs = [LogoImg, Pic1, Pic2, Pic3]
  const [current, setCurrent] = useState(0)
  const [lastInteraction, setLastInteraction] = useState(Date.now())
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpTimer, setOtpTimer] = useState(0)

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
  const handleGoLogin = () => {
    // Navigate immediately (no delay)
    navigate('/login')
  }

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpTimer])

  // Add function to handle sending OTP
  const handleSendOtp = async () => {
    if (!email) {
      setFormError('Please enter your email first')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setFormError('Please enter a valid email address')
      return
    }

    setSendingOtp(true)
    setOtpError('')
    setFormError('')

    try {
      const result = await axios.post(apiUrl('/auth/send-otp'), {
        email: email.trim(),
        purpose: 'registration'
      })

      if (result.data.status === 'success') {
        setOtpSent(true)
        setOtpTimer(300) // 5 minutes countdown
        setFormError('')
      } else if (result.data.status === 'already_exists') {
        setFormError('This email is already registered. Please login instead.')
      }
    } catch (err) {
      console.error('Send OTP error:', err)
      if (err.response?.data?.status === 'already_exists') {
        setFormError('This email is already registered. Please login instead.')
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
        purpose: 'registration'
      })

      if (result.data.status === 'success') {
        setOtpVerified(true)
        setOtpError('')
        setFormError('')
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

  const handleSubmit = (e) => {
    e.preventDefault()

    setFormError('')

    if (!role) {
      setFormError('Please select a role')
      return
    }

    if (!termsChecked) {
      setFormError('Please agree to the Terms & Conditions')
      return
    }

    if (!isAcceptablePassword(password)) {
      setFormError(`Password should be at least ${PASSWORD_POLICY.minLength} characters and reasonably strong.`)
      return
    }

    // Check OTP verification
    if (!otpVerified) {
      setFormError('Please verify your email with OTP before creating an account')
      return
    }

    // If psychiatrist, require a valid license number
    if (role === 'Psychiatrist') {
      if (!isValidLicense(licenseNumber)) {
        setFormError('Enter a valid license number (1234-1234-123)')
        return
      }
    }

    axios.post(apiUrl('/register'), {
      firstName,
      lastName,
      email,
      password,
      role,
      licenseNumber: role === 'Psychiatrist' ? licenseNumber.trim() : undefined
    })
      .then(result => {
        console.log('Signup success:', result.data);
        navigate('/login');
      })
      .catch(err => {
        console.error('Signup error:', err);
        if (err.response?.data?.status === 'otp_required') {
          setFormError('Please verify your email with OTP first')
        } else if (err.response?.data?.error) {
          setFormError(err.response.data.error)
        } else {
          setFormError('Registration failed. Please try again.')
        }
      });
  }

   return (
    <div className="signup-page">
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

        <div className="glass-card auth-panel">
          <div className="tabs">
            <div className="tabs-bg">
              <motion.div
                className="indicator"
                initial={{ x: '100%' }}
                animate={{ x: activeTab === 'signin' ? '100%' : '0%' }}
                transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 1 }}
                style={{ transition: 'none', willChange: 'transform' }}
              />
              <button type="button" className={`tab ${activeTab === 'signup' ? 'active-tab' : ''}`} onClick={() => setActiveTab('signup')}>Sign up</button>
              <button type="button" className={`tab ${activeTab === 'signin' ? 'active-tab' : ''}`} onClick={handleGoLogin}>Log in</button>
            </div>
          </div>

          <h2>Create an Account</h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className="name-fields">
              <input
                type="text"
                placeholder="First Name"
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  // Reset OTP states when email changes
                  if (otpSent || otpVerified) {
                    setOtpSent(false)
                    setOtpVerified(false)
                    setOtpValue('')
                    setOtpTimer(0)
                  }
                }}
                required
                disabled={otpVerified}
              />

              {/* OTP Section */}
              {!otpVerified && (
                <div className="otp-section">
                  {!otpSent ? (
                    <button
                      type="button"
                      className="send-otp-btn"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || !email}
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
                  <span className="otp-success-text">Email verified successfully</span>
                </div>
              )}
            <div className="pw-field-group">
              <PasswordInput
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {/* strength meter */}
              <PasswordStrength password={password} />
            </div>

            <select
              className="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              {/* Placeholder option is disabled so user must actively pick a role */}
              <option value="" disabled>Select Role</option>
              <option value="Patient">Patient</option>
              <option value="Psychiatrist">Psychiatrist</option>
            </select>

            {role === 'Psychiatrist' && (
              <input
                type="text"
                placeholder="License number (1234-1234-123)"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(formatLicense(e.target.value))}
                inputMode="numeric"
                pattern="[0-9]{4}-[0-9]{4}-[0-9]{3}"
                title="Format: 1234-1234-123"
                required
              />
            )}

            <div className="terms">
              <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} />
              <label>I agree to the <span onClick={() => setShowTermsModal(true)}>Terms & Conditions</span></label>
            </div>

            {formError && <p className="auth-error" role="alert">{formError}</p>}
            <PasswordMessage password={password} />
            <button type="submit" className="submit-btn" disabled={!isAcceptablePassword(password)}>Create an Account</button>
          </form>

        </div>
      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="terms-modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="terms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="terms-modal-header">
              <h3>Terms & Conditions</h3>
              <button className="terms-modal-close" onClick={() => setShowTermsModal(false)}>×</button>
            </div>
            <div className="terms-modal-content">
              <p><strong>Effective Date:</strong> November 2, 2025</p>
              
              <h4>1. Acceptance of Terms</h4>
              <p>By creating an account and using our psychiatric appointment system, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use our service.</p>
              
              <h4>2. User Accounts</h4>
              <p>You are responsible for:</p>
              <ul>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Providing accurate and up-to-date information</li>
              </ul>
              
              <h4>3. Medical Disclaimer</h4>
              <p>This platform facilitates appointment booking only. It does not provide medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for medical concerns.</p>
              
              <h4>4. Privacy & Data Protection</h4>
              <p>We are committed to protecting your personal and medical information. Your data will be handled in accordance with applicable privacy laws and our Privacy Policy.</p>
              
              <h4>5. Appointment Scheduling</h4>
              <ul>
                <li>Patients must provide accurate information when booking</li>
                <li>Cancellations should be made at least 24 hours in advance</li>
                <li>Psychiatrists reserve the right to cancel or reschedule appointments</li>
              </ul>
              
              <h4>6. User Conduct</h4>
              <p>Users agree not to:</p>
              <ul>
                <li>Share false or misleading information</li>
                <li>Use the platform for any unlawful purpose</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Attempt to gain unauthorized access to the system</li>
              </ul>
              
              <h4>7. Limitation of Liability</h4>
              <p>The platform is provided "as is" without warranties of any kind. We are not liable for any direct, indirect, or consequential damages arising from your use of the service.</p>
              
              <h4>8. Changes to Terms</h4>
              <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
              
              <h4>9. Contact</h4>
              <p>For questions about these terms, please contact our support team through the platform.</p>
            </div>
            <div className="terms-modal-footer">
              <button onClick={() => setShowTermsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Signup

// Inline helpers UI (scoped to signup page)
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