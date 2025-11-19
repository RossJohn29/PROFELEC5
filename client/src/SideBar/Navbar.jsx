// Navbar Doctor
import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api/base';
import { useLocation } from 'react-router-dom';
import * as FaIcons from 'react-icons/fa';
import * as IoIcons from 'react-icons/io';
import { Link, useNavigate } from 'react-router-dom';
import '../Styles/DNavbar.css';
import '../Styles/Announcements.css';
import { SidebarData } from './Sidebar.jsx';

export default function Navbar(props) {
  // Default collapsed (icon-only) for desktop like patient sidebar
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false));
  const isControlled = ('isOpen' in (props || {})) && typeof props.onToggle === 'function';
  const open = isControlled ? props.isOpen : internalOpen;
  const location = useLocation();
  const isDoctorDashboard = location.pathname === '/dashboard';
  const navigate = useNavigate();

  // notifications state (new booking)
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [openDrop, setOpenDrop] = useState(false);
  
  // announcements state
  const [anns, setAnns] = useState([]);
  const [annUnread, setAnnUnread] = useState(0);
  const [openAnnDrop, setOpenAnnDrop] = useState(false);
  
  const [tab, setTab] = useState('visible'); // 'visible' | 'hidden'
  const [profilePic, setProfilePic] = useState(null);
  const lastNavRef = useRef(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const esRef = useRef(null);
  const backoffRef = useRef(2000);
  const reconnectTimerRef = useRef(null);
  const pendingSoundRef = useRef(false);

  // sound
  const [audioCtx, setAudioCtx] = useState(null);
  const initAudio = async () => {
    if (audioCtx) return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      setAudioCtx(ctx);
      return ctx;
    } catch { return null; }
  };
  const playChime = async () => {
    // respect settings from localStorage
    const muted = (localStorage.getItem('notifMuted') ?? 'off') === 'on';
    const soundOn = (localStorage.getItem('notifSound') ?? 'on') === 'on';
    if (muted || !soundOn) return;
    try {
      const ctx = await initAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();
      const t0 = ctx.currentTime + 0.01;
      const master = ctx.createGain();
      master.gain.value = 0.6; master.connect(ctx.destination);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2200; filter.Q.value = 0.7; filter.connect(master);
      const ping = (start, base, dur, level = 1) => {
        const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator(); const g = ctx.createGain();
        o1.type = 'sine'; o2.type = 'sine'; o2.detune.value = 8;
        o1.frequency.setValueAtTime(base, start); o1.frequency.exponentialRampToValueAtTime(base * 1.06, start + dur * 0.6);
        o2.frequency.setValueAtTime(base, start); o2.frequency.exponentialRampToValueAtTime(base * 1.06, start + dur * 0.6);
        g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(0.4 * level, start + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o1.connect(g); o2.connect(g); g.connect(filter);
        o1.start(start); o2.start(start); o1.stop(start + dur + 0.02); o2.stop(start + dur + 0.02);
      };
      ping(t0, 740, 0.12, 0.9); ping(t0 + 0.06, 1240, 0.18);
      setTimeout(() => { try { filter.disconnect(); master.disconnect(); } catch { } }, 400);
    } catch { }
  };

  // Resilient SSE for new appointments (booked by patient)
  useEffect(() => {
    let cancelled = false;
    let doctorId = null;
    const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
    if (!email) return;

    const cleanup = () => { try { esRef.current && esRef.current.close(); } catch {} esRef.current = null; };

    const startSSE = async () => {
      if (cancelled) return;
      try {
        // get doctor id if unknown
        if (!doctorId) {
          const prof = await fetch(apiUrl('/doctor/get-profile'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
          const data = await prof.json();
          doctorId = data?.doctor?._id || null;
          const pic = data?.doctor?.profilePicture || data?.doctor?.profileImage || null;
          if (pic) setProfilePic(pic);
          await loadNotifs(doctorId);
        }
        cleanup();
        const es = new EventSource(apiUrl('/api/appointments/stream'));
        esRef.current = es;
        const onBooked = async (e) => {
          try {
            const payload = JSON.parse(e.data || '{}');
            if (!payload?.doctorId || !doctorId || String(payload.doctorId) !== String(doctorId)) return;
            const id = payload.notifId || payload.apptId || Math.random().toString(36).slice(2);
            setNotifs((prev) => {
              const exists = prev.some(p => p.id === id);
              const next = [{ id, text: `New appointment from ${payload.patient?.name || payload.patient?.email || 'a patient'}`, at: new Date(payload.date || Date.now()).toLocaleString(), apptId: payload.apptId, read: false }, ...prev];
              return exists ? prev : next.slice(0, 50);
            });
            setUnread((n) => n + 1);
            try {
              await playChime();
            } catch {
              pendingSoundRef.current = true;
            }
          } catch { }
        };
        const onAnnouncement = async (e) => {
          try {
            const payload = JSON.parse(e.data || '{}');
            if (payload.audience && payload.audience !== 'all' && payload.audience !== 'doctor') return;
            await loadAnns();
            try {
              await playChime();
            } catch {
              pendingSoundRef.current = true;
            }
          } catch { }
        };
        es.addEventListener('appointment_booked', onBooked);
        es.addEventListener('announcement_created', onAnnouncement);
        es.onopen = () => { backoffRef.current = 2000; };
        es.onerror = () => {
          cleanup();
          if (cancelled) return;
          const wait = backoffRef.current;
          backoffRef.current = Math.min(wait * 1.5, 20000);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(startSSE, wait);
        };
      } catch {
        if (cancelled) return;
        const wait = backoffRef.current;
        backoffRef.current = Math.min(wait * 1.5, 20000);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(startSSE, wait);
      }
    };

    startSSE();

    const onVisible = () => { if (!document.hidden) { backoffRef.current = 2000; startSSE(); } };
    const onOnline = () => { backoffRef.current = 2000; startSSE(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      cleanup();
    };
  }, []);

  useEffect(() => {
    // track viewport to toggle mobile behaviors
    const mq = window.matchMedia('(max-width: 768px)');
    const handle = () => setIsMobile(mq.matches);
    try { mq.addEventListener('change', handle); } catch { mq.addListener(handle); }
    handle();
    return () => { try { mq.removeEventListener('change', handle); } catch { mq.removeListener(handle); } };
  }, []);

  useEffect(() => {
    const unlock = async () => { try { const ctx = await initAudio(); await ctx?.resume(); } catch { } };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => { try { window.removeEventListener('pointerdown', unlock); } catch { } };
  }, []);

  // If a notification arrived before audio unlock, play pending sound on first interaction
  useEffect(() => {
    const onFirst = async () => {
      try {
        const ctx = await initAudio(); await ctx?.resume();
        if (pendingSoundRef.current) { pendingSoundRef.current = false; await playChime(); }
      } catch {}
    };
    window.addEventListener('pointerdown', onFirst, { once: true });
    return () => { try { window.removeEventListener('pointerdown', onFirst); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotifs = async (doctorIdParam) => {
    try {
      const id = doctorIdParam || (await (async () => {
        const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
        const prof = await fetch(apiUrl('/doctor/get-profile'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        const data = await prof.json();
        return data?.doctor?._id;
      })());
      if (!id) return;
      const res = await fetch(apiUrl(`/api/notifications?userType=doctor&userId=${id}&limit=50&view=visible`));
      const j = await res.json();
      if (Array.isArray(j?.notifications)) {
        const items = j.notifications.map(n => ({ id: n._id, text: n.text, at: new Date(n.createdAt || Date.now()).toLocaleString(), apptId: n.apptId, read: !!n.read }));
        setNotifs(items);
        setUnread(items.filter(i => !i.read).length);
      }
    } catch { }
  };

  const patchNotif = async (id, updates) => {
    try {
      await fetch(apiUrl(`/api/notifications/${id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    } catch { }
  };
  const deleteNotif = async (id) => {
    try { await fetch(apiUrl(`/api/notifications/${id}`), { method: 'DELETE' }); } catch { }
  };
  const markAllRead = async () => {
    try {
      const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
      const prof = await fetch(apiUrl('/doctor/get-profile'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await prof.json(); const doctorId = data?.doctor?._id;
      if (!doctorId) return;
      await fetch(apiUrl('/api/notifications/mark-all-read'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userType: 'doctor', userId: doctorId }) });
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch { }
  };

  // Announcements functions
  const loadAnns = async () => {
    try {
      const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
      const prof = await fetch(apiUrl('/doctor/get-profile'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await prof.json();
      const doctorId = data?.doctor?._id;
      
      const res = await fetch(apiUrl(`/api/announcements/feed?userType=doctor&userId=${doctorId || ''}&limit=50&view=visible`));
      const j = await res.json();
      if (Array.isArray(j?.announcements)) {
        const items = j.announcements.map(a => ({ id: a._id, title: a.title, message: a.message, audience: a.audience, at: new Date(a.createdAt || Date.now()).toLocaleString(), read: !!a.read, muted: !!a.muted }));
        setAnns(items);
        const unreadCount = items.filter(i => !i.read).length;
        setAnnUnread(unreadCount);
        console.log('[Announcements] Loaded:', items.length, 'Unread:', unreadCount);
      }
    } catch {}
  };

  const patchAnn = async (id, updates) => {
    try {
      const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
      const prof = await fetch(apiUrl('/doctor/get-profile'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await prof.json(); const doctorId = data?.doctor?._id;
      await fetch(apiUrl(`/api/announcements/${id}/state`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userType: 'doctor', userId: doctorId, ...updates }) });
    } catch {}
  };

  const markAllAnnsRead = async () => {
    try {
      const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
      const prof = await fetch(apiUrl('/doctor/get-profile'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await prof.json(); const doctorId = data?.doctor?._id;
      await fetch(apiUrl('/api/announcements/mark-all-read'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userType: 'doctor', userId: doctorId }) });
      setAnns(prev => prev.map(a => ({ ...a, read: true })));
      setAnnUnread(0);
    } catch {}
  };

  useEffect(() => { loadAnns(); }, []);

  const toggle = () => {
    if (isControlled) {
      props.onToggle(!open);
    } else {
      setInternalOpen(!open);
    }
  };

  // Shift only the top navbar when sidebar is open (avoid double-shift of page content)
  useEffect(() => {
    if (open) document.body.classList.add('doctor-topbar-open');
    else document.body.classList.remove('doctor-topbar-open');
    return () => document.body.classList.remove('doctor-topbar-open');
  }, [open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownOpen && !e.target.closest('.topbar-profile-wrapper')) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [profileDropdownOpen]);

  // Doctor pages manage layout shift via their own container classes, not body padding

  return (
    <>
      {/* Top Navigation Bar */}
      <div className={`top-navbar ${open ? 'sidebar-is-open' : 'sidebar-is-collapsed'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Hamburger to toggle sidebar (desktop slims; mobile overlay) */}
          <button
            type="button"
            className={`hamburger-btn ${open ? 'open' : 'collapsed'}`}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={toggle}
          >
            <FaIcons.FaBars />
          </button>
          {isDoctorDashboard && <h2 className="navbar-title" style={{ margin: 20 }}></h2>}
        </div>
        <div className="nav-icons">
          <div className="nav-megaphone" onClick={() => { setOpenAnnDrop(o => !o); setOpenDrop(false); }} title="Announcements" role="button" aria-label="Announcements">
            <FaIcons.FaBullhorn size={22} />
            {annUnread > 0 && <span className="ann-badge" aria-label={`${annUnread} unread`}>{annUnread > 9 ? '9+' : annUnread}</span>}
          </div>
          <div className="nav-bell" onClick={() => { setOpenDrop((o) => !o); setUnread(0); setOpenAnnDrop(false); }} title="Notifications" role="button" aria-label="Notifications">
            <IoIcons.IoMdNotificationsOutline size={24} />
            {unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
          </div>
          {/* Top-right profile like patient */}
          <div className="topbar-profile-wrapper">
            <button
              className="topbar-profile-btn"
              onClick={() => setProfileDropdownOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={profileDropdownOpen}
              title="Account"
            >
              <div className="topbar-avatar" aria-hidden>
                {profilePic ? <img src={profilePic} alt="Profile" /> : <FaIcons.FaUser />}
              </div>
              <FaIcons.FaChevronDown className="caret" />
            </button>
            <div className={`topbar-profile-dropdown ${profileDropdownOpen ? 'show' : ''}`} role="menu">
              <Link to="/DSettings" className="dropdown-item" onClick={() => setProfileDropdownOpen(false)}>
                <FaIcons.FaCog />
                <span>Settings</span>
              </Link>
              <button
                className="dropdown-item logout-btn"
                onClick={() => {
                  try {
                    localStorage.removeItem('email');
                    localStorage.removeItem('doctorEmail');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('patientId');
                    localStorage.removeItem('role');
                    localStorage.removeItem('name');
                  } catch { }
                  window.location.href = '/login';
                }}
              >
                <FaIcons.FaSignOutAlt />
                <span>Logout</span>
              </button>
            </div>
          </div>
          {openDrop && (
            <div className="notif-dropdown" onMouseLeave={() => setOpenDrop(false)}>
              <div className="notif-head">
                <div className="notif-head-title">
                  <IoIcons.IoMdNotifications size={20} />
                  <span>Notifications</span>
                </div>
                {notifs.length > 0 && <button onClick={markAllRead} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>Mark All As Read</button>}
              </div>
              {notifs.length === 0 ? (
                <div className="notif-empty">
                  <div className="notif-empty-icon">🔔</div>
                  <div>No notifications yet</div>
                </div>
              ) : (
                <>
                  <ul className="notif-list">
                    {notifs.map(n => (
                      <li key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                        <div className="notif-text" onClick={async () => { if (!n.read) { setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setUnread(u => Math.max(0, u - 1)); await patchNotif(n.id, { read: true }); } setOpenDrop(false); navigate('/Appointments'); }}>{n.text}</div>
                        <div className="notif-time">🕛 {n.at}</div>
                        <div className="notif-actions">
                          <button className="link-btn" title={n.read ? 'Mark as unread' : 'Mark as read'} onClick={async () => { setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: !n.read } : x)); setUnread(u => n.read ? u + 1 : Math.max(0, u - 1)); await patchNotif(n.id, { read: !n.read }); }}>
                            {n.read ? <FaIcons.FaEnvelopeOpen /> : <FaIcons.FaEnvelope />}
                          </button>
                          <button className="link-btn" title="Delete" onClick={async () => { setNotifs(prev => prev.filter(x => x.id !== n.id)); if (!n.read) setUnread(u => Math.max(0, u - 1)); await deleteNotif(n.id); }}>
                            <FaIcons.FaTrashAlt />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {openAnnDrop && (
            <div className="ann-dropdown" onMouseLeave={() => setOpenAnnDrop(false)}>
              <div className="ann-head">
                <div className="ann-head-title">
                  <FaIcons.FaBullhorn />
                  <span>Announcements</span>
                </div>
                {anns.length > 0 && <button onClick={markAllAnnsRead} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Mark All As Read</button>}
              </div>
              {anns.length === 0 ? (
                <div className="ann-empty">
                  <div className="ann-empty-icon">📣</div>
                  <div>No announcements yet</div>
                </div>
              ) : (
                <ul className="ann-list">
                  {anns.map(a => (
                    <li key={a.id} className={`ann-item ${a.read ? '' : 'unread'}`}>
                      <div className="ann-title">{a.title} <span className="aud-tag">{a.audience === 'doctor' ? 'Doctors' : a.audience === 'patient' ? 'Patients' : 'All'}</span></div>
                      <div className="ann-message">{a.message}</div>
                      <div className="ann-time">🕒 {a.at}</div>
                      <div className="ann-actions">
                        <button className="ann-btn" title={a.read ? 'Mark as unread' : 'Mark as read'} onClick={async () => { setAnns(prev => prev.map(x => x.id === a.id ? { ...x, read: !a.read } : x)); setAnnUnread(u => a.read ? u + 1 : Math.max(0, u - 1)); await patchAnn(a.id, { read: !a.read }); }}>
                          {a.read ? <FaIcons.FaEnvelopeOpen /> : <FaIcons.FaEnvelope />}
                        </button>
                        <button className="ann-btn" title="Delete" onClick={async () => { 
                          if (!window.confirm(`Delete this announcement?\n\n${a.title}\n\nThis will hide it from your view.`)) return;
                          setAnns(prev => prev.filter(x => x.id !== a.id)); 
                          if (!a.read) setAnnUnread(u => Math.max(0, u - 1)); 
                          await patchAnn(a.id, { hidden: true }); 
                        }}>
                          <FaIcons.FaTrashAlt />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

  <nav className={`sidebar ${open ? 'mobile-open' : 'collapsed mobile-hidden'}`}>
        <div className="sidebar-header">
          <div className="doctor-sidebar-brand" title="Menu">
          </div>
        </div>
        <ul className="sidebar-list">
          {SidebarData
            .filter(i => !['About', 'Logout', 'Settings', 'Account Profile'].includes(i.title))
            .map((item, index) => {
              const isActive = location.pathname === item.path;
              const guardedClick = (e) => {
                const now = Date.now();
                if (now - lastNavRef.current < 200) {
                  e.preventDefault();
                  return;
                }
                lastNavRef.current = now;
                // Do not auto-expand collapsed sidebar on desktop; only hamburger controls expansion
                if (isMobile && open) toggle(); // close overlay after navigation on mobile
              };
              return (
                <li key={index} className={`sidebar-item ${isActive ? 'active' : ''}`}>
                  <Link to={item.path} title={item.title} aria-label={item.title} className={isActive ? 'active' : ''} onClick={guardedClick}>
                    {item.icon}
                    <span className="label">{item.title}</span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>

      {/* Backdrop for mobile when sidebar open */}
      {open && isMobile && (
        <div className="sidebar-backdrop" onClick={() => toggle()} aria-label="Close sidebar" />
      )}
    </>
  );
}