//PatientAppDetails.jsx
import React, { useState, useEffect, useRef } from 'react'
import { FaStar } from 'react-icons/fa'
import { useLocation, useNavigate } from 'react-router-dom'
import PNavbar from '../../SideBar/PNavbar'
import axios from 'axios'
import { apiUrl } from '../../api/base'
import jsPDF from 'jspdf'
import '../../Styles/PatientAppDetails.css'

export default function PatientAppDetails() {
  const location = useLocation()
  const navigate = useNavigate()
  const [appointment, setAppointment] = useState(location.state?.appointment || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const pollingRef = useRef(null)
  const submittingReviewRef = useRef(false)

  useEffect(() => {
    if (appointment) {
      setRating(appointment.rating || 0)
      setReviewText(appointment.review || '')
      setSubmitted(!!appointment.rating)
    }
  }, [appointment])

  const qs = new URLSearchParams(location.search)
  const appointmentId = appointment?._id || location.state?.appointmentId || qs.get('id') || null

  // fetch appointment if not passed from state
  useEffect(() => {
    let cancelled = false

    const fetchAppointment = async (id) => {
      try {
        const res = await axios.get(apiUrl(`/api/appointments/${id}`))
        if (cancelled) return
        if (res.data?.appointment) {
          setAppointment(res.data.appointment)
          console.log('Fetched appointment:', res.data.appointment)
        }
      } catch (err) {
        console.error('Fetch appointment error', err)
        if (!cancelled) setError('Failed to load appointment details.')
      }
    }

    if (!appointment && appointmentId) {
      fetchAppointment(appointmentId)
    }

    return () => { cancelled = true }
  }, [appointment, appointmentId])

  // poll for updates (stop if status !== pending)
  useEffect(() => {
    if (!appointmentId) return

    pollingRef.current = setInterval(async () => {
      try {
        const res = await axios.get(apiUrl(`/api/appointments/${appointmentId}`))
        const serverAppt = res.data?.appointment
        if (serverAppt) {
          setAppointment(prev => {
            if (!prev || JSON.stringify(prev) !== JSON.stringify(serverAppt)) return serverAppt
            return prev
          })
          if (serverAppt.status && serverAppt.status !== 'pending') {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }
      } catch (err) {
        console.error('Polling error', err)
      }
    }, 5000)

    return () => clearInterval(pollingRef.current)
  }, [appointmentId])

  const cancelAppointment = async () => {
    if (!appointment?._id) return
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return

    setLoading(true)
    try {
      const res = await axios.patch(apiUrl(`/api/appointments/${appointment._id}`), { status: 'cancelled', cancelledBy: 'patient' })
      if (res.data?.appointment) {
        // refetch full populated appointment and stay on details page
        const refetch = await axios.get(apiUrl(`/api/appointments/${appointment._id}`))
        if (refetch.data?.appointment) setAppointment(refetch.data.appointment)
        // stop polling since status is no longer pending
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setMessage('Appointment cancelled')
      }
    } catch (err) {
      console.error('Cancel error', err)
      setError('Failed to cancel appointment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitReview = async () => {
    if (!appointment?._id) return
    // prevent submitting if there's already a stored review
    if (appointment.rating) {
      setReviewMessage('You have already submitted a review for this appointment')
      return
    }
    if (submittingReviewRef.current) return
    submittingReviewRef.current = true
    setSubmittingReview(true)
    setReviewError('')
    setReviewMessage('')
    try {
      const res = await axios.post(apiUrl(`/api/appointments/${appointment._id}/review`), { rating, review: reviewText })
      if (res.data?.appointment) {
        setAppointment(res.data.appointment)
        setReviewMessage('Thank you for your review')
        setSubmitted(true)
      } else {
        setReviewError('Failed to submit review')
      }
    } catch (err) {
      console.error('Submit review error', err)
      setReviewError('Failed to submit review')
    } finally {
      setSubmittingReview(false)
      submittingReviewRef.current = false
    }
  }

  const generateAppointmentPDF = () => {
    if (!appointment) return

    const doc = appointment.doctor || {}
    const pat = appointment.patient || {}
    const apptDate = appointment.date ? new Date(appointment.date) : null
    const apptDateStr = apptDate ? apptDate.toLocaleDateString() : '—'
    const apptTimeStr = apptDate ? apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    let currentY = 20

    // Header
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text('TheraPH Appointment Receipt', pageWidth / 2, currentY, { align: 'center' })

    currentY += 8
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' })

    currentY += 15

    // Appointment Status Badge
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text('Status:', 20, currentY)
    
    const status = String(appointment.status || '').toLowerCase()
    const statusText = status.charAt(0).toUpperCase() + status.slice(1)
    
    // Set status color
    if (status === 'approved') {
      pdf.setTextColor(31, 122, 58) // green
    } else if (status === 'pending') {
      pdf.setTextColor(179, 107, 0) // orange
    } else if (status === 'completed') {
      pdf.setTextColor(31, 63, 167) // blue
    } else if (status === 'cancelled') {
      pdf.setTextColor(179, 0, 0) // red
    }
    
    pdf.setFontSize(14)
    pdf.text(statusText, 50, currentY)
    pdf.setTextColor(0, 0, 0) // reset to black

    currentY += 15

    // Separator line
    pdf.setDrawColor(200, 200, 200)
    pdf.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Doctor Information Section
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text('Doctor Information', 20, currentY)
    currentY += 8

    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')
    
    const doctorInfo = [
      { label: 'Name:', value: `${doc.firstName || ''} ${doc.lastName || ''}`.trim() || '—' },
      { label: 'Specialization:', value: doc.specialty || '—' },
      { label: 'Email:', value: doc.email || '—' },
      { label: 'Contact:', value: doc.contact || '—' },
      { label: 'Clinic Address:', value: doc.address1 || '—' },
    ]

    doctorInfo.forEach(item => {
      pdf.setFont(undefined, 'bold')
      pdf.text(item.label, 25, currentY)
      pdf.setFont(undefined, 'normal')
      
      const textLines = pdf.splitTextToSize(item.value, pageWidth - 75)
      pdf.text(textLines, 70, currentY)
      currentY += textLines.length * 5
    })

    currentY += 5

    // Separator line
    pdf.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Patient Information Section
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text('Patient Information', 20, currentY)
    currentY += 8

    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')

    const patientName = (pat.firstName || pat.name || '') + (pat.lastName ? ' ' + pat.lastName : '')
    
    const patientInfo = [
      { label: 'Name:', value: patientName || '—' },
      { label: 'Email:', value: pat.email || localStorage.getItem('email') || '—' },
      { label: 'Age:', value: pat.age || '—' },
      { label: 'Gender:', value: pat.gender || '—' },
      { label: 'Contact:', value: pat.contact || '—' },
      { label: 'HMO Number:', value: pat.hmoNumber || '—' },
    ]

    patientInfo.forEach(item => {
      pdf.setFont(undefined, 'bold')
      pdf.text(item.label, 25, currentY)
      pdf.setFont(undefined, 'normal')
      
      const textLines = pdf.splitTextToSize(String(item.value), pageWidth - 75)
      pdf.text(textLines, 70, currentY)
      currentY += textLines.length * 5
    })

    currentY += 5

    // Separator line
    pdf.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Appointment Details Section
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text('Appointment Details', 20, currentY)
    currentY += 8

    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')

    const appointmentInfo = [
      { label: 'Date:', value: apptDateStr },
      { label: 'Time:', value: apptTimeStr },
      { label: 'Consultation Fee:', value: doc.fees ? `₱ ${doc.fees}` : '—' },
      { label: 'Status:', value: statusText },
    ]

    appointmentInfo.forEach(item => {
      pdf.setFont(undefined, 'bold')
      pdf.text(item.label, 25, currentY)
      pdf.setFont(undefined, 'normal')
      pdf.text(String(item.value), 70, currentY)
      currentY += 5
    })

    currentY += 5

    // Patient Concern/Notes
    if (appointment.notes) {
      pdf.setFont(undefined, 'bold')
      pdf.text('Patient Concern:', 25, currentY)
      currentY += 5
      
      pdf.setFont(undefined, 'normal')
      const notesLines = pdf.splitTextToSize(appointment.notes, pageWidth - 50)
      pdf.text(notesLines, 25, currentY)
      currentY += notesLines.length * 5 + 5
    }

    // Rating section (if completed and rated)
    if (appointment.status === 'completed' && appointment.rating) {
      currentY += 5
      pdf.line(20, currentY, pageWidth - 20, currentY)
      currentY += 10

      pdf.setFontSize(12)
      pdf.setFont(undefined, 'bold')
      pdf.text('Patient Feedback', 20, currentY)
      currentY += 8

      pdf.setFontSize(9)
      pdf.setFont(undefined, 'bold')
      pdf.text('Rating:', 25, currentY)
      pdf.setFont(undefined, 'normal')
      pdf.text(`${appointment.rating} / 5 stars`, 70, currentY)
      currentY += 6

      if (appointment.review) {
        pdf.setFont(undefined, 'bold')
        pdf.text('Review:', 25, currentY)
        currentY += 5
        
        pdf.setFont(undefined, 'normal')
        const reviewLines = pdf.splitTextToSize(appointment.review, pageWidth - 50)
        pdf.text(reviewLines, 25, currentY)
        currentY += reviewLines.length * 5
      }
    }

    // Footer
    const footerY = 280
    pdf.setFontSize(7)
    pdf.setTextColor(100, 100, 100)
    pdf.text('This is a computer-generated document. No signature is required.', pageWidth / 2, footerY, { align: 'center' })
    pdf.text('TheraPH - Your Mental Health Matters', pageWidth / 2, footerY + 4, { align: 'center' })
    pdf.text(`Document ID: ${appointment._id || 'N/A'}`, pageWidth / 2, footerY + 8, { align: 'center' })

    // Save PDF
    const filename = `AppointmentReceipt_${patientName.replace(/\s+/g, '_') || 'Patient'}_${apptDateStr.replace(/\//g, '-')}.pdf`
    pdf.save(filename)
  }

  if (!appointment) {
    return (
      <div className="patient-layout">
        <PNavbar />
        <div className="pad-main">
          <p style={{ color: 'crimson' }}>{error || 'No appointment data available.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/PatientDashboard')}>Back to Home</button>
        </div>
      </div>
    )
  }

  const doc = appointment.doctor || {}
  const pat = appointment.patient || {}
  const apptDate = appointment.date ? new Date(appointment.date) : null
  const apptDateStr = apptDate ? apptDate.toLocaleDateString() : '—'
  const apptTimeStr = apptDate ? apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

  const prettyStatus = (s) => {
    if (!s) return '—'
    const st = String(s).toLowerCase()
    return st.charAt(0).toUpperCase() + st.slice(1)
  }

  console.log('Doctor data:', doc)

  return (
    <div className="patient-layout">
      <PNavbar />
      <div className="pad-main">
        <div className="pad-dashboard-grid">
          {/* left side doctor profile */}
          <section className="card doctor-profile">
            <h3 className="doctor-profile-title">Psychiatrist Profile</h3>

            <div className="doctor-profile-top">
              <div className="doctor-profile-row">
                <img
                  className="doctor-avatar"
                  src={doc.profileImage || 'https://via.placeholder.com/180'}
                  alt="Doctor"
                />
                <div className="doctor-info">
                  <h4 className="padDoctor-name">{(doc.firstName || '') + ' ' + (doc.lastName || '')}</h4>
                  <p className="doctor-role">{doc.specialty ?? '—'}</p>
                  <p className="doctor-fees">₱ {doc.fees ?? '—'} / session</p>
                </div>
              </div>
            </div>

            <div className="doctor-profile-bottom">
              <div className="doctor-about">
                <h5>About</h5>
                <p className="doctor-about-text">{doc.about || '—'}</p>
              </div>

              <div className="doctor-experience">
                <h5>Experience</h5>
                {Array.isArray(doc.experience) ? (
                  doc.experience.length ? (
                    <div className="doctor-experience-text">
                      {doc.experience.map((exp, idx) => (
                        <p key={idx}>{exp}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="doctor-experience-text">—</p>
                  )
                ) : (
                  <p className="doctor-experience-text">{doc.experience || '—'}</p>
                )}
              </div>

              <div className="doctor-specialty">
                <h5>Specialization</h5>
                <p className="doctor-specialty-text">{doc.specialty ?? '—'}</p>
              </div>

              <div className="doctor-clinicAddress">
                <h5>Clinic Address</h5>
                <p className="doctor-clinicAddress-text">{doc.address1 || '—'}</p>
              </div>
            </div>
          </section>

          {/* right side appointment summary */}
          <aside className="card pad-details-right">
            <div className="pad-section thankyou">
              Thank you for booking an appointment!
            </div>

            <div className="pad-section">
              <h4>Appointment Details</h4>
              <div className="two-col">
                <div className="left">
                  <div>Appointment Status</div>
                  <div>Doctor Name</div>
                  <div>Date</div>
                  <div>Time</div>
                  <div>To Pay</div>
                  <div>Doctor Email</div>
                  <div>Doctor Contact</div>
                </div>
                <div className="right">
                  <div>
                    <span className={`appt-status status-${String(appointment.status || '').toLowerCase()}`}>
                      {prettyStatus(appointment.status)}
                    </span>
                  </div>
                  <div>{(doc.firstName || '') + ' ' + (doc.lastName || '')}</div>
                  <div>{apptDateStr}</div>
                  <div>{apptTimeStr}</div>
                  <div>₱ {doc.fees ?? '—'}</div>
                  <div>{doc.email || '—'}</div>
                  <div>{doc.contact || '—'}</div>
                </div>
              </div>
            </div>

            <div className="pad-section patient-info">
              <h4>Patient Information</h4>
              <div className="two-col">
                <div className="left">
                  <div>Patient Name</div>
                  <div>Patient Email</div>
                  <div>Patient Contact</div>
                  <div>HMO Number</div>
                  <div>HMO Card</div>
                </div>
                <div className="right">
                  <div>
                    {(pat.firstName || pat.name || '') +
                      (pat.lastName ? ' ' + pat.lastName : '')}
                  </div>
                  <div>{pat.email || localStorage.getItem('email') || '—'}</div>
                  <div>{pat.contact || '—'}</div>
                  <div>{pat.hmoNumber || '—'}</div>
                  <div>
                    {pat.hmoCardImage ? (
                      <img
                        src={pat.hmoCardImage}
                        alt="HMO Card"
                        className="hmo-card"
                      />
                    ) : (
                      <div style={{ color: '#9ca3af' }}>No HMO card</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pad-section patient-concern">
              <h4>Patient Concern</h4>
              <div>{appointment.notes || '—'}</div>
            </div>

            {/* review / rating section (show when appointment completed and not yet reviewed) */}
            {appointment.status === 'completed' && (
              <div className="pad-section patient-review">
                <h4>Rate Your Appointment</h4>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map(i => {
                    const filled = appointment?.rating ? appointment.rating >= i : (hoverRating || rating) >= i
                    return (
                      <span
                        key={i}
                        className={`rating-star ${filled ? 'filled' : ''} ${appointment?.rating ? 'readonly' : ''}`}
                        onClick={appointment?.rating ? undefined : () => setRating(i)}
                        onMouseEnter={appointment?.rating ? undefined : () => setHoverRating(i)}
                        onMouseLeave={appointment?.rating ? undefined : () => setHoverRating(0)}
                      >
                        <FaStar />
                      </span>
                    )
                  })}
                </div>
                <div className="rating-textarea">
                  <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Leave a comment (optional)" rows={4} className="form-control" />
                </div>
                <div className="rating-actions">
                  {!appointment?.rating ? (
                    <button
                      className="btn btn-primary"
                      disabled={submittingReview || rating < 1 || submitted}
                      onClick={submitReview}
                    >
                      {submittingReview ? 'Submitting…' : (submitted ? 'Submitted' : 'Submit Review')}
                    </button>
                  ) : (
                    <div className="text-muted">You rated this appointment {appointment.rating} / 5</div>
                  )}
                </div>
                {reviewMessage && <div className="alert alert-success mt-2">{reviewMessage}</div>}
                {reviewError && <div className="alert alert-danger mt-2">{reviewError}</div>}
              </div>
            )}

            <div className="pad-section action-buttons">
              {(appointment.status || '').toLowerCase() !== 'cancelled' && (appointment.status || '').toLowerCase() !== 'completed' && (
                <button
                  className="btn btn-primary"
                  onClick={cancelAppointment}
                  disabled={loading}
                >
                  {loading ? 'Cancelling…' : 'Cancel Appointment'}
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={generateAppointmentPDF}
              >
                Download PDF
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/PatientDashboard')}
              >
                Back to Home
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}