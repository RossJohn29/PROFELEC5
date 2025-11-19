//DoctorAppDetails.jsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../../SideBar/Navbar.jsx';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import '../../Styles/PatientAppDetails.css';

export default function DoctorAppDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(location.state?.appointment || null);
  const [error, setError] = useState('');

  const qs = new URLSearchParams(location.search);
  const appointmentId = appointment?._id || location.state?.appointmentId || qs.get('id') || null;

  useEffect(() => {
    let cancelled = false;
    const fetchAppointment = async (id) => {
      try {
        const res = await axios.get(apiUrl(`/api/appointments/${id}`));
        if (cancelled) return;
        if (res.data?.appointment) setAppointment(res.data.appointment);
      } catch (err) {
        if (!cancelled) setError('Failed to load appointment details.');
      }
    };
    // If we have an id, fetch a populated appointment when:
    // - no appointment object yet, OR
    // - doctor field is just an ObjectId string, OR
    // - populated but missing fees
    const needPopulate = !appointment
      || typeof appointment.doctor === 'string'
      || appointment.doctor == null
      || appointment.doctor?.fees == null;
    if (appointmentId && needPopulate) fetchAppointment(appointmentId);
    return () => { cancelled = true; };
  }, [appointmentId, appointment?.doctor]);

  // Enrich missing patient/doctor fields (HMO number, address, fees) if not present in appointment payload
  useEffect(() => {
    let cancelled = false;
    const enrich = async () => {
      try {
        if (!appointment) return;

        // Fetch patient profile if important fields are missing
        const pat = appointment.patient || {};
        const needPatient = !pat?.hmoNumber || !pat?.address || !pat?.contact;
        const patientEmail = pat?.email || appointment.patientEmail || appointment.userEmail || null;
        if (needPatient && patientEmail) {
          try {
            const pres = await axios.post(apiUrl('/patient/get-profile'), { email: patientEmail });
            const p = pres.data?.patient || {};
            if (!cancelled && p) {
              setAppointment(prev => ({
                ...prev,
                patient: { ...(prev?.patient || {}), ...p }
              }));
            }
          } catch {}
        }

        // Fetch doctor profile if fees are missing in appointment.doctor
        const doc = appointment.doctor || {};
        const needDoctor = (doc?.fees == null || doc?.fees === '' || Number.isNaN(doc?.fees));
        const doctorEmail = doc?.email || appointment.doctorEmail || null;
        if (needDoctor && doctorEmail) {
          try {
            const dres = await axios.post(apiUrl('/doctor/get-profile'), { email: doctorEmail });
            const d = dres.data?.doctor || {};
            if (!cancelled && d) {
              setAppointment(prev => ({
                ...prev,
                doctor: { ...(prev?.doctor || {}), ...d }
              }));
            }
          } catch {}
        }
      } catch {}
    };
    enrich();
    return () => { cancelled = true; };
  }, [appointment]);

  // Simple star rating renderer for patient's rating
  const Stars = ({ value = 0, size = 18 }) => {
    const v = Math.max(0, Math.min(5, Number(value) || 0));
    const items = [];
    for (let i = 1; i <= 5; i++) {
      const filled = v >= i;
      const half = !filled && v >= i - 0.5;
      items.push(
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 4 }} aria-hidden="true">
          <defs>
            <linearGradient id={`halfGrad-${i}`} x1="0" x2="1">
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M12 .587l3.668 7.431L23.4 9.748l-5.7 5.556L19.336 23 12 19.771 4.664 23l1.636-7.696-5.7-5.556 7.732-1.73z"
            fill={filled ? '#F59E0B' : (half ? `url(#halfGrad-${i})` : 'none')}
            stroke={filled || half ? '#F59E0B' : '#cbd5e1'} strokeWidth="0.6" />
        </svg>
      );
    }
    return <span aria-label={`Rating: ${v} out of 5`} style={{ display: 'inline-flex', alignItems: 'center' }}>{items}</span>;
  };

  if (!appointment) {
    return (
      <div className="doctor-layout">
        <Navbar />
        <main className="doctor-main">
          <div className="pad-main">
            <p style={{ color: 'crimson' }}>{error || 'No appointment data available.'}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/DoctorLogs?filter=completed')}>Back to Logs</button>
          </div>
        </main>
      </div>
    );
  }

  const doc = appointment.doctor || {};
  const pat = appointment.patient || {};
  const apptDate = appointment.date ? new Date(appointment.date) : null;
  const apptDateStr = apptDate ? apptDate.toLocaleDateString() : '—';
  const apptTimeStr = apptDate ? apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  const prettyStatus = (s) => {
    if (!s) return '—';
    const st = String(s).toLowerCase();
    return st.charAt(0).toUpperCase() + st.slice(1);
  };

  return (
    <div className="doctor-page-wrapper">
      <Navbar />
      <div className="doctor-layout">
        <main className="doctor-main">
          <div className="pad-dashboard-grid">
          {/* Left column: Patient profile (reuse patient side styles) */}
          <section className="card doctor-profile">
            <h3 className="doctor-profile-title">Patient Profile</h3>
            <div className="doctor-profile-top">
              <div className="doctor-profile-row">
                <img className="doctor-avatar" src={pat.profileImage || 'https://via.placeholder.com/180'} alt="Patient" />
                <div className="doctor-info">
                  <h4 className="padDoctor-name">{(pat.firstName || pat.name || '') + (pat.lastName ? ' ' + pat.lastName : '')}</h4>
                  <p className="doctor-role">{pat.gender || '—'}</p>
                  <p className="doctor-fees">{pat.contact || '—'}</p>
                </div>
              </div>
            </div>
            <div className="doctor-profile-bottom">
              <div className="doctor-about">
                <h5>HMO Number</h5>
                <p className="doctor-about-text">{pat.hmoNumber || '—'}</p>
              </div>
              <div className="doctor-experience">
                <h5>Address</h5>
                <p className="doctor-experience-text">{pat.address || '—'}</p>
              </div>
              <div className="doctor-specialty">
                <h5>Email</h5>
                <p className="doctor-specialty-text">{pat.email || '—'}</p>
              </div>
            </div>
          </section>

          {/* Right column: Appointment summary for doctor view */}
          <aside className="card pad-details-right">
            <div className="pad-section">
              <h4>Appointment Summary</h4>
              <div className="two-col">
                <div className="left">
                  <div>Status</div>
                  <div>Patient</div>
                  <div>Date</div>
                  <div>Time</div>
                  <div>Fee</div>
                  <div>Notes</div>
                </div>
                <div className="right">
                  <div>
                    <span className={`appt-status status-${String(appointment.status || '').toLowerCase()}`}>
                      {prettyStatus(appointment.status)}
                    </span>
                  </div>
                  <div>{(pat.firstName || pat.name || '') + (pat.lastName ? ' ' + pat.lastName : '')}</div>
                  <div>{apptDateStr}</div>
                  <div>{apptTimeStr}</div>
                  <div>₱ {appointment.fee ?? doc.fees ?? '—'}</div>
                  <div>{appointment.notes || appointment.note || '—'}</div>
                </div>
              </div>
            </div>

            <div className="pad-section patient-review">
              <h4>Patient Rating</h4>
              {appointment.rating ? (
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Stars value={appointment.rating} />
                  <span style={{ color: '#475569' }}>{Number(appointment.rating).toFixed(1)} / 5</span>
                  {appointment.review ? <div style={{ marginTop: 8, fontWeight: 400, color: '#334155' }}>{appointment.review}</div> : null}
                </div>
              ) : (
                <div className="text-muted">No rating submitted yet.</div>
              )}
            </div>

            <div className="pad-section action-buttons">
              <button className="btn btn-secondary" onClick={() => navigate('/DoctorLogs?filter=completed')}>Back to Logs</button>
            </div>
          </aside>
        </div>
      </main>
      </div>
    </div>
  );
}
