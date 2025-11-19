//Psettings.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import { LifeLine } from 'react-loading-indicators';
import Navbar from '../../SideBar/PNavbar.jsx';
import '../../Styles/Ddashboard.css';
import '../../Styles/PSettings.css';
import '../../Styles/PatientProfile.css';
import PasswordInput from '../../components/PasswordInput';

function PSettings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('profile'); // profile | settings
  const [sections, setSections] = useState({ appearance: false, password: false, notifications: false });

  // profile state (read-only view)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState(null);
  const [preview, setPreview] = useState('');
  const [hmoPreview, setHmoPreview] = useState('');
  
  // profile picture editing state
  const [profilePicEditing, setProfilePicEditing] = useState(false);
  const profilePicOriginalRef = useRef('');

  // inline edit states (bring PatientProfile editing into Settings)
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [contactEditing, setContactEditing] = useState(false);
  const [contactForm, setContactForm] = useState(null);
  const [savingContact, setSavingContact] = useState(false);

  const [emergencyEditing, setEmergencyEditing] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState(null);
  const [savingEmergency, setSavingEmergency] = useState(false);

  const [hmoEditing, setHmoEditing] = useState(false);
  const [hmoForm, setHmoForm] = useState({ hmoNumber: '', hmoCardImage: '' });
  const [savingHmo, setSavingHmo] = useState(false);
  const hmoOriginalRef = useRef('');

  const [medEditing, setMedEditing] = useState(false);
  const [medForm, setMedForm] = useState({ medicalHistory: '' });
  const [savingMed, setSavingMed] = useState(false);

  // phone helpers
  const COUNTRY_CODES = [ 
    { code: '+63', label: '🇵🇭 Philippines (+63)' } 
  ];
  const LOCAL_MAX = 10;
  const [countryCode, setCountryCode] = useState('+63');
  const [localNumber, setLocalNumber] = useState('');
  const [emergencyCountryCode, setEmergencyCountryCode] = useState('+63');
  const [emergencyLocalNumber, setEmergencyLocalNumber] = useState('');

  // theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdBusy, setPwdBusy] = useState(false);

  // notifications prefs
  const [notifMuted, setNotifMuted] = useState(() => (localStorage.getItem('notifMuted') ?? 'off') === 'on');
  const [notifSound, setNotifSound] = useState(() => (localStorage.getItem('notifSound') ?? 'on') === 'on');

  const doLogout = () => {
    try {
      // Clear common auth/session keys
      localStorage.removeItem('email');
      localStorage.removeItem('doctorEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('patientId');
      localStorage.removeItem('role');
      localStorage.removeItem('name');
    } catch {}
    // Use lowercase path to match router
    window.location.href = '/login';
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const loadProfile = async () => {
      const email = localStorage.getItem('email');
      
      console.log('[PSettings] Starting profile load, email:', email);
      
      if (!email) {
        console.error('[PSettings] No email found in localStorage');
        if (isMounted) {
          setError('Missing email. Please login again.');
          setLoading(false);
        }
        return;
      }
      
      if (isMounted) {
        setLoading(true);
        setError('');
      }
      
      try {
        console.log('[PSettings] Making API request to:', apiUrl('/patient/get-profile'));
        
        const res = await axios.post(
          apiUrl('/patient/get-profile'), 
          { email }, 
          { 
            signal: controller.signal,
            timeout: 15000, // 15 second timeout
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('[PSettings] API Response received:', {
          status: res.status,
          hasData: !!res.data,
          hasPatient: !!res.data?.patient
        });
        
        if (!isMounted) {
          console.log('[PSettings] Component unmounted, ignoring response');
          return;
        }
        
        const p = res.data?.patient;
        if (!p) {
          console.warn('[PSettings] No patient data in response:', res.data);
          setError('No profile found. You can complete it via Edit Profile.');
          setLoading(false);
          return;
        }
        
        console.log('[PSettings] Patient data loaded successfully:', {
          email: p.email,
          firstName: p.firstName,
          lastName: p.lastName,
          hasContact: !!p.contact,
          hasEmergencyContact: !!p.emergencyContact
        });
        
        setPatient(p);
        setPreview(p.profileImage || '');
        setHmoPreview(p.hmoCardImage || '');
        
        // Parse contact phone number with error handling
        try {
          const contactStr = String(p.contact || '');
          console.log('[PSettings] Parsing contact:', contactStr);
          const m = contactStr.match(/^(\+\d{1,4})\s*(.*)$/);
          if (m) { 
            setCountryCode(m[1]); 
            setLocalNumber(((m[2] || '').replace(/\D/g, '')).slice(0, LOCAL_MAX)); 
          } else { 
            setCountryCode('+63'); 
            setLocalNumber(contactStr.replace(/\D/g, '').slice(0, LOCAL_MAX)); 
          }
        } catch (err) { 
          console.error('[PSettings] Error parsing contact:', err);
          setCountryCode('+63'); 
          setLocalNumber(''); 
        }
        
        // Parse emergency contact phone number with error handling
        try {
          const emergencyStr = String(p.emergencyContact || '');
          console.log('[PSettings] Parsing emergency contact:', emergencyStr);
          const m = emergencyStr.match(/^(\+\d{1,4})\s*(.*)$/);
          if (m) { 
            setEmergencyCountryCode(m[1]); 
            setEmergencyLocalNumber(((m[2] || '').replace(/\D/g, '')).slice(0, LOCAL_MAX)); 
          } else { 
            setEmergencyCountryCode('+63'); 
            setEmergencyLocalNumber(emergencyStr.replace(/\D/g, '').slice(0, LOCAL_MAX)); 
          }
        } catch (err) { 
          console.error('[PSettings] Error parsing emergency contact:', err);
          setEmergencyCountryCode('+63'); 
          setEmergencyLocalNumber(''); 
        }
        
        setLoading(false);
        
      } catch (e) { 
        if (!isMounted) {
          console.log('[PSettings] Component unmounted during error handling');
          return;
        }
        
        if (axios.isCancel(e) || controller.signal.aborted) {
          console.log('[PSettings] Request aborted (component unmounted)');
          return;
        }
        
        console.error('[PSettings] Failed to load profile:', {
          message: e.message,
          code: e.code,
          response: e.response?.data,
          status: e.response?.status,
          isAxiosError: e.isAxiosError,
          config: {
            url: e.config?.url,
            method: e.config?.method,
            timeout: e.config?.timeout
          }
        });
        
        let errorMessage = 'Failed to load profile.';
        
        if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
          errorMessage = 'Request timeout. Please check your connection and try again.';
        } else if (e.code === 'ERR_NETWORK' || e.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Cannot reach server. Please check your internet connection.';
        } else if (e.code === 'ERR_CANCELED') {
          errorMessage = 'Request was canceled. Please try again.';
        } else if (e.response) {
          // Server responded with error
          const statusCode = e.response.status;
          const serverMsg = e.response.data?.message || e.response.data?.error || e.response.statusText;
          errorMessage = `Server error (${statusCode}): ${serverMsg}`;
        } else if (e.request) {
          // Request made but no response
          errorMessage = 'No response from server. The server may be down or unreachable.';
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };
    
    // Small delay to prevent race conditions with other requests
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        loadProfile();
      }
    }, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      console.log('[PSettings] Cleaning up, aborting request');
      controller.abort();
    };
  }, []); // Empty dependency array - only run once on mount

  // theme side-effect (match doctor settings behavior)
  useEffect(() => {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    localStorage.setItem('theme', theme);
    try { window.dispatchEvent(new Event('themeChange')); } catch {}
  }, [theme]);

  // keep theme in sync if toggled elsewhere
  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('theme') || 'light');
    window.addEventListener('storage', handleTheme);
    window.addEventListener('themeChange', handleTheme);
    return () => {
      window.removeEventListener('storage', handleTheme);
      window.removeEventListener('themeChange', handleTheme);
    };
  }, []);

  const formatDate = (d) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return '';
    }
  };

  // compute age from birthday
  const computeAge = (dateStr) => {
    if (!dateStr) return '';
    try {
      const today = new Date();
      const birthDate = new Date(dateStr);
      if (isNaN(birthDate.getTime())) return '';
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? String(age) : '0';
    } catch { return ''; }
  };

  // image handlers
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const startProfilePicEdit = () => {
    profilePicOriginalRef.current = preview || patient?.profileImage || '';
    setProfilePicEditing(true);
  };

  const cancelProfilePicEdit = () => {
    setPreview(profilePicOriginalRef.current);
    setProfilePicEditing(false);
  };

  const handleSavePhoto = async () => {
    if (!patient?.email) return;
    try {
      const res = await axios.post(apiUrl('/patient/profile'), { email: patient.email, profileImage: preview || '' });
      
      // Update patient state with the new profile image
      if (res.data && res.data.patient) {
        setPatient(res.data.patient);
        setPreview(res.data.patient.profileImage || preview);
      }
      
      profilePicOriginalRef.current = preview;
      setProfilePicEditing(false);
      setPwdMsg('Profile picture saved');
      setPwdErr('');
    } catch (err) {
      console.error('Save photo error:', err);
      setPwdErr('Failed to save picture');
    }
  };

  // profile info edit handlers
  const startEdit = () => {
    if (!patient) return;
    setEditForm({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      birthday: patient.birthday ? new Date(patient.birthday).toISOString().slice(0,10) : '',
      age: patient.age || '',
      gender: patient.gender || ''
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'birthday') next.age = computeAge(value);
      return next;
    });
  };

  const handleSaveProfile = async () => {
    if (!patient?.email || !editForm) return;
    setSavingProfile(true);
    setPwdMsg(''); setPwdErr('');
    try {
      const payload = { email: patient.email, ...editForm };
      const res = await axios.post(apiUrl('/patient/profile'), payload);
      if (res.data && res.data.patient) {
        const p = res.data.patient;
        setPatient(p);
        setPreview(p.profileImage || preview);
        setHmoPreview(p.hmoCardImage || hmoPreview);
        setEditing(false);
        setEditForm(null);
        setPwdMsg('Profile saved successfully');
      } else {
        setPwdErr('Failed to save profile');
      }
    } catch (err) {
      setPwdErr('Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // contact info edit handlers
  const startContactEdit = () => {
    if (!patient) return;
    setContactForm({
      email: patient.email || '',
      contact: patient.contact || '',
      address: patient.address || ''
    });
    setContactEditing(true);
  };

  const cancelContactEdit = () => {
    setContactEditing(false);
    setContactForm(null);
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveContact = async () => {
    if (!patient?.email || !contactForm) return;
    setSavingContact(true);
    setPwdMsg(''); setPwdErr('');
    try {
      const fullContact = `${countryCode} ${localNumber}`.trim();
      const payload = { email: patient.email, contact: fullContact, address: contactForm.address };
      const res = await axios.post(apiUrl('/patient/profile'), payload);
      if (res.data && res.data.patient) {
        const p = res.data.patient;
        setPatient(p);
        setPreview(p.profileImage || preview);
        setHmoPreview(p.hmoCardImage || hmoPreview);
        setContactEditing(false);
        setContactForm(null);
        setPwdMsg('Contact information saved successfully');
      } else {
        setPwdErr('Failed to save contact information');
      }
    } catch (err) {
      setPwdErr('Failed to save contact information');
    } finally {
      setSavingContact(false);
    }
  };

  // emergency contact edit handlers
  const startEmergencyEdit = () => {
    if (!patient) return;
    setEmergencyForm({
      emergencyName: patient.emergencyName || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyAddress: patient.emergencyAddress || ''
    });
    setEmergencyEditing(true);
  };

  const cancelEmergencyEdit = () => {
    setEmergencyEditing(false);
    setEmergencyForm(null);
  };

  const handleEmergencyChange = (e) => {
    const { name, value } = e.target;
    setEmergencyForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEmergency = async () => {
    if (!patient?.email || !emergencyForm) return;
    setSavingEmergency(true);
    setPwdMsg(''); setPwdErr('');
    try {
      const fullEmergencyContact = `${emergencyCountryCode} ${emergencyLocalNumber}`.trim();
      const payload = { email: patient.email, emergencyName: emergencyForm.emergencyName, emergencyContact: fullEmergencyContact, emergencyAddress: emergencyForm.emergencyAddress };
      const res = await axios.post(apiUrl('/patient/profile'), payload);
      if (res.data && res.data.patient) {
        const p = res.data.patient;
        setPatient(p);
        setPreview(p.profileImage || preview);
        setHmoPreview(p.hmoCardImage || hmoPreview);
        setEmergencyEditing(false);
        setEmergencyForm(null);
        setPwdMsg('Emergency contact saved successfully');
      } else {
        setPwdErr('Failed to save emergency contact');
      }
    } catch (err) {
      setPwdErr('Failed to save emergency contact');
    } finally {
      setSavingEmergency(false);
    }
  };

  // HMO edit handlers
  const handleHmoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setHmoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const startHmoEdit = () => {
    if (!patient) return;
    hmoOriginalRef.current = hmoPreview || patient.hmoCardImage || '';
    setHmoForm({ hmoNumber: patient.hmoNumber || '', hmoCardImage: patient.hmoCardImage || hmoOriginalRef.current });
    setHmoEditing(true);
  };

  const cancelHmoEdit = () => {
    setHmoEditing(false);
    setHmoPreview(hmoOriginalRef.current || '');
    setHmoForm({ hmoNumber: '', hmoCardImage: '' });
  };

  const handleHmoChange = (e) => {
    const { name, value } = e.target;
    setHmoForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveHmo = async () => {
    if (!patient?.email) return;
    setSavingHmo(true);
    setPwdMsg(''); setPwdErr('');
    try {
      const payload = { email: patient.email, hmoNumber: hmoForm.hmoNumber, hmoCardImage: hmoPreview || hmoForm.hmoCardImage || '' };
  const res = await axios.post(apiUrl('/patient/profile'), payload);
      if (res.data && res.data.patient) {
        const p = res.data.patient;
        setPatient(p);
        const newPreview = p.hmoCardImage || hmoPreview;
        setHmoPreview(newPreview);
        hmoOriginalRef.current = newPreview;
        setHmoEditing(false);
        setHmoForm({ hmoNumber: '', hmoCardImage: '' });
        setPwdMsg('HMO info saved');
      } else {
        setPwdErr('Failed to save HMO info');
      }
    } catch (err) {
      setPwdErr('Failed to save HMO info');
    } finally {
      setSavingHmo(false);
    }
  };

  // Medical history edit handlers
  const startMedEdit = () => {
    if (!patient) return;
    setMedForm({ medicalHistory: patient.medicalHistory || '' });
    setMedEditing(true);
  };

  const cancelMedEdit = () => {
    setMedEditing(false);
    setMedForm({ medicalHistory: '' });
  };

  const handleMedChange = (e) => {
    const { name, value } = e.target;
    setMedForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveMed = async () => {
    if (!patient?.email) return;
    setSavingMed(true);
    setPwdMsg(''); setPwdErr('');
    try {
      const payload = { email: patient.email, medicalHistory: medForm.medicalHistory };
  const res = await axios.post(apiUrl('/patient/profile'), payload);
      if (res.data && res.data.patient) {
        setPatient(res.data.patient);
        setMedEditing(false);
        setMedForm({ medicalHistory: '' });
        setPwdMsg('Medical history saved');
      } else {
        setPwdErr('Failed to save medical history');
      }
    } catch (err) {
      setPwdErr('Failed to save medical history');
    } finally {
      setSavingMed(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');
    if (!pwdForm.next || pwdForm.next !== pwdForm.confirm) {
      setPwdErr('New password and confirm do not match.');
      return;
    }
    try {
      setPwdBusy(true);
      const email = localStorage.getItem('email');
      const res = await fetch(apiUrl('/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword: pwdForm.current, newPassword: pwdForm.next })
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json().catch(() => ({}));
      if (data.status === 'success') setPwdMsg('Password updated successfully.');
      else setPwdErr(data.message || 'Unable to change password.');
    } catch (e) {
      setPwdErr('Change-password API not available. Use Forgot Password instead.');
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <div className={`psettings-dashboard ${theme === 'dark' ? 'theme-dark' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className="psettings-dashboard-main">
        <div style={{ padding: '20px !important' }}></div>
        <div className="settings-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', marginBottom: '20px', marginTop: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>Settings</h2>
            
            {/* Profile/Preferences tabs moved to top right */}
            <div style={{ 
              display: 'flex',
              gap: '8px'
            }}>
              {[
                { key: 'profile', label: 'Profile' },
                { key: 'settings', label: 'Preferences' }
              ].map(({ key, label }) => (
                <button 
                  key={key} 
                  className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setTab(key)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    transition: 'all 0.3s ease',
                    transform: tab === key ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: tab === key ? '0 4px 12px rgba(142,172,205,0.25)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

        {tab === 'profile' && (
          <>
            <hr className="settings-divider" />
            <section style={{ padding: 0 }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
                </div>
              ) : error ? (
                <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
              ) : !patient ? (
                <div style={{ marginTop: 8 }}>No profile yet. Please complete your profile.</div>
              ) : (
                <div className="patient-profile-container" style={{ marginTop: 0 }}>
                  {/* profile picture */}
                  <div className="profile-box profile-image-box">
                    <div className="profile-picture-container">
                      <div className="profile-img-wrapper">
                        <img src={preview || '/default-avatar.png'} alt="Profile" className="profile-img" />
                        {profilePicEditing && (
                          <label className="profile-edit-overlay">
                            <span className="edit-icon">Change</span>
                            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                          </label>
                        )}
                      </div>
                    </div>
                    
                    <div className="profile-name-email">
                      <div className="profile-fullname">{patient?.firstName || ''} {patient?.lastName || ''}</div>
                      <div className="profile-email">{patient?.email || ''}</div>
                      <div className="profile-image-actions">
                        {!profilePicEditing ? (
                          <button className="btn btn-outline-primary" onClick={startProfilePicEdit}>Edit</button>
                        ) : (
                          <>
                            <button className="btn btn-primary" onClick={handleSavePhoto}>Save</button>
                            <button className="btn btn-secondary" onClick={cancelProfilePicEdit}>Cancel</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* patient information */}
                  <div className="profile-box profile-info-box">
                    <h3>Patient Information</h3>
                    <div className="profile-info-grid">
                      {!editing ? (
                        <>
                          <div className="info-field">
                            <div className="field-label">First Name</div>
                            <div className="field-value">{patient?.firstName || ''}</div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Last Name</div>
                            <div className="field-value">{patient?.lastName || ''}</div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Gender</div>
                            <div className="field-value">{patient?.gender || ''}</div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Birthday</div>
                            <div className="field-value">{formatDate(patient?.birthday)}</div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Age</div>
                            <div className="field-value">{patient?.age ?? ''}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="info-field">
                            <div className="field-label">First Name</div>
                            <div className="field-value"><input name="firstName" value={editForm.firstName} onChange={handleEditChange} className="form-control" /></div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Last Name</div>
                            <div className="field-value"><input name="lastName" value={editForm.lastName} onChange={handleEditChange} className="form-control" /></div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Gender</div>
                            <div className="field-value">
                              <select name="gender" value={editForm.gender} onChange={handleEditChange} className="form-control">
                                <option value="">Select</option>
                                <option value="Female">Female</option>
                                <option value="Male">Male</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Birthday</div>
                            <div className="field-value"><input type="date" name="birthday" value={editForm.birthday} onChange={handleEditChange} className="form-control" /></div>
                          </div>
                          <div className="info-field">
                            <div className="field-label">Age</div>
                            <div className="field-value"><input name="age" value={editForm.age} readOnly className="form-control" /></div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!editing ? (
                        <button className="btn btn-outline-primary" onClick={startEdit}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={cancelEdit} disabled={savingProfile}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* contact information */}
                  <div className="profile-box profile-contact-box">
                    <h3>Contact Information</h3>
                    <div className="contact-info-grid">
                      {!contactEditing ? (
                        <>
                          <div className="contact-field">
                            <div className="contact-label">Email</div>
                            <div className="contact-value">{patient?.email || ''}</div>
                          </div>
                          <div className="contact-field">
                            <div className="contact-label">Phone Number</div>
                            <div className="contact-value">{patient?.contact || `${countryCode} ${localNumber}`.trim()}</div>
                          </div>
                          <div className="contact-field contact-address-field">
                            <div className="contact-label">Address</div>
                            <div className="contact-value">{patient?.address || ''}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="contact-field">
                            <div className="contact-label">Email</div>
                            <div className="contact-value"><input name="email" value={contactForm.email} readOnly className="form-control" /></div>
                          </div>
                          <div className="contact-field">
                            <div className="contact-label">Phone Number</div>
                            <div className="contact-value">
                              <div className="d-flex gap-2">
                                <select className="form-select" style={{ maxWidth: 210 }} value={countryCode} onChange={(e)=> setCountryCode(e.target.value)}>
                                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                </select>
                                <input type="tel" inputMode="numeric" pattern="[0-9]*" className="form-control" placeholder="e.g., 9123456789" maxLength={LOCAL_MAX} value={localNumber} onChange={(e)=> setLocalNumber(e.target.value.replace(/\D/g,'').slice(0, LOCAL_MAX))} />
                              </div>
                            </div>
                          </div>
                          <div className="contact-field contact-address-field">
                            <div className="contact-label">Address</div>
                            <div className="contact-value"><input name="address" value={contactForm.address} onChange={handleContactChange} className="form-control" /></div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!contactEditing ? (
                        <button className="btn btn-outline-primary" onClick={startContactEdit}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={handleSaveContact} disabled={savingContact}>{savingContact ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={cancelContactEdit} disabled={savingContact}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* emergency contact */}
                  <div className="profile-box profile-emergency-box">
                    <h3>Emergency Contact</h3>
                    <div className="emergency-info-grid">
                      {!emergencyEditing ? (
                        <>
                          <div className="emergency-field">
                            <div className="emergency-label">Full Name</div>
                            <div className="emergency-value">{patient?.emergencyName || ''}</div>
                          </div>
                          <div className="emergency-field">
                            <div className="emergency-label">Phone Number</div>
                            <div className="emergency-value">{patient?.emergencyContact || `${emergencyCountryCode} ${emergencyLocalNumber}`.trim()}</div>
                          </div>
                          <div className="emergency-field emergency-address-field">
                            <div className="emergency-label">Address</div>
                            <div className="emergency-value">{patient?.emergencyAddress || ''}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="emergency-field">
                            <div className="emergency-label">Full Name</div>
                            <div className="emergency-value"><input name="emergencyName" value={emergencyForm.emergencyName} onChange={handleEmergencyChange} className="form-control" /></div>
                          </div>
                          <div className="emergency-field">
                            <div className="emergency-label">Phone Number</div>
                            <div className="emergency-value">
                              <div className="d-flex gap-2">
                                <select className="form-select" style={{ maxWidth: 210 }} value={emergencyCountryCode} onChange={(e)=> setEmergencyCountryCode(e.target.value)}>
                                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                </select>
                                <input type="tel" inputMode="numeric" pattern="[0-9]*" className="form-control" placeholder="e.g., 9123456789" maxLength={LOCAL_MAX} value={emergencyLocalNumber} onChange={(e)=> setEmergencyLocalNumber(e.target.value.replace(/\D/g,'').slice(0, LOCAL_MAX))} />
                              </div>
                            </div>
                          </div>
                          <div className="emergency-field emergency-address-field">
                            <div className="emergency-label">Address</div>
                            <div className="emergency-value"><input name="emergencyAddress" value={emergencyForm.emergencyAddress} onChange={handleEmergencyChange} className="form-control" /></div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!emergencyEditing ? (
                        <button className="btn btn-outline-primary" onClick={startEmergencyEdit}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={handleSaveEmergency} disabled={savingEmergency}>{savingEmergency ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={cancelEmergencyEdit} disabled={savingEmergency}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* HMO number and card */}
                  <div className="profile-box profile-hmo-box">
                    <h3>HMO Number and Card</h3>
                    <div className="hmo-info-grid">
                      <div className="hmo-field">
                        <div className="hmo-label">HMO Number</div>
                        {!hmoEditing ? (
                          <div className="hmo-value">{patient?.hmoNumber || 'Not available'}</div>
                        ) : (
                          <div className="hmo-value">
                            <input name="hmoNumber" value={hmoForm.hmoNumber} onChange={handleHmoChange} className="form-control" />
                          </div>
                        )}
                      </div>
                      <div className="hmo-field">
                        <div className="hmo-label">HMO Card</div>
                        <div className="hmo-card-wrapper">
                          {hmoPreview ? (
                            <div className="hmo-img-container">
                              <img src={hmoPreview} alt="HMO Card" className="hmo-card-img" />
                              {hmoEditing && (
                                <label className="hmo-edit-overlay">
                                  <span className="hmo-edit-icon">Change</span>
                                  <input type="file" accept="image/*" onChange={handleHmoUpload} style={{ display: 'none' }} />
                                </label>
                              )}
                            </div>
                          ) : (
                            <div className="hmo-card-placeholder">
                              {hmoEditing ? (
                                <label className="hmo-upload-label">
                                  <span>Click to Upload HMO Card</span>
                                  <input type="file" accept="image/*" onChange={handleHmoUpload} style={{ display: 'none' }} />
                                </label>
                              ) : (
                                'No HMO card uploaded'
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!hmoEditing ? (
                        <button className="btn btn-outline-primary" onClick={startHmoEdit}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={handleSaveHmo} disabled={savingHmo}>{savingHmo ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={cancelHmoEdit} disabled={savingHmo}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* medical history */}
                  <div className="profile-box profile-medbox">
                    <h3>Medical History</h3>
                    <div className="medical-history">
                      {!medEditing ? (
                        patient?.medicalHistory ? (
                          <p style={{ whiteSpace: 'pre-wrap' }}>{patient.medicalHistory}</p>
                        ) : (
                          <p>No medical history provided.</p>
                        )
                      ) : (
                        <textarea name="medicalHistory" value={medForm.medicalHistory} onChange={handleMedChange} className="form-control" rows={6} />
                      )}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!medEditing ? (
                        <button className="btn btn-outline-primary" onClick={startMedEdit}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={handleSaveMed} disabled={savingMed}>{savingMed ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={cancelMedEdit} disabled={savingMed}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'settings' && (
          <>
            <hr className="settings-divider" />
            {/* Appearance */}
            <section className="card settings-collapsible" style={{ padding: '0', marginBottom: '6px', overflow: 'visible', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSections(s => ({ ...s, appearance: !s.appearance }))}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '10px 18px', 
                  borderRadius: sections.appearance ? '8px 8px 0 0' : '8px',
                  border: '1px solid rgba(142,172,205,0.2)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>Appearance</span>
                <span style={{ transition: 'transform 0.2s', transform: sections.appearance ? 'rotate(180deg)' : 'rotate(0)', fontSize: '1.1rem' }}>▾</span>
              </button>
              {sections.appearance && (
                <div style={{ padding: '10px 18px 14px 18px', background: 'transparent', border: '1px solid rgba(142,172,205,0.15)', borderTop: 'none', borderRadius: '0 0 8px 8px', marginBottom: '6px' }}>
                  <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: theme === 'dark' ? 'rgba(142,172,205,0.08)' : 'rgba(142,172,205,0.05)',
              borderRadius: '8px',
              border: `1px solid ${theme === 'dark' ? 'rgba(142,172,205,0.15)' : 'rgba(142,172,205,0.1)'}`
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="theme-toggle-p" style={{ fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer' }}>
                  Dark Mode
                </label>
                <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                  {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                </span>
              </div>
              <label className="theme-switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                <input 
                  id="theme-toggle-p" 
                  type="checkbox" 
                  checked={theme==='dark'} 
                  onChange={(e)=> setTheme(e.target.checked?'dark':'light')}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: theme === 'dark' ? '#6B8FA3' : '#ccc',
                  transition: '0.4s',
                  borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '26px',
                    width: '26px',
                    left: theme === 'dark' ? '30px' : '4px',
                    bottom: '4px',
                    backgroundColor: 'white',
                    transition: '0.4s',
                    borderRadius: '50%'
                  }}></span>
                </span>
              </label>
                  </div>
                </div>
              )}
            </section>

            {/* Password */}
            <section className="card settings-collapsible" style={{ padding: '0', marginBottom: '6px', overflow: 'visible', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSections(s => ({ ...s, password: !s.password }))}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '10px 18px', 
                  borderRadius: sections.password ? '8px 8px 0 0' : '8px',
                  border: '1px solid rgba(142,172,205,0.2)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>Password</span>
                <span style={{ transition: 'transform 0.2s', transform: sections.password ? 'rotate(180deg)' : 'rotate(0)', fontSize: '1.1rem' }}>▾</span>
              </button>
              {sections.password && (
                <div style={{ padding: '10px 18px 14px 18px', background: 'transparent', border: '1px solid rgba(142,172,205,0.15)', borderTop: 'none', borderRadius: '0 0 8px 8px', marginBottom: '6px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '4px', fontSize: '1.1rem', fontWeight: 600 }}>Change Password</h4>
                    <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7 }}>Update your password to keep your account secure</p>
                  </div>

                  {pwdErr && (
                    <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.2)' }}>{pwdErr}</div>
                  )}
                  {pwdMsg && (
                    <div style={{ color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(22,163,74,0.2)' }}>{pwdMsg}</div>
                  )}
                  <form onSubmit={submitPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block', fontSize: '0.9rem' }}>Current Password</label>
                      <PasswordInput className="form-control flat-pw" value={pwdForm.current} onChange={(e)=> setPwdForm(f=>({...f,current:e.target.value}))} placeholder="Enter your current password" required style={{ padding: '10px 14px', fontSize: '0.95rem' }} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block', fontSize: '0.9rem' }}>New Password</label>
                      <PasswordInput className="form-control flat-pw" value={pwdForm.next} onChange={(e)=> setPwdForm(f=>({...f,next:e.target.value}))} placeholder="Enter your new password" required style={{ padding: '10px 14px', fontSize: '0.95rem' }} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block', fontSize: '0.9rem' }}>Confirm New Password</label>
                      <PasswordInput className="form-control flat-pw" value={pwdForm.confirm} onChange={(e)=> setPwdForm(f=>({...f,confirm:e.target.value}))} placeholder="Confirm your new password" required style={{ padding: '10px 14px', fontSize: '0.95rem' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', paddingTop: '12px', borderTop: `1px solid ${theme === 'dark' ? 'rgba(142,172,205,0.2)' : 'rgba(142,172,205,0.15)'}` }}>
                      <button className="btn btn-primary" disabled={pwdBusy} style={{ padding: '10px 16px', fontSize: '0.95rem', fontWeight: 600 }}>
                        {pwdBusy ? 'Updating...' : 'Update Password'}
                      </button>
                      <Link to="/forgot-password" style={{ textAlign: 'center', fontSize: '0.9rem', color: theme === 'dark' ? '#8EACCD' : '#6B8FA3', textDecoration: 'none' }} onMouseEnter={(e) => e.target.style.textDecoration = 'underline'} onMouseLeave={(e) => e.target.style.textDecoration = 'none'}>
                        Forgot your password?
                      </Link>
                    </div>
                  </form>
                </div>
              )}
            </section>

            {/* Notifications */}
            <section className="card settings-collapsible" style={{ padding: '0', marginBottom: '6px', overflow: 'visible', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSections(s => ({ ...s, notifications: !s.notifications }))}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '10px 18px', 
                  borderRadius: sections.notifications ? '8px 8px 0 0' : '8px',
                  border: '1px solid rgba(142,172,205,0.2)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>Notifications</span>
                <span style={{ transition: 'transform 0.2s', transform: sections.notifications ? 'rotate(180deg)' : 'rotate(0)', fontSize: '1.1rem' }}>▾</span>
              </button>
              {sections.notifications && (
                <div style={{ padding: '10px 18px 14px 18px', background: 'transparent', border: '1px solid rgba(142,172,205,0.15)', borderTop: 'none', borderRadius: '0 0 8px 8px', marginBottom: '6px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '4px', fontSize: '1.1rem', fontWeight: 600 }}>Manage Notifications</h4>
                    <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7 }}>Control how you receive notifications</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: notifMuted ? 'rgba(239,68,68,0.06)' : 'rgba(142,172,205,0.05)',
                borderRadius: '8px',
                border: `1px solid ${notifMuted ? 'rgba(239,68,68,0.12)' : 'rgba(142,172,205,0.1)'}`
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="mute-all-notifs-p" style={{ fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer' }}>
                    Mute All Notifications
                  </label>
                  <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    {notifMuted ? 'Notifications are muted' : 'Notifications are enabled'}
                  </span>
                </div>
                <label className="theme-switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                  <input
                    id="mute-all-notifs-p"
                    type="checkbox"
                    checked={notifMuted}
                    onChange={(e) => {
                      const v = e.target.checked; setNotifMuted(v); localStorage.setItem('notifMuted', v ? 'on' : 'off');
                    }}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: notifMuted ? '#ef4444' : '#ccc',
                    transition: '0.4s',
                    borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '26px',
                      width: '26px',
                      left: notifMuted ? '30px' : '4px',
                      bottom: '4px',
                      backgroundColor: 'white',
                      transition: '0.4s',
                      borderRadius: '50%'
                    }}></span>
                  </span>
                </label>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: notifMuted ? 'rgba(142,172,205,0.03)' : (notifSound ? 'rgba(142,172,205,0.08)' : 'rgba(142,172,205,0.03)'),
                borderRadius: '12px',
                border: `2px solid ${notifMuted ? 'rgba(142,172,205,0.1)' : 'rgba(142,172,205,0.15)'}`,
                opacity: notifMuted ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="sound-notifs-p" style={{ fontWeight: 600, fontSize: '1.05rem', cursor: notifMuted ? 'not-allowed' : 'pointer' }}>
                    Notification Sound
                  </label>
                  <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    {notifSound ? 'Sound enabled' : 'Sound disabled'}
                  </span>
                </div>
                <label className="theme-switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                  <input
                    id="sound-notifs-p"
                    type="checkbox"
                    checked={notifSound}
                    disabled={notifMuted}
                    onChange={(e) => {
                      const v = e.target.checked; setNotifSound(v); localStorage.setItem('notifSound', v ? 'on' : 'off');
                    }}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: notifMuted ? 'not-allowed' : 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: (notifSound && !notifMuted) ? '#6B8FA3' : '#ccc',
                    transition: '0.4s',
                    borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '26px',
                      width: '26px',
                      left: notifSound ? '30px' : '4px',
                      bottom: '4px',
                      backgroundColor: 'white',
                      transition: '0.4s',
                      borderRadius: '50%'
                    }}></span>
                      </span>
                    </label>
                  </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        </div>
      </div>
    </div>
  );
}

function LinkBtn({ to, label, className }) {
  return (
    <a href={to} className={className || 'btn btn-primary'}>{label}</a>
  );
}

export default PSettings;