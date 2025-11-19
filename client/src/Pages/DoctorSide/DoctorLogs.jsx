//DoctorLogs.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import axios from 'axios';
import apiUrl from '../../api/base';
import { LifeLine } from 'react-loading-indicators';
import Navbar from '../../SideBar/Navbar.jsx';
import '../../Styles/DoctorLogs.css';

export default function DoctorLogs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // status filter
  const [statusFilter, setStatusFilter] = useState('all'); // all | completed | cancelled
  const [patientEmail, setPatientEmail] = useState('');
  
  const onDelete = async (id) => {
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return;
    try {
      await fetch(apiUrl(`/api/appointments/${id}`), { method: 'DELETE' });
      setLogs(list => list.filter(a => a._id !== id));
    } catch (e) {
      setError('Failed to delete log');
    }
  };

  // Initialize statusFilter from query (?filter=completed) or state
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const q = (params.get('filter') || '').toLowerCase();
      if (q === 'completed' || q === 'cancelled' || q === 'all') setStatusFilter(q);
      const pe = params.get('patientEmail') || '';
      if (pe) setPatientEmail(pe);
      else if (location.state && typeof location.state.filter === 'string') {
        const s = location.state.filter.toLowerCase();
        if (s === 'completed' || s === 'cancelled' || s === 'all') setStatusFilter(s);
      }
    } catch {}
    // run only on mount and when search changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const loadLogs = async (signal) => {
    try {
      setLoading(true);
      setError('');

      const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
      if (!email) {
        setError('Missing doctor email. Please login again.');
        setLoading(false);
        return;
      }

  const prof = await axios.post(apiUrl('/doctor/get-profile'), { email }, { signal });
      const d = prof.data?.doctor;
      if (!d?._id) {
        setError('Doctor profile not found.');
        setLoading(false);
        return;
      }

  const res = await axios.get(apiUrl(`/api/doctor/${d._id}/appointments/logs`), { signal });
      setLogs(Array.isArray(res.data?.appointments) ? res.data.appointments : []);
    } catch (e) {
      if (signal?.aborted) return;
      setError('Failed to load booking logs.');
      setLogs([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadLogs(controller.signal);
    return () => controller.abort();
  }, []);

  // (auto-reload removed as requested)

  // Auto-refresh on appointment events (SSE)
  useEffect(() => {
  const es = new EventSource(apiUrl('/api/appointments/stream'));
    let refreshTimer = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return; 
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        loadLogs();
      }, 1000);
    };
    const onBooked = () => scheduleRefresh();
    const onStatus = () => scheduleRefresh();
    es.addEventListener('appointment_booked', onBooked);
    es.addEventListener('appointment_status', onStatus);
    // heartbeat isn't needed but keeps connection alive
    es.addEventListener('ping', () => {});
    return () => {
      es.close();
      if (refreshTimer) clearTimeout(refreshTimer);
    };

  }, []);

  // Derived list based on status filter
  const filteredLogs = useMemo(() => {
    let out = logs;
    if (statusFilter !== 'all') {
      out = out.filter(a => (a.status || '').toLowerCase() === statusFilter);
    }
    if (patientEmail) {
      const pe = String(patientEmail).toLowerCase();
      const getEmail = (a) => (a.patient?.email || a.patientEmail || a.email || '').toLowerCase();
      out = out.filter(a => getEmail(a) === pe);
    }
    return out;
  }, [logs, statusFilter, patientEmail]);

  const counts = useMemo(() => {
    const c = { completed: 0, cancelled: 0 };
    for (const a of logs) {
      const s = (a.status || '').toLowerCase();
      if (s === 'completed') c.completed++;
      if (s === 'cancelled') c.cancelled++;
    }
    return c;
  }, [logs]);

  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('theme') || 'light');
    window.addEventListener('storage', handleTheme);
    window.addEventListener('themeChange', handleTheme);
    return () => {
      window.removeEventListener('storage', handleTheme);
      window.removeEventListener('themeChange', handleTheme);
    };
  }, []);

  return (
    <div className={`doctor-page-wrapper doctorlogs-page ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className={`doctor-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <main className="doctor-main">
          <div className="logs-dashboard-main">
          <div className="doctorlogs-header">
            <h1>Booking Logs</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Filter buttons */}
              <div className="btn-group" role="group" aria-label="Filter by status">
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${statusFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('completed')}
                >
                  Completed ({counts.completed})
                </button>
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${statusFilter === 'cancelled' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('cancelled')}
                >
                  Cancelled ({counts.cancelled})
                </button>
              </div>

              <button className="btn btn-secondary" onClick={() => loadLogs()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
            </div>
          ) : error ? (
            <p style={{ color: 'red' }}>{error}</p>
          ) : filteredLogs.length === 0 ? (
            <div className="card">
              {statusFilter === 'completed' && 'No completed appointments yet.'}
              {statusFilter === 'cancelled' && 'No cancelled appointments yet.'}
              {statusFilter === 'all' && 'No completed or cancelled appointments yet.'}
            </div>
          ) : (
            <div className="logs-list">
              {filteredLogs.map(appt => {
                const p = appt.patient || {};
                const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || '—';
                const when = new Date(appt.date);
                const dateOnly = when.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const timeOnly = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const status = (appt.status || '').toLowerCase();
                const isCompleted = status === 'completed';
                const rating = appt.rating || 0;

                return (
                  <div
                    key={appt._id}
                    className="log-item"
                    onClick={() => { if (isCompleted) navigate('/DoctorAppDetails', { state: { appointmentId: appt._id, appointment: appt } }); }}
                  >
                    {/* Profile Picture */}
                    <div className="log-avatar-section">
                      <img
                        src={p.profileImage || 'https://via.placeholder.com/56'}
                        alt="avatar"
                        className="log-avatar"
                      />
                    </div>

                    {/* Patient Info (Name and Date/Time) */}
                    <div className="log-info-section">
                      <div className="log-patient-name">
                        {name}
                      </div>
                      <div className="log-datetime">
                        {dateOnly} / {timeOnly}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="log-status-section">
                      <span className={`log-status status-${status}`}>
                        {status}
                      </span>
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