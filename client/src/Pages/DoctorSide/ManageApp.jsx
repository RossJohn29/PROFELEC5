//ManageApp.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import { LifeLine } from 'react-loading-indicators';
import Navbar from '../../SideBar/Navbar.jsx';
import '../../Styles/ManageApp.css';

export default function ManageApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('active'); // show pending + approved

  // derive filtered list
  const filtered = useMemo(() => {
    if (filter === 'all' || filter === 'active') return appointments;
    return appointments.filter(a => (a.status || '').toLowerCase() === filter);
  }, [appointments, filter]);

  useEffect(() => {
    // Load doctor profile and appointments whenever the filter changes
    let cancelled = false;
  async function load() {
      try {
        setLoading(true);
        setError('');
        const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
        if (!email) { setError('Missing doctor email in localStorage. Please login again.'); setLoading(false); return; }

        const prof = await axios.post(apiUrl('/doctor/get-profile'), { email });
        const d = prof.data?.doctor;
        if (!d) { setError('Doctor profile not found'); setLoading(false); return; }
        if (cancelled) return;
        setDoctor(d);

        // Load active appointments (pending + approved) or by status
        let url;
        if (filter === 'active') {
          url = apiUrl(`/api/doctor/${d._id}/appointments/active`);
        } else if (filter) {
          url = apiUrl(`/api/doctor/${d._id}/appointments?status=${encodeURIComponent(filter)}`);
        } else {
          url = apiUrl(`/api/doctor/${d._id}/appointments`);
        }

        const list = await axios.get(url);
        if (cancelled) return;
        setAppointments(list.data?.appointments || []);
      } catch (e) {
        if (!cancelled) setError('Failed to load appointments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filter]);

  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('theme') || 'light');
    window.addEventListener('storage', handleTheme);
    window.addEventListener('themeChange', handleTheme);
    return () => {
      window.removeEventListener('storage', handleTheme);
      window.removeEventListener('themeChange', handleTheme);
    };
  }, []);

  const updateAppt = async (id, payload) => {
    const prev = [...appointments];
    try {
      // optimistic update
      setAppointments(appts => appts.map(a => a._id === id ? { ...a, ...payload } : a));
  const res = await axios.patch(apiUrl(`/api/appointments/${id}`), payload);
      const updated = res.data?.appointment;
      // In Manage App, keep approved items; only remove when completed or cancelled
      if (updated.status === 'completed' || updated.status === 'cancelled') {
        setAppointments(appts => appts.filter(a => a._id !== id));
      } else {
        setAppointments(appts => appts.map(a => a._id === id ? updated : a));
      }
    } catch (e) {
      setAppointments(prev);
      setError('Update failed');
    }
  };

  const onApprove = (id) => updateAppt(id, { status: 'approved' });
  const onComplete = (id) => updateAppt(id, { status: 'completed' });
  const onCancel = (id) => updateAppt(id, { status: 'cancelled'});

  return (
    <div className={`doctor-page-wrapper manageapp-page ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className={`doctor-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <main className="doctor-main">
          <div className="manageapp-dashboard-main">
            <div className="manageapp-header">
              <h1>Manage Appointments</h1>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
              </div>
            ) : error ? (
              <p style={{ color: 'red' }}>{error}</p>
            ) : filtered.length === 0 ? (
              <div className="card">No appointments to show.</div>
            ) : (
              <div className="appointments-list">
                {filtered.map(appt => {
                  const p = appt.patient || {};
                  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || '—';
                  const when = new Date(appt.date);
                  const dateOnly = when.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  const timeOnly = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  const status = (appt.status || '').toLowerCase();

                  return (
                    <div key={appt._id} className="appointment-item">
                      {/* Column 1: Profile Picture */}
                      <div className="appt-avatar-section">
                        <img
                          src={p.profileImage || 'https://via.placeholder.com/56'}
                          alt="avatar"
                          className="appt-avatar"
                        />
                      </div>

                      {/* Column 2: Patient Info (Name, Email, Date/Time, Notes) */}
                      <div className="appt-info-section">
                        <div className="appt-patient-name">{name}</div>
                        <div className="appt-datetime">
                          {dateOnly} / {timeOnly}
                        </div>
                      </div>

                      {/* Column 3: Status and Actions */}
                      <div className="appt-status-actions">
                        <span className={`appt-status status-${status}`}>
                          {status}
                        </span>
                        <div className="appt-actions">
                          <button
                            className="btn btn-approve"
                            disabled={status !== 'pending'}
                            onClick={() => onApprove(appt._id)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-complete"
                            disabled={status === 'completed' || status === 'cancelled'}
                            onClick={() => onComplete(appt._id)}
                          >
                            Complete
                          </button>
                          <button
                            className="btn btn-cancel"
                            disabled={status === 'completed' || status === 'cancelled'}
                            onClick={() => onCancel(appt._id)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
