//Ddashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import { LifeLine } from 'react-loading-indicators';
import Navbar from '../../SideBar/Navbar.jsx';
import CalendarC from '../../Calendar/CalendarC.jsx';
import '../../Styles/Ddashboard.css';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { FaUserFriends, FaClock, FaCheckCircle, FaClipboardCheck } from 'react-icons/fa';

export default function Ddashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // doctor-scoped metrics
  const [totalPatients, setTotalPatients] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  // cancelled metric for charts
  const [cancelledCount, setCancelledCount] = useState(0);

  const [recentPatients, setRecentPatients] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [error, setError] = useState('');

  // trend data for last 14 days
  const [trend, setTrend] = useState([]);

  // selected date and appointment logs for per-day agenda
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [apptLogs, setApptLogs] = useState([]);

  const [activeAppts, setActiveAppts] = useState([])

  // helpers
  const toYMD = (d) => {
    const _d = new Date(d);
    const y = _d.getFullYear();
    const m = String(_d.getMonth() + 1).padStart(2, '0');
    const day = String(_d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        setError('');
        setRecentLoading(true);

        // Resolve current doctor by email from localStorage
        const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
        if (!email) {
          setError('Missing doctor email. Please login again.');
          setRecentLoading(false);
          return;
        }

    // Get doctor profile -> id
  const prof = await axios.post(apiUrl('/doctor/get-profile'), { email }, { signal: controller.signal });
        const doctor = prof.data?.doctor;
        if (!doctor?._id) {
          setError('Doctor profile not found.');
          setRecentLoading(false);
          return;
        }
        const doctorId = doctor._id;

        // Fetch doctor-scoped metrics, recent patients, and logs for charts
        const [countRes, statsRes, recentRes, logsRes, activeRes] = await Promise.all([
          axios.get(apiUrl(`/api/doctor/${doctorId}/patients/count`), { signal: controller.signal }),
          axios.get(apiUrl(`/api/doctor/${doctorId}/stats`), { signal: controller.signal }),
          axios.get(apiUrl('/api/patients/recent'), { params: { doctorId, limit: 6 }, signal: controller.signal }),
          axios.get(apiUrl(`/api/doctor/${doctorId}/appointments/logs`), { signal: controller.signal }),
          axios.get(apiUrl(`/api/doctor/${doctorId}/appointments/active`), { signal: controller.signal }),
        ]);

        if (cancelled) return;

        // Unique patients seen by this doctor (any status)
        setTotalPatients(countRes.data?.count || 0);

        // Appointments stats scoped to this doctor
        setUpcomingCount(statsRes.data?.upcoming || 0);
        setPendingCount(statsRes.data?.pending || 0);
        setCompletedCount(statsRes.data?.completed || 0);

        // Recent patients from completed appointments
        if (recentRes.data?.status === 'success' && Array.isArray(recentRes.data.patients)) {
          const mapped = recentRes.data.patients.map(p => ({
            id: p.patientId || p._id || p.id,
            name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || p.email || p.patientEmail || 'Patient',
            email: p.email || p.patientEmail || p.userEmail || '',
            profilePicture: p.profileImage || p.profilePicture || p.avatar || null
          }));
          setRecentPatients(mapped);
          // Enrich missing avatars by fetching patient profile
          try {
            const toFetch = mapped.filter(x => !x.profilePicture && x.email);
            if (toFetch.length > 0) {
              const results = await Promise.allSettled(toFetch.map(x => axios.post(apiUrl('/patient/get-profile'), { email: x.email }, { signal: controller.signal })));
              if (!cancelled) {
                const enriched = [...mapped];
                results.forEach((res, idx) => {
                  if (res.status === 'fulfilled') {
                    const pic = res.value?.data?.patient?.profileImage || res.value?.data?.patient?.profilePicture;
                    if (pic) {
                      const email = toFetch[idx].email;
                      const i = enriched.findIndex(e => e.email === email);
                      if (i >= 0) enriched[i] = { ...enriched[i], profilePicture: pic };
                    }
                  }
                });
                setRecentPatients(enriched);
              }
            }
          } catch {}
        } else {
          setRecentPatients([]);
        }

        // Logs for charts (completed + cancelled)
        const logs = Array.isArray(logsRes.data?.appointments) ? logsRes.data.appointments : [];
        const cancelledOnly = logs.filter(a => (a.status || '').toLowerCase() === 'cancelled');
        setCancelledCount(cancelledOnly.length);
        // keep logs for agenda
        setApptLogs(logs);

        // Active appointments (pending/approved) for schedule under calendar
        const active = Array.isArray(activeRes.data?.appointments) ? activeRes.data.appointments : [];
        setActiveAppts(active);

        // Build 14-day trend: counts per date for completed and cancelled
        const days = [];
        const map = {};
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = toYMD(d);
          days.push(key);
          map[key] = { date: key, completed: 0, cancelled: 0 };
        }
        for (const a of logs) {
          const key = toYMD(a.date || a.createdAt || Date.now());
          if (map[key]) {
            const s = (a.status || '').toLowerCase();
            if (s === 'completed') map[key].completed++;
            if (s === 'cancelled') map[key].cancelled++;
          }
        }
        setTrend(days.map(d => map[d]));
      } catch (e) {
        if (controller.signal.aborted || cancelled) return;
        setError('Failed to load dashboard data.');
        setRecentPatients([]);
        setTotalPatients(0);
        setUpcomingCount(0);
        setPendingCount(0);
        setCompletedCount(0);
        setCancelledCount(0);
        setTrend([]);
        setApptLogs([]);
        setActiveAppts([]);
      } finally {
        if (!cancelled && !controller.signal.aborted) setRecentLoading(false);
      }
    }

    load();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Pie data (Recharts expects an array, not labels/datasets)
  const pieData = useMemo(() => ([
    { name: 'Pending', value: Number(pendingCount) || 0 },
    { name: 'Approved', value: Number(upcomingCount) || 0 },
    { name: 'Completed', value: Number(completedCount) || 0 },
    { name: 'Cancelled', value: Number(cancelledCount) || 0 },
  ]), [pendingCount, upcomingCount, completedCount, cancelledCount]);

  const PIE_COLORS = ['#dd9b29ff', '#3b82f6', '#10b981', '#ef4444'];

  // Format date tick as M/D
  const shortMD = (ymd) => {
    try {
      const [y, m, d] = ymd.split('-').map(Number);
      return `${m}/${d}`;
    } catch { return ymd; }
  };

  // Helpers for agenda display
  const prettyLongDate = (ymd) => {
    try {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return ymd; }
  };

  const extractStart = (a) => {
    // Try several common shapes
    return (
      a.startTime ||
      a.timeStart ||
      a.start ||
      a.slotStart ||
      a.time ||
      a.date ||
      a.createdAt
    );
  };

  const extractEnd = (a) => a.endTime || a.timeEnd || a.end || a.slotEnd || null;

  const fmtTime = (v) => {
    if (!v) return null;
    const dt = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)
      ? new Date(v)
      : new Date(v);
    if (isNaN(dt)) return null;
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatRange = (a) => {
    const s = fmtTime(extractStart(a));
    const e = fmtTime(extractEnd(a));
    if (s && e) return `${s} - ${e}`;
    if (s) return s;
    return 'All day';
  };

  const todayYMD = toYMD(new Date());
  const nowMs = Date.now();

  const upcomingActive = useMemo(() => {
    const items = Array.isArray(activeAppts) ? activeAppts : [];
    return items.filter(a => {
      const start = extractStart(a);
      const dt = new Date(start);
      if (isNaN(dt)) return false;
      const ymd = toYMD(dt);
      // exclude past dates
      if (ymd < todayYMD) return false;
      // for today, exclude past times
      if (ymd === todayYMD && dt.getTime() < nowMs) return false;
      return true;
    });
  }, [activeAppts]);

  const selectedUpcoming = useMemo(() => {
    const withStartMs = (a) => {
      const s = extractStart(a);
      const t = new Date(s).getTime();
      return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    return upcomingActive
      .filter(a => toYMD(extractStart(a)) === selectedDate || toYMD(a.date || a.createdAt) === selectedDate)
      .sort((a, b) => withStartMs(a) - withStartMs(b));
  }, [upcomingActive, selectedDate]);

  const otherUpcomingGroups = useMemo(() => {
    const map = new Map();
    for (const a of upcomingActive) {
      const ymd = toYMD(a.date || extractStart(a));
      if (ymd === selectedDate) continue;
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd).push(a);
    }
    // sort each group by time
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ta = new Date(extractStart(a)).getTime();
        const tb = new Date(extractStart(b)).getTime();
        return ta - tb;
      });
    }
    // return sorted by date ascending
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, items]) => ({ date, items }));
  }, [upcomingActive, selectedDate]);

  // Dates to highlight in the calendar: only upcoming/active (pending/approved),
  // completed/cancelled will NOT be highlighted so dots disappear once done.
  const markedDates = useMemo(() => {
    const set = new Set();
    const add = (d) => {
      try {
        const ymd = toYMD(d);
        if (ymd) set.add(ymd);
      } catch {}
    };
    (activeAppts || []).forEach(a => add(a.date || extractStart(a) || a.createdAt));
    return Array.from(set);
  }, [activeAppts]);

  // Agenda for the selected day
  const agenda = useMemo(() => {
    const sameDay = (a) => toYMD(a.date || a.startTime || a.timeStart || a.createdAt) === selectedDate;
    const withStartMs = (a) => {
      const s = extractStart(a);
      const t = new Date(s).getTime();
      return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    return (apptLogs || [])
      .filter(sameDay)
      .sort((a, b) => withStartMs(a) - withStartMs(b));
  }, [apptLogs, selectedDate]);

  return (
    <div className="doctor-page-wrapper">
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className={`dashboard ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <main className="doctor-dashboard-main">
          {error && <div className="card" style={{ padding: 12, color: 'red', marginBottom: 12 }}>{error}</div>}

          <div className="dashboard-grid">
            {/* Grid 1: Welcome box, Dashboard Cards, and Charts */}
            <section className="grid-one">
              {/* Welcome Box */}
              <div className="doctor-welcome-box">
                <h1>Welcome to Your Dashboard!</h1>
                <p className="lead">Manage your appointments and patients efficiently.</p>
              </div>

              {/* Cards */}
              <div className="cards-section">
                <div className="dashboard-cards">
                  <div className="card stat-card">
                    <div className="stat-icon">
                      <FaUserFriends />
                    </div>
                    <h4 className="stat-title">Total Patients</h4>
                    <p className="stat-value">{totalPatients}</p>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-icon">
                      <FaClock />
                    </div>
                    <h4 className="stat-title">Pending</h4>
                    <p className="stat-value">{pendingCount}</p>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-icon">
                      <FaCheckCircle />
                    </div>
                    <h4 className="stat-title">Approved</h4>
                    <p className="stat-value">{upcomingCount}</p>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-icon">
                      <FaClipboardCheck />
                    </div>
                    <h4 className="stat-title">Completed</h4>
                    <p className="stat-value">{completedCount}</p>
                  </div>
                </div>
              </div>

              {/* Charts row */}
              <div className="charts-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 12, minHeight: 320 }}>
                <h3 style={{ margin: '4px 0 8px' }}>Status Breakdown</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card" style={{ padding: 12, minHeight: 320 }}>
                <h3 style={{ margin: '4px 0 8px' }}>Last 14 Days</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={shortMD} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(v) => `Date: ${v}`} />
                    <Legend />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </div>
            </section>

            {/* Grid 2: Calendar and Schedule Card */}
            <section className="grid-two">
              <div className="calendar-section">
                {/* Bind to selectedDate using CalendarC's props */}
                <CalendarC
                  value={new Date(selectedDate)}
                  onChange={(d) => {
                    if (!d) return;
                    const dt = d instanceof Date ? d : new Date(d);
                    setSelectedDate(toYMD(dt));
                  }}
                  markedDates={markedDates}
                />
              </div>

              {/* Upcoming-only schedule */}
              <div className="schedule-card">
                <div className="schedule-header">
                  <h4>Schedule</h4>
                  <span className="schedule-date">{prettyLongDate(selectedDate)}</span>
                </div>

                <div className="schedule-section">
                  <h5>Selected Date</h5>
                  {selectedUpcoming.length === 0 ? (
                    <div className="schedule-empty">No upcoming appointments for this day.</div>
                  ) : (
                    <ul className="schedule-list">
                      {selectedUpcoming.map((a, i) => {
                        const label = a.title || a.reason || a.purpose || 'Appointment';
                        const who = a.patient?.name || `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`.trim() || a.patient?.email || '';
                        const status = (a.status || '').toLowerCase();
                        const statusClass = `status-badge status-${status}`;
                        return (
                          <li key={a._id || i} className="schedule-item">
                            <div className="schedule-item-title">{formatRange(a)} - {label}{who ? ` (${who})` : ''}</div>
                            <span className={statusClass}>{status}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="schedule-section">
                  <h5>Other Upcoming Dates</h5>
                  {otherUpcomingGroups.length === 0 ? (
                    <div className="schedule-empty">No other upcoming appointments.</div>
                  ) : (
                    otherUpcomingGroups.map(group => (
                      <div key={group.date} className="schedule-group">
                        <div className="schedule-group-date">{prettyLongDate(group.date)}</div>
                        <ul className="schedule-group-list">
                          {group.items.map((a, i) => {
                            const label = a.title || a.reason || a.purpose || 'Appointment';
                            const who = a.patient?.name || `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`.trim() || a.patient?.email || '';
                            const status = (a.status || '').toLowerCase();
                            const statusClass = `status-badge status-${status}`;
                            return (
                              <li key={(a._id || '') + i} className="schedule-group-item">
                                <div>{formatRange(a)} - {label}{who ? ` (${who})` : ''}</div>
                                <span className={statusClass}>{status}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Grid 3: Previous Patients */}
            <section className="grid-three">
              <div className="recent-patients-section">
                <div className="section-header">
                  <h3>Previous Patients</h3>
                  <span className="section-subtitle">Recent consultations</span>
                </div>

                {recentLoading ? (
                  <div className="card" style={{ padding: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
                  </div>
                ) : recentPatients.length === 0 ? (
                  <div className="card" style={{ padding: 16 }}>No previous patients yet.</div>
                ) : (
                  <div className="patient-grid">
                    {recentPatients.map((p) => (
                      <div key={p.id || p.email} className="patient-card">
                        <div className="avatar-skeleton">
                          <img src={p.profilePicture || 'https://via.placeholder.com/128?text=Avatar'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                        </div>
                        <div className="patient-meta">
                          <h5 className="patient-name">{p.name}</h5>
                          <div className="patient-actions">
                            <button className="btn btn-secondary" onClick={() => navigate(`/DoctorLogs?filter=completed${p.email ? `&patientEmail=${encodeURIComponent(p.email)}` : ''}`)}>History</button>
                            <button
                              className="btn btn-primary"
                              onClick={() => navigate(`/Doctor/Patient/${encodeURIComponent(p.email)}`)}
                              disabled={!p.email}
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
