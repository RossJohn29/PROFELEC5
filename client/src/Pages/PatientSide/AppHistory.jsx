// AppHistory.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../api/base';
import * as FaIcons from 'react-icons/fa';
import { LifeLine } from 'react-loading-indicators';
import PNavbar from '../../SideBar/PNavbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../Styles/AppHistory.css';
import { useNavigate } from 'react-router-dom';

export default function AppHistory() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('upcoming'); // upcoming | completed | cancelled
  const [reloadTick, setReloadTick] = useState(0);
  const [compCount, setCompCount] = useState(0);
  const [cancCount, setCancCount] = useState(0);

  const buildBaseParams = () => {
    const patientId = localStorage.getItem('patientId') || localStorage.getItem('userId') || null;
    const email = localStorage.getItem('email') || null;
    if (patientId) return { by: 'id', value: patientId };
    if (email) return { by: 'email', value: email };
    return { by: null, value: null };
  };

  const loadData = async (signal) => {
  const base = apiUrl('/api/appointments');
    const { by, value } = buildBaseParams();
    if (!by || !value) { setError('Missing patient identity. Please login again.'); setAppointments([]); setLoading(false); return; }

    try {
      setLoading(true);
      setError('');

      let url = base;
      const q = new URLSearchParams();
      if (by === 'id') q.set('patientId', value); else q.set('patientEmail', value);

      // Fetch according to filter (server supports comma-separated statuses for generic fetch via /api/appointments)
      if (filter === 'completed' || filter === 'cancelled') {
        q.set('status', filter);
      } else if (filter === 'upcoming') {
        // We'll fetch approved and filter future client-side
        q.set('status', 'approved');
      }
      url += `?${q.toString()}`;

  const res = await fetch(url, { signal });
      const data = await res.json();
      let items = Array.isArray(data?.appointments) ? data.appointments : [];
      if (filter === 'upcoming') {
        const now = Date.now();
        items = items.filter(a => new Date(a.date).getTime() > now);
      }
      setAppointments(items);
    } catch (e) {
      if (signal?.aborted) return;
      setError('Failed to load history.');
      setAppointments([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, reloadTick]);

  // (auto-reload removed as requested)

  // Fetch counts for completed and cancelled separately so counts show regardless of current filter
  useEffect(() => {
    const controller = new AbortController();
    const loadCounts = async () => {
      try {
  const base = apiUrl('/api/appointments');
        const { by, value } = buildBaseParams();
        if (!by || !value) return;
        const q = new URLSearchParams();
        if (by === 'id') q.set('patientId', value); else q.set('patientEmail', value);
        q.set('status', 'completed,cancelled');
        const res = await fetch(`${base}?${q.toString()}`, { signal: controller.signal });
        const data = await res.json();
        const items = Array.isArray(data?.appointments) ? data.appointments : [];
        let c1 = 0, c2 = 0;
        for (const a of items) {
          const s = String(a.status || '').toLowerCase();
          if (s === 'completed') c1++;
          if (s === 'cancelled') c2++;
        }
        setCompCount(c1); setCancCount(c2);
      } catch {}
    };
    loadCounts();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadTick, filter]);

  // Derived lists and counts
  const filtered = useMemo(() => {
    if (filter === 'all' || filter === 'upcoming') return appointments;
    return appointments.filter(a => (a.status || '').toLowerCase() === filter);
  }, [appointments, filter]);

  const counts = useMemo(() => {
    const c = { completed: 0, cancelled: 0 };
    for (const a of appointments) {
      const s = (a.status || '').toLowerCase();
      if (s === 'completed') c.completed++;
      if (s === 'cancelled') c.cancelled++;
    }
    return c;
  }, [appointments]);

  const onDelete = async (id) => {
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return;
  try {
  await fetch(apiUrl(`/api/appointments/${id}`), { method: 'DELETE' });
      setAppointments(list => list.filter(a => a._id !== id));
    } catch (e) {
      setError('Failed to delete log');
    }
  };
  const navigate = useNavigate()

  return (
    <div className="apphistory-page">
      <PNavbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className="apphistory-dashboard-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1>Appointment History</h1>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0 !important', gap: 8, color: '#2c3e50 !important' }}>
            <div className="btn-group" role="group" aria-label="Filter by status">
              <button type="button" className={`btn btn-outline-secondary ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
              <button type="button" className={`btn btn-outline-secondary ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completed ({compCount})</button>
              <button type="button" className={`btn btn-outline-secondary ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>Cancelled ({cancCount})</button>
            </div>
            <button className="btn btn-secondary" onClick={() => setReloadTick(t => t + 1)} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
          </div>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 16 }}>
            {filter === 'upcoming' && 'No upcoming appointments yet.'}
            {filter === 'completed' && 'No completed appointments yet.'}
            {filter === 'cancelled' && 'No cancelled appointments yet.'}
            {filter === 'all' && 'No completed or cancelled appointments yet.'}
          </div>
        ) : (
          <div className="appointments-list">
            {filtered.map(appt => {
              const d = appt.doctor || {};
              const name = `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.name || '—';
              const when = new Date(appt.date);
              const dateOnly = when.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
              const timeOnly = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              const status = (appt.status || '').toLowerCase();
              const isLog = status === 'completed' || status === 'cancelled';
              
              const handleOpen = () => navigate('/PatientAppDetails', { state: { appointmentId: appt._id, appointment: appt } });
              const onKeyDown = (e) => { 
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpen();
                }
              };

              return (
                <div
                  className="appt-item"
                  key={appt._id}
                  role="button"
                  tabIndex={0}
                  onClick={handleOpen}
                  onKeyDown={onKeyDown}
                >
                  <div className="appt-left">
                    <img className="appt-avatar" src={d.profileImage || 'https://via.placeholder.com/56'} alt="avatar" />
                  </div>

                  <div className="appt-center">
                    <div className="doctor-name">{name}</div>
                    <div className="appt-datetime">{dateOnly} / {timeOnly}</div>
                  </div>

                  <div className="appt-right">
                    <div className={`appt-status status-${status}`}>{status.toUpperCase()}</div>
                    {isLog && (
                      <button 
                        className="btn btn-outline-danger btn-sm delete-btn" 
                        title="Delete log" 
                        onClick={(e) => { e.stopPropagation(); onDelete(appt._id); }}
                      >
                        <FaIcons.FaTrashAlt />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
