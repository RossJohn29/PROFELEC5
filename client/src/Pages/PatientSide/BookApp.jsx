//BookApp.jsx - Updated with Back Button
import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiUrl } from '../../api/base'
import { LifeLine } from 'react-loading-indicators'
import { FaArrowLeft } from 'react-icons/fa'
import PNavbar from '../../SideBar/PNavbar'
import CalendarC from '../../Calendar/CalendarC.jsx'
import '../../Styles/BookApp.css'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

export default function BookApp() {
  const { email: emailParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }, [])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [availableDates, setAvailableDates] = useState([])
  const [concerns, setConcerns] = useState('') 
  const [reviews, setReviews] = useState([])
  const [avgRating, setAvgRating] = useState(null)
  const [ratingCount, setRatingCount] = useState(0)
  const [pageSize, setPageSize] = useState(3)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const [date, setDate] = useState(() => toYMD(new Date()));

  const Star = ({ type = 'empty', size = 16 }) => {
    const fill = type === 'full' ? '#F59E0B' : (type === 'half' ? 'url(#halfGrad)' : 'none')
    const stroke = type === 'empty' ? '#cbd5e1' : '#F59E0B'
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="halfGrad" x1="0" x2="1">
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M12 .587l3.668 7.431L23.4 9.748l-5.7 5.556L19.336 23 12 19.771 4.664 23l1.636-7.696-5.7-5.556 7.732-1.73z" fill={fill} stroke={stroke} strokeWidth="0.5" />
      </svg>
    )
  }

  const StarRating = ({ value = 0, size = 16 }) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      if (value >= i) stars.push(<Star key={i} type="full" size={size} />)
      else if (value >= i - 0.5) stars.push(<Star key={i} type="half" size={size} />)
      else stars.push(<Star key={i} type="empty" size={size} />)
    }
    return <span className="star-rating" aria-label={`Rating: ${value} out of 5`}>{stars}</span>
  }

  // Handle back navigation
  const handleBack = () => {
    navigate('/DoctorLists')
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    const qs = new URLSearchParams(location.search)
    const email = decodeURIComponent(emailParam || location.state?.email || qs.get('email') || '')
    if (!email) {
      setError('Invalid doctor')
      setLoading(false)
      return
    }

    axios.post(apiUrl('/doctor/get-profile'), { email })
      .then(res => {
        if (cancelled) return
        const d = res.data?.doctor
        if (!d) { setError('Doctor not found'); return }
        setDoctor({
          id: d._id,
          firstName: d.firstName || '',
          lastName: d.lastName || '',
          email: d.email || email,
          specialty: d.specialty || 'Mental Health',
          fees: d.fees ?? '—',
          experience: d.experience || '',
          education: Array.isArray(d.education) ? d.education : [],
          about: d.about || '',
          address1: d.address1 || '',
          contact: d.contact || d.address2 || '',
          profileImage: d.profileImage || ''
        })
      })
      .catch(() => setError('Failed to load doctor'))
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [emailParam, location.search, location.state])

  const displayName = doctor ? `${doctor.firstName} ${doctor.lastName}`.trim() : ''

  function hhmmTo12(hhmm) {
    if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return '—';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = (h % 12) || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function addMinutesHHMM(hhmm, mins) {
    if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return '—';
    const total = h * 60 + m + mins;
    const capped = Math.min(total, (24 * 60));
    const hh = String(Math.floor(capped / 60)).padStart(2, '0');
    const mm = String(capped % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const fetchSlots = async (dId, ymd) => {
    if (!dId || !ymd) return;
    setSlotsLoading(true);
    setSelectedSlot('');
    try {
      const res = await axios.get(apiUrl(`/api/doctor/${dId}/available-slots`), {
        params: { date: ymd, slot: 60 }
      });
      const slots = Array.isArray(res.data?.slots) ? res.data.slots : [];
      const clean = slots.filter(t => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t));
      setAvailableSlots(clean);
    } catch (e) {
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (doctor && date) {
      fetchSlots(doctor.id, date);
    }
  }, [doctor, date]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAvailableDates() {
      if (!doctor?.id || !doctor?.email) return;
      const days = 30;
      const out = [];
      const today = new Date();
      today.setHours(0,0,0,0);
      const promises = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const ymd = `${y}-${m}-${dd}`;
        const p = axios.get(apiUrl('/doctor/availability'), { params: { email: doctor.email, date: ymd } })
          .then(res => {
            const avail = res.data?.availability;
            if (avail && Array.isArray(avail.ranges) && avail.ranges.length > 0) {
              out.push(ymd);
            }
          })
          .catch(() => {});
        promises.push(p);
      }

      try {
        await Promise.all(promises);
        if (!cancelled) {
          out.sort();
          setAvailableDates(out);
          if (out.length > 0) {
            if (!out.includes(date)) {
              setDate(out[0]);
            }
          }
        }
      } catch (e) {}
    }
    fetchAvailableDates();
    return () => { cancelled = true };
  }, [doctor, date]);

  useEffect(() => {
    let cancelled = false
    async function fetchReviews() {
      if (!doctor?.id) return
      try {
        const res = await axios.get(apiUrl(`/api/doctor/${doctor.id}/appointments`), {
          params: { status: 'completed' }
        })
        const items = Array.isArray(res.data?.appointments) ? res.data.appointments : []
        const rated = items.filter(a => a.rating !== undefined && a.rating !== null)
        if (!cancelled) {
          setRatingCount(rated.length)
          if (rated.length > 0) {
            const sum = rated.reduce((s, r) => s + (Number(r.rating) || 0), 0)
            setAvgRating(Number((sum / rated.length).toFixed(2)))
          } else {
            setAvgRating(null)
          }

          setReviews(rated.map((r) => ({
            id: r._id,
            rating: Number(r.rating) || 0,
            comment: r.review || r.comment || r.notes || '',
            date: r.date
          })))
        }
      } catch (err) {}
    }
    fetchReviews()
    return () => { cancelled = true }
  }, [doctor])

  const executeBooking = async () => {
    if (isSubmitting) return;
    setSubmitNotice('');
    setIsSubmitting(true);
    try {
      if (!selectedSlot) {
        setSubmitNotice('Please select a time.');
        return;
      }

      const patientEmail = localStorage.getItem('patientEmail') || localStorage.getItem('email');
      if (!patientEmail) { setError('Missing patient email in localStorage. Please login again.'); return }

      const payload = {
        doctorId: doctor.id,
        patientEmail,
        localYMD: date,
        timeHHMM: selectedSlot,
        notes: concerns
      };
      const res = await axios.post(apiUrl('/api/appointments'), payload);
      const created = res.data?.appointment;
      setSubmitNotice('Booked successfully. You will receive updates once approved.');

      if (created) {
        navigate('/PatientAppDetails', { state: { appointment: created } })
        return
      }
    } catch (err) {
      const r = err?.response;
      const msg = r?.status === 409
        ? (r?.data?.message || 'This time slot is not available.')
        : (r?.data?.message || 'Booking failed. Please try again.');
      setSubmitNotice(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleBookNow = () => {
    setConfirmOpen(true);
  }

  return (
   <>
   <div className={`doctor-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <PNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="book-dashboard-main">
        {/* Back Button */}
        <div style={{ padding: '16px 20px', background: '#f5f7fb' }}>
          <button 
            onClick={handleBack}
            className="back-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #D2E0FB 0%, #8EACCD 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#2c3e50',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <FaArrowLeft size={14} />
            <span>Back to List</span>
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
          </div>
        ) : error ? (
          <p style={{ color: 'red', padding: '20px', textAlign: 'center' }}>{error}</p>
          ) : (
          <div className="book-dashboard-grid">
            <section className="book-card doctor-profile">
              <h3 className="doctor-profile-title">Psychiatrist Profile</h3>

              <div className="doctor-profile-top">
                <div className="doctor-profile-row">
                  <img
                    className="doctor-avatar"
                    src={doctor.profileImage || 'https://via.placeholder.com/180'}
                    alt="Doctor"
                  />
                  <div className="doctor-info">
                    <h4 className="bookDoctor-name">{displayName}</h4>
                    <p className="doctor-role">{doctor.specialty}</p>
                    <p className="doctor-fees">₱ {doctor.fees} / session</p>
                  </div>
                </div>
              </div>

            <div className="doctor-profile-bottom">
              <div className="doctor-about">
                <h5>About</h5>
                <p className="doctor-about-text">{doctor.about || '—'}</p>
              </div>

              <div className="doctor-experience">
                <h5>Experience</h5>
                <p className="doctor-experience-text">{Array.isArray(doctor.experience) ? (doctor.experience.filter(Boolean).join('\n')) : (doctor.experience || '—')}</p>
              </div>

              <div className="doctor-specialty">
                <h5>Specialization</h5>
                <p className="doctor-specialty-text">{doctor.specialty || '—'}</p>
              </div>

              <div className="doctor-clinicAddress">
                <h5>Clinic Address</h5>
                <p className="doctor-clinicAddress-text">{doctor.address1 || '—'}</p>
              </div>
              
              <div className="doctor-reviews">
                <h5>Patient Reviews</h5>
                <div className="review-summary">
                  <div className="avg-rating">
                    {avgRating !== null ? avgRating : '—'}
                    {avgRating !== null && <span style={{ marginLeft: 8 }}><StarRating value={avgRating} size={14} /></span>}
                  </div>
                  <div className="rating-meta">({ratingCount} Reviews)</div>
                </div>

                <div className="reviews-list">
                  {reviews.length === 0 ? (
                    <p className="no-reviews">No reviews yet.</p>
                  ) : (
                    (() => {
                      const items = showAllReviews
                        ? reviews
                        : reviews.slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      return items.map(r => (
                        <div key={r.id} className="review-item">
                          <div className="review-avatar" aria-hidden>
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect width="24" height="24" rx="6" fill="currentColor" style={{ opacity: 0.06 }} />
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" fill="currentColor" />
                            </svg>
                          </div>
                          <div className="review-body">
                            <div className="review-head">
                              <div className="review-name">Anonymous Patient</div>
                            </div>
                            <div className="review-rating-row"><StarRating value={r.rating} size={14} /></div>
                            {r.comment && <div className="review-comment">{r.comment}</div>}
                          </div>
                        </div>
                      ))
                    })()
                  )}
                </div>

                {reviews.length > 0 && (
                  <div className="reviews-controls">
                    {!showAllReviews && reviews.length > pageSize && (
                      <button className="reviews-toggle" onClick={() => setShowAllReviews(true)} aria-expanded="false" aria-controls="reviews-list">
                        <span>Show More</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M6 9l6 6 6-6" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    {showAllReviews && (
                      <button className="reviews-toggle" onClick={() => { setShowAllReviews(false); setCurrentPage(1); }} aria-expanded="true" aria-controls="reviews-list">
                        <span>Show Less</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M6 15l6-6 6 6" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

            <aside className="book-card book-grid-calendar" style={{ alignSelf: 'start' }}>
              <h3 style={{ marginTop: 0 }}>Book An Appointment</h3>

           <div className="mb-2">
                <label style={{ display: 'block', marginTop: 6, marginBottom: 6 }}>Select Date</label>
                <CalendarC
                  value={date ? new Date(date) : null}
                  showHeader={false}
                  minDate={todayStart}
                  availableDates={availableDates}
                  onChange={(d) => {
                    if (d === null) {
                      setDate('');
                      return;
                    }
                    const picked = new Date(d);
                    picked.setHours(0,0,0,0);
                    if (picked < todayStart) {
                      setSubmitNotice('You cannot book a past date.');
                      return;
                    }
                    setSubmitNotice('');
                    setDate(toYMD(picked));
                  }}
                />
              </div>

              <div className="mb-2">
                <label style={{ display: 'block', marginTop: 6, marginBottom: 6 }}>Select Time</label>
                {slotsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                    <LifeLine color="#8EACCD" size="small" text="" textColor="" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="no-availability">No availability for this date.</p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 8,
                      width: '100%'
                    }}
                  >
                    {availableSlots.map((t) => {
                      const end = addMinutesHHMM(t, 60);
                      const key = `${t}-${end}`;
                      const label = `${hhmmTo12(t)} - ${hhmmTo12(end)}`;
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`btn ${selectedSlot === t ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ width: '100%' }}
                          onClick={() => setSelectedSlot(t)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mb-2" style={{ marginTop: 12 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>Patient Concerns</label>
                <textarea
                  rows={4}
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  placeholder="Provide details that will help the doctor prepare..."
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="button"
                onClick={handleBookNow}
                disabled={isSubmitting || !selectedSlot || !date || !doctor}
                aria-busy={isSubmitting ? 'true' : 'false'}
                className="btn btn-primary"
                style={{ marginTop: 12 }}
              >
                {isSubmitting ? 'Booking…' : 'Book Now'}
              </button>

              {isSubmitting && (
                <p style={{ marginTop: 8, color: '#666' }}>
                  Submitting your request.
                </p>
              )}
              {submitNotice && (
                <p style={{ marginTop: 8, color: submitNotice.startsWith('Booked') ? 'green' : 'crimson' }}>
                  {submitNotice}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
    <ConfirmDialog
      open={confirmOpen}
      title="Confirm Booking"
      message={(
        <>
          <strong>Book this appointment?</strong>
          <br />{displayName && (<span>Doctor: {displayName}<br/></span>)}
          {date && selectedSlot && (<span>Date: {date} • Time: {selectedSlot}</span>)}
        </>
      )}
      confirmLabel="Book"
      cancelLabel="Cancel"
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => { setConfirmOpen(false); executeBooking(); }}
    />
    </>
  )
}