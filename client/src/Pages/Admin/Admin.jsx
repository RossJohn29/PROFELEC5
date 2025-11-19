import React, { useEffect, useState, useMemo } from "react";
import { apiUrl } from '../../api/base';
import * as FaIcons from 'react-icons/fa';
import { LifeLine } from 'react-loading-indicators';
import "../../Styles/Admin.css";

export default function Admin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  
  const [busy, setBusy] = useState({});
  const [status, setStatus] = useState('pending');

  // Navigation state for sections
  const [activeSection, setActiveSection] = useState('licenses');

  // Announcements state
  const [anns, setAnns] = useState([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annForm, setAnnForm] = useState({ title: '', message: '', audience: 'all' });

  // Simple in-app toast message
  const [toast, setToast] = useState(null);

  // Admin dark mode (independent from patient/doctor theme)
  const [adminDark, setAdminDark] = useState(() => {
    return localStorage.getItem('adminDarkMode') === 'true';
  });

  // sound support
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioCtx, setAudioCtx] = useState(null);

  const toggleAdminDark = () => {
    const next = !adminDark;
    setAdminDark(next);
    localStorage.setItem('adminDarkMode', next.toString());
  };

  const toggleSound = async () => {
    try {
      const next = !soundEnabled;
      if (next && !audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        if (ctx.state === 'suspended') await ctx.resume();
        setAudioCtx(ctx);
      }
      setSoundEnabled(next);
      localStorage.setItem('adminNotifSound', next ? 'on' : 'off');
    } catch {}
  };

  const playSound = async () => {
    try {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const ctx = audioCtx;
      const t0 = ctx.currentTime + 0.01;

      const master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, t0);
      filter.Q.value = 0.7;
      filter.connect(master);

      const ping = (start, baseFreq, dur, level = 1) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc2.detune.value = +8; // subtle shimmer

        // gentle upward pitch glide
        osc1.frequency.setValueAtTime(baseFreq, start);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.06, start + dur * 0.6);
        osc2.frequency.setValueAtTime(baseFreq, start);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.06, start + dur * 0.6);

        // percussive envelope
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.4 * level, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc1.connect(g);
        osc2.connect(g);
        g.connect(filter);

        osc1.start(start);
        osc2.start(start);
        osc1.stop(start + dur + 0.02);
        osc2.stop(start + dur + 0.02);
      };

      // two-note “pop/ding”
      ping(t0, 740, 0.12, 0.9);     // lower blip
      ping(t0 + 0.06, 1240, 0.18);  // higher chime

      setTimeout(() => {
        try { filter.disconnect(); master.disconnect(); } catch {}
      }, 400);
    } catch {}
  };

  useEffect(() => {
    return () => {
      try { audioCtx?.close(); } catch {}
    };
  }, [audioCtx]);

  // Remove any patient/doctor theme classes on mount/unmount to prevent bleed
  useEffect(() => {
    document.documentElement.classList.remove('theme-dark');
    document.body.classList.remove('theme-dark', 'patient-page', 'with-sidebar-open', 'with-sidebar-collapsed');
    return () => {
      document.documentElement.classList.remove('theme-dark');
      document.body.classList.remove('theme-dark');
    };
  }, []);

  // Apply full-page background for admin dark mode so body area outside .page also turns dark
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const darkBg = '#2C3E50';
    if (adminDark) {
      document.body.style.backgroundColor = darkBg;
      document.documentElement.style.backgroundColor = darkBg;
      // make sure page spacing doesn't show the underlying light bg
      document.body.style.minHeight = '100vh';
    } else {
      document.body.style.backgroundColor = prevBodyBg || '';
      document.documentElement.style.backgroundColor = prevHtmlBg || '';
      document.body.style.minHeight = '';
    }
    return () => {
      try { document.body.style.backgroundColor = prevBodyBg || ''; } catch {};
      try { document.documentElement.style.backgroundColor = prevHtmlBg || ''; } catch {};
      try { document.body.style.minHeight = ''; } catch {};
    };
  }, [adminDark]);
  // --- end sound support ---

  const fetchRequests = async (which = status) => {
    try {
      setLoading(true);
      setErr("");
      const s = typeof which === 'string' ? which : status; // guard against event object
  const res = await fetch(apiUrl(`/api/license-requests?status=${s}`));
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Failed to load");
      setRequests(data.requests || []);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setAnnLoading(true);
      const res = await fetch(apiUrl('/api/announcements?limit=200&active=true'));
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load announcements');
      setAnns(data.announcements || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAnnLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(status);
  }, [status]);

  useEffect(() => { fetchAnnouncements(); }, []);

  // Subscribe to server-sent events for new pending requests
  useEffect(() => {
    // pick up persisted preference
    setSoundEnabled((localStorage.getItem('adminNotifSound') ?? 'on') === 'on');
    const unlock = async () => { try { if (audioCtx) await audioCtx.resume(); } catch {} };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => { try { window.removeEventListener('pointerdown', unlock); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
  const es = new EventSource(apiUrl('/api/license-requests/stream'));
      const onNew = async (e) => {
        try {
          const data = JSON.parse(e.data || '{}');

          // sound first (if enabled)
          if (soundEnabled) await playSound();

          if (window.Notification && Notification.permission === 'granted') {
            new Notification('New license request', {
              body: `${data.licenseNumber} • ${data.doctorEmail}`
            });
          } else {
            setToast({ message: `New license request: ${data.licenseNumber} • ${data.doctorEmail}` });
            setTimeout(() => setToast(null), 6000);
          }
          fetchRequests('pending');
        } catch {}
      };
      es.addEventListener('license_request_pending', onNew);
      es.onerror = () => { /* let browser auto-reconnect */ };
      return () => {
        es.removeEventListener('license_request_pending', onNew);
        es.close();
      };
    } catch {}
  }, [soundEnabled]); // re-bind if sound toggle changes

  const pendingCount = useMemo(() => requests.length, [requests]);

  const actOnRequest = async (id, status, licenseNumber) => {
    const verb = status === "approved" ? "Approve" : "Reject";
    const extra = status === 'approved' ? "\n\nNote: This will revoke any other approved license for this doctor." : "";
    if (!window.confirm(`${verb} license ${licenseNumber}?${extra}`)) return;

    try {
      setBusy((b) => ({ ...b, [id]: true }));
      const res = await fetch(apiUrl(`/api/license-requests/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Action failed");
      if (data.autoRevoked) {
        console.info(`Auto-revoked ${data.autoRevoked} previous approved license(s).`);
      }
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      alert(e.message || "Action failed");
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[id];
        return n;
      });
    }
  };

  const deleteRequest = async (id, licenseNumber) => {
    if (!window.confirm(`Delete license request ${licenseNumber}? This cannot be undone.`)) return;
    try {
      setBusy((b) => ({ ...b, [id]: true }));
      const res = await fetch(apiUrl(`/api/license-requests/${id}`), {
        method: 'DELETE'
      });
        const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Unexpected response (status ${res.status})`);
      }
      if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Delete failed');
      setRequests((prev) => prev.filter((r) => r._id !== id));
      setToast({ message: `Deleted ${licenseNumber}` });
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      const msg = e?.message || 'Delete failed';
      alert(msg);
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[id];
        return n;
      });
    }
  };

  return (
    <div className={`page admin-page ${adminDark ? 'admin-dark' : ''}`}>
      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: 16,
            top: 16,
            background: '#1f2937',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            zIndex: 1000,
            maxWidth: 360
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Notification</span>
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: 'transparent',
                color: 'white',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 14 }}>{toast.message}</div>
        </div>
      )}

      {/* Navigation Sidebar */}
      <aside className="admin-sidebar">
        <nav className="sidebar-nav">
          <button
            className={`nav-btn ${activeSection === 'licenses' ? 'active' : ''}`}
            onClick={() => setActiveSection('licenses')}
          >
            <FaIcons.FaFileAlt />
            <span>License Requests</span>
          </button>
          <button
            className={`nav-btn ${activeSection === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveSection('announcements')}
          >
            <FaIcons.FaBullhorn />
            <span>Announcements</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        {activeSection === 'licenses' && (
          <>
            <header className="page-header">
              <h1 className="page-title">Manage License Requests</h1>
              <div className="header-actions">
                <div className="btn-group" role="group" aria-label="License filters">
                  <button
                    className={`btn ${status === 'pending' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setStatus('pending')}
                    disabled={loading}
                  >
                    Pending
                  </button>
                  <button
                    className={`btn ${status === 'approved' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setStatus('approved')}
                    disabled={loading}
                  >
                    Approved
                  </button>
                  <button
                    className={`btn ${status === 'rejected' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setStatus('rejected')}
                    disabled={loading}
                  >
                    Rejected
                  </button>
                </div>
                <button className="btn btn-primary" onClick={() => fetchRequests()} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
                <div
                  className="admin-theme-toggle"
                  onClick={toggleAdminDark}
                  title={adminDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  role="button"
                  aria-label="Toggle admin dark mode"
                >
                  {adminDark ? <FaIcons.FaSun /> : <FaIcons.FaMoon />}
                </div>
                <div
                  className={`sound-toggle ${soundEnabled ? 'active' : ''}`}
                  onClick={toggleSound}
                  title={soundEnabled ? 'Notification sound: On' : 'Notification sound: Off'}
                  role="button"
                  aria-label="Toggle notification sound"
                >
                  <FaIcons.FaBell />
                </div>
              </div>
            </header>

      {err && (
        <div role="alert" className="alert error">
          {err}
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title" style={{ textTransform: 'capitalize' }}>{status}</h2>
        </div>

        <div className="table-wrap">
          <table className="table" role="table" aria-label="Pending license requests">
            <thead>
              <tr>
                <th>#</th>
                <th>Doctor Email</th>
                <th>License Number</th>
                <th>Submitted</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="center muted">
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                      <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
                    </div>
                  </td>
                </tr>
              )}

              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="center muted empty">
                    No {status} requests.
                  </td>
                </tr>
              )}

              {!loading &&
                requests.map((r, idx) => (
                  <tr key={r._id}>
                    <td>{idx + 1}</td>
                    <td className="truncate" title={r.doctorEmail}>{r.doctorEmail}</td>
                    <td className="mono">{r.licenseNumber}</td>
                    <td title={new Date(r.createdAt).toLocaleString()}>
                      {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="col-actions">
                      {(status === 'pending' || status === 'rejected') && (
                        <button
                          className="btn btn-approve"
                          onClick={() => actOnRequest(r._id, "approved", r.licenseNumber)}
                          disabled={!!busy[r._id]}
                          aria-label={`Approve ${r.licenseNumber}`}
                        >
                          {busy[r._id] ? "…" : "Approve"}
                        </button>
                      )}
                      {(status === 'pending' || status === 'approved') && (
                        <button
                          className="btn btn-reject"
                          onClick={() => actOnRequest(r._id, "rejected", r.licenseNumber)}
                          disabled={!!busy[r._id]}
                          aria-label={`Reject ${r.licenseNumber}`}
                        >
                          {busy[r._id] ? "…" : "Reject"}
                        </button>
                      )}
                      {(status === 'approved' || status === 'rejected') && (
                        <button
                          className="btn btn-trash"
                          onClick={() => deleteRequest(r._id, r.licenseNumber)}
                          disabled={!!busy[r._id]}
                          aria-label={`Delete ${r.licenseNumber}`}
                          title="Delete request"
                          style={{ marginLeft: 8 }}
                        >
                          <FaIcons.FaTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
          </>
        )}

        {activeSection === 'announcements' && (
          <>
            <header className="page-header">
              <h1 className="page-title">Manage Announcements</h1>
              <div className="header-actions">
                <div
                  className="admin-theme-toggle"
                  onClick={toggleAdminDark}
                  title={adminDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  role="button"
                  aria-label="Toggle admin dark mode"
                >
                  {adminDark ? <FaIcons.FaSun /> : <FaIcons.FaMoon />}
                </div>
              </div>
            </header>

      {/* Announcements management */}
      <section className="card">
        <div className="card-head" style={{ alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2 className="card-title">Create New Announcement</h2>
        </div>

        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 160px 120px', gap: 12, alignItems: 'start', marginBottom: 16, padding: '16px' }}>
          <input
            type="text"
            placeholder="Title"
            value={annForm.title}
            onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
          />
          <textarea
            placeholder="Message"
            rows={2}
            value={annForm.message}
            onChange={(e) => setAnnForm({ ...annForm, message: e.target.value })}
          />
          <select value={annForm.audience} onChange={(e) => setAnnForm({ ...annForm, audience: e.target.value })}>
            <option value="all">All Users</option>
            <option value="patient">Patients Only</option>
            <option value="doctor">Doctors Only</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!annForm.title.trim() || !annForm.message.trim()) { alert('Please enter a title and message.'); return; }
              try {
                const res = await fetch(apiUrl('/api/announcements'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(annForm) });
                const data = await res.json();
                if (data.status !== 'success') throw new Error(data.message || 'Failed to create');
                setAnnForm({ title: '', message: '', audience: annForm.audience });
                fetchAnnouncements();
              } catch (e) {
                alert(e.message || 'Failed to create announcement');
              }
            }}
          >
            Publish
          </button>
        </div>

        <div className="table-wrap">
          <table className="table" role="table" aria-label="Announcements">
            <thead>
              <tr>
                <th>Title</th>
                <th>Audience</th>
                <th>Published</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {annLoading && (
                <tr>
                  <td colSpan={4} className="center muted">Loading…</td>
                </tr>
              )}
              {!annLoading && anns.length === 0 && (
                <tr>
                  <td colSpan={4} className="center muted empty">No announcements yet.</td>
                </tr>
              )}
              {!annLoading && anns.map((a) => (
                <tr key={a._id}>
                  <td className="truncate" title={a.message}>{a.title}</td>
                  <td style={{ textTransform: 'capitalize' }}>{a.audience}</td>
                  <td title={new Date(a.createdAt).toLocaleString()}>{new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString()}</td>
                  <td className="col-actions">
                    <button className="btn btn-reject" onClick={async () => {
                      const confirmMsg = `Are you sure you want to delete this announcement?\n\nTitle: ${a.title}\nAudience: ${a.audience}\n\nThis action cannot be undone and will remove the announcement for all users.`;
                      if (!window.confirm(confirmMsg)) return;
                      try {
                        const res = await fetch(apiUrl(`/api/announcements/${a._id}`), { method: 'DELETE' });
                        const data = await res.json();
                        if (data.status !== 'success') throw new Error(data.message || 'Delete failed');
                        setAnns(prev => prev.filter(x => x._id !== a._id));
                      } catch (e) {
                        alert(e.message || 'Delete failed');
                      }
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
          </>
        )}
      </main>
    </div>
  );
}