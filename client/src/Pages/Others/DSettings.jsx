//Dsettings.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import { formatLicense } from '../../api/licenseUtils';
import Navbar from '../../SideBar/Navbar.jsx';
import '../../Styles/DSettings.css';
import PasswordInput from '../../components/PasswordInput';

function DSettings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('profile'); // profile | settings
  const [sections, setSections] = useState({ appearance: false, password: false, notifications: false });

  // profile state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctor, setDoctor] = useState(null);
  const [preview, setPreview] = useState('');

  //Editing of profile, keep nyo to kapag nakita nyo
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [profilePicEditing, setProfilePicEditing] = useState(false);
  const [infoEditing, setInfoEditing] = useState(false);
  const [infoForm, setInfoForm] = useState({ firstName: '', lastName: '', email: '', experience: '', fees: '', licenseNumber: '' });
  const [specEditing, setSpecEditing] = useState(false);
  const [specForm, setSpecForm] = useState({ specialty: 'Mental Health', education: [''] });
  const [contactEditing, setContactEditing] = useState(false);
  const [contactForm, setContactForm] = useState({ address1: '', contact: '' });
  const [aboutEditing, setAboutEditing] = useState(false);
  const [aboutForm, setAboutForm] = useState({ about: '' });
  const [licenseStatus, setLicenseStatus] = useState({ status: 'none', number: '', raw: null });

  // Add file upload error state
  const [fileError, setFileError] = useState('');

  // phone helpers
  const COUNTRY_CODES = [
    { code: '+63', label: '🇵🇭 Philippines (+63)' }

  ];
  const LOCAL_MAX = 10;
  const [countryCode, setCountryCode] = useState('+63');
  const [localNumber, setLocalNumber] = useState('');

  const SPECIALTIES = [
    'Mental Health',
    'General Psychiatry',
    'Child and Adolescent Psychiatry',
    'Geriatric Psychiatry',
    'Addiction Psychiatry',
    'Consultation-Liaison Psychiatry',
    'Forensic Psychiatry',
    'Community Psychiatry',
    'Psychotherapy',
  ];
  const OTHER_VALUE = '__OTHER__';

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });

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
    } catch { }
    // Use lowercase path to match router
    window.location.href = '/login';
  };

  useEffect(() => {
    const controller = new AbortController();
    const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
    if (!email) {
      setError('Missing email. Please login again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    axios.post(apiUrl('/doctor/get-profile'), { email }, { signal: controller.signal })
      .then(res => {
        const d = res.data?.doctor;
        if (!d) {
          setError('Doctor profile not found.');
          return;
        }
        setDoctor(d);
        setPreview(d.profileImage || d.profilePicture || '');
        // keep nyo
        setInfoForm({
          firstName: d.firstName || '',
          lastName: d.lastName || '',
          email: d.email || '',
          experience: Array.isArray(d.experience) ? d.experience : (d.experience ? [d.experience] : ['']),
          fees: d.fees || '',
          licenseNumber: formatLicense(d.licenseNumber || '')
        });
        setSpecForm({ specialty: d.specialty || 'Mental Health', education: Array.isArray(d.education) ? d.education : [''] });
        setContactForm({ address1: d.address1 || '', contact: d.contact || '' });
        setAboutForm({ about: d.about || '' });
        // load license status (approved / pending / rejected)
        try {
          axios.get(apiUrl('/api/license/status'), { params: { email } }).then((r) => {
            const lic = r.data?.license || null;
            if (!lic) setLicenseStatus({ status: 'none', number: '', raw: null });
            else setLicenseStatus({ status: lic.status, number: lic.licenseNumber || '', raw: lic });
          }).catch(() => {});
        } catch {}
        // keep nyo
        try {
          const m = String(d.contact || '').match(/^(\+\d{1,4})\s*(.*)$/);
          if (m) { setCountryCode(m[1]); setLocalNumber(((m[2] || '').replace(/\D/g, '')).slice(0, LOCAL_MAX)); }
          else { setCountryCode('+63'); setLocalNumber(String(d.contact || '').replace(/\D/g, '').slice(0, LOCAL_MAX)); }
        } catch { setCountryCode('+63'); setLocalNumber(''); }
      })
      .catch((e) => {
        // Ignore cancellations (happens on refresh, unmount, or HMR in dev)
        try {
          if (typeof axios.isCancel === 'function' && axios.isCancel(e)) return;
        } catch { }
        if (e?.code === 'ERR_CANCELED' || controller.signal?.aborted) return;
        console.error('Load profile error', e);
        if (!controller.signal.aborted) setError(e?.response?.data?.message || 'Failed to load profile.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  // (auto-reload removed as requested)

  useEffect(() => {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    localStorage.setItem('theme', theme);
    // notify app to update theme immediately
    try { window.dispatchEvent(new Event('themeChange')); } catch { }
  }, [theme]);

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
      const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
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

  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('theme') || 'light');
    window.addEventListener('storage', handleTheme);
    window.addEventListener('themeChange', handleTheme);
    return () => {
      window.removeEventListener('storage', handleTheme);
      window.removeEventListener('themeChange', handleTheme);
    };
  }, []);

  // Handlers for inline profile, also keep this
  const startProfilePicEdit = () => {
    setProfilePicEditing(true);
    setFileError(''); // Clear any previous file errors
  };

  const cancelProfilePicEdit = () => {
    setProfilePicEditing(false);
    setPreview(doctor?.profileImage || doctor?.profilePicture || '');
    setFileError(''); // Clear any file errors
  };

  // Modified handlePhotoUpload with file type validation
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous errors
    setFileError('');

    // Check file type - only allow JPEG and WebP
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/webp'];
    const fileType = file.type.toLowerCase();

    if (!allowedTypes.includes(fileType)) {
      setFileError('Only JPEG and WebP image formats are allowed. Please select a different file.');
      // Clear the file input
      e.target.value = '';
      return;
    }

    // Check file size (optional - limit to 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setFileError('File size must be less than 5MB. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    // If validation passes, read the file
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.onerror = () => {
      setFileError('Failed to read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const savePhoto = async () => {
    if (!doctor?.email) return;
    try {
      setSaving(true);
      setMessage('');
      setError('');
      setFileError(''); // Clear file errors before saving
      
      const res = await axios.post(apiUrl('/doctor/profile'), { email: doctor.email, profileImage: preview || '' });
      if (res.data?.doctor) {
        setDoctor(res.data.doctor);
        setPreview(res.data.doctor.profileImage || res.data.doctor.profilePicture || '');
      }
      setProfilePicEditing(false);
      setMessage('Profile picture saved');
    } catch (err) {
      console.error('Save photo error', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save picture');
    } finally {
      setSaving(false);
    }
  };

  const saveInfo = async () => {
    if (!doctor?.email) return;
    try {
      setSaving(true); setMessage(''); setError('');
      const payload = { email: doctor.email, firstName: infoForm.firstName, lastName: infoForm.lastName, experience: infoForm.experience, fees: infoForm.fees, licenseNumber: infoForm.licenseNumber };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') {
        // Do NOT copy licenseNumber into the doctor profile unless it's approved by admin.
        setDoctor(prev => ({ ...prev, firstName: payload.firstName, lastName: payload.lastName, experience: payload.experience, fees: payload.fees }));
        setInfoEditing(false);
        setMessage('Profile info saved');
      } else {
        setError(res.data?.message || 'Failed to save');
      }

      // If the user supplied a (new) license number, explicitly submit it to the license API
      // This makes sure a pending LicenseRequest is created even if the profile update path
      // doesn't produce one in some environments. Avoid resubmitting the same number.
      try {
        const supplied = String(infoForm.licenseNumber || '').trim();
        const currentNumber = licenseStatus?.number || doctor?.licenseNumber || '';
        if (supplied && supplied !== currentNumber) {
          // Only submit when it looks like a valid formatted license (e.g. 1234-1234-123)
          const pattern = /^\d{4}-\d{4}-\d{3}$/;
          if (pattern.test(supplied)) {
            await axios.post(apiUrl('/api/license/submit'), { email: doctor.email, licenseNumber: supplied }).catch(() => {});
          }
        }
      } catch (e) { /* ignore license submit errors; we'll refresh status below */ }

      try {
        const r = await axios.get(apiUrl('/api/license/status'), { params: { email: doctor.email } });
        const lic = r.data?.license || null;
        if (!lic) setLicenseStatus({ status: 'none', number: '', raw: null });
        else setLicenseStatus({ status: lic.status, number: lic.licenseNumber || '', raw: lic });

        // If a pending request exists, notify the doctor that verification is pending
        if (lic && lic.status === 'pending') {
          setMessage('License submitted for verification. Your account will be able to accept bookings once approved.');
        } else if (lic && lic.status === 'rejected') {
          setMessage('License was rejected. Please review admin feedback and resubmit if needed.');
        }
      } catch (e) {
        // ignore license refresh errors
      }
    } catch (err) {
      console.error('Save info error', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveSpec = async () => {
    if (!doctor?.email) return;
    try {
      setSaving(true); setMessage(''); setError('');
      const payload = { email: doctor.email, specialty: specForm.specialty, education: specForm.education };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') { setDoctor(prev => ({ ...prev, ...payload })); setSpecEditing(false); setMessage('Specialization saved'); }
      else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save specialization error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const saveContact = async () => {
    if (!doctor?.email) return;
    try {
      setSaving(true); setMessage(''); setError('');
      const fullContact = `${countryCode} ${localNumber}`.trim();
      const payload = { email: doctor.email, address1: contactForm.address1, contact: fullContact };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') { setDoctor(prev => ({ ...prev, ...payload })); setContactEditing(false); setMessage('Contact info saved'); }
      else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save contact error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const saveAbout = async () => {
    if (!doctor?.email) return;
    try {
      setSaving(true); setMessage(''); setError('');
      const payload = { email: doctor.email, about: aboutForm.about };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') { setDoctor(prev => ({ ...prev, ...payload })); setAboutEditing(false); setMessage('About saved'); }
      else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save about error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div className={`dsettings-dashboard ${theme === 'dark' ? 'theme-dark' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className="dsettings-dashboard-main">
        <div className="settings-container">
          <div style={{ display: 'flex', paddingLeft: '20px', paddingRight: '20px', alignItems: 'center', gap: 12, justifyContent: 'space-between', marginBottom: '20px', marginTop: '20px' }}>
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
                {/* Profile Content inline */}
                <div className="doctor-profile-container" style={{ marginTop: 0 }}>
                  {/* Profile Picture with Name, Specialty, and Fees */}
                  <div className="profile-box profile-image-box">
                    <div className="profile-picture-container">
                      <div className="profile-img-wrapper">
                        <img src={preview || doctor?.profilePicture || '/default-avatar.jgp'} alt="Profile" className="profile-img" />
                        {profilePicEditing && (
                          <label className="profile-edit-overlay">
                            <span className="edit-icon">Change</span>
                            <input 
                              type="file" 
                              accept="image/jpeg,image/jpg,image/webp" 
                              onChange={handlePhotoUpload} 
                              style={{ display: 'none' }} 
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="profile-name-specialty-fees">
                      <div className="profile-fullname">{doctor?.firstName || ''} {doctor?.lastName || ''}</div>
                      <div className="profile-specialty">{doctor?.specialty || 'Mental Health'}</div>
                      <div className="profile-fees">Fees: ₱{doctor?.fees || '0'}</div>
                      
                      {/* Display file upload error */}
                      {fileError && (
                        <div style={{ 
                          color: '#ef4444', 
                          backgroundColor: 'rgba(239,68,68,0.1)', 
                          padding: '8px 12px', 
                          borderRadius: '6px', 
                          marginTop: '8px',
                          fontSize: '0.875rem',
                          border: '1px solid rgba(239,68,68,0.2)'
                        }}>
                          {fileError}
                        </div>
                      )}
                      
                      <div className="profile-image-actions">
                        {!profilePicEditing ? (
                          <button className="btn btn-outline-primary" onClick={startProfilePicEdit}>Edit</button>
                        ) : (
                          <>
                            <button 
                              className="btn btn-primary" 
                              onClick={savePhoto} 
                              disabled={saving || !!fileError}
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button className="btn btn-secondary" onClick={cancelProfilePicEdit} disabled={saving}>Cancel</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal & Professional Info */}
                  <div className="profile-box profile-info-box">
                    <h3>Personal & Professional Info</h3>
                    {!infoEditing ? (
                      <div className="profile-info-grid">
                        <div className="info-field">
                          <div className="field-label">First Name</div>
                          <div className="field-value">{doctor?.firstName || ''}</div>
                        </div>
                        <div className="info-field">
                          <div className="field-label">Last Name</div>
                          <div className="field-value">{doctor?.lastName || ''}</div>
                        </div>
                        <div className="info-field">
                          <div className="field-label">Professional Fee</div>
                          <div className="field-value">₱{doctor?.fees || '0'}</div>
                        </div>
                        <div className="info-field">
                          <div className="field-label">License Number</div>
                          <div className="field-value">
                            { (licenseStatus.number || doctor?.licenseNumber) ? (
                              <span>
                                {licenseStatus.number || doctor?.licenseNumber}
                                {licenseStatus.status === 'approved' && <span className="badge badge-success" style={{ marginLeft: 8 }}>Approved</span>}
                                {licenseStatus.status === 'pending' && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Pending</span>}
                                {licenseStatus.status === 'rejected' && <span className="badge badge-danger" style={{ marginLeft: 8 }}>Rejected</span>}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="profile-info-grid">
                        <div className="info-field">
                          <div className="field-label">First Name</div>
                          <div className="field-value">
                            <input className="form-control" value={infoForm.firstName} onChange={(e) => setInfoForm(f => ({ ...f, firstName: e.target.value }))} />
                          </div>
                        </div>
                        <div className="info-field">
                          <div className="field-label">Last Name</div>
                          <div className="field-value">
                            <input className="form-control" value={infoForm.lastName} onChange={(e) => setInfoForm(f => ({ ...f, lastName: e.target.value }))} />
                          </div>
                        </div>
                        <div className="info-field">
                          <div className="field-label">Professional Fee</div>
                          <div className="field-value">
                            <input type="number" className="form-control" value={infoForm.fees} onChange={(e) => setInfoForm(f => ({ ...f, fees: e.target.value }))} />
                          </div>
                        </div>
                        <div className="info-field">
                          <div className="field-label">License Number</div>
                          <div className="field-value">
                            <input className="form-control" value={infoForm.licenseNumber || ''} onChange={(e) => setInfoForm(f => ({ ...f, licenseNumber: formatLicense(e.target.value) }))} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!infoEditing ? (
                        <button className="btn btn-outline-primary" onClick={() => { setInfoEditing(true); setInfoForm({ firstName: doctor?.firstName || '', lastName: doctor?.lastName || '', email: doctor?.email || '', experience: Array.isArray(doctor?.experience) ? doctor.experience : (doctor?.experience ? [doctor.experience] : ['']), fees: doctor?.fees || '', licenseNumber: formatLicense(licenseStatus.number || doctor?.licenseNumber || '') }); }}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={() => { setInfoEditing(false); setInfoForm({ firstName: doctor?.firstName || '', lastName: doctor?.lastName || '', email: doctor?.email || '', experience: Array.isArray(doctor?.experience) ? doctor.experience : (doctor?.experience ? [doctor.experience] : ['']), fees: doctor?.fees || '', licenseNumber: formatLicense(licenseStatus.number || doctor?.licenseNumber || '') }); }} disabled={saving}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Specialization & Education */}
                  <div className="profile-box profile-specialization-box">
                    <h3>Specialization & Education</h3>
                    {!specEditing ? (
                      <div className="profile-specialization-grid">
                        <div className="specialization-field">
                          <div className="specialization-label">Specialization</div>
                          <div className="specialization-value">{doctor?.specialty || 'Mental Health'}</div>
                        </div>
                        <div className="specialization-field">
                          <div className="specialization-label">Education</div>
                          <div className="education-container">
                            {(doctor?.education || []).filter(Boolean).length > 0 ? (
                              (doctor?.education || []).filter(Boolean).map((edu, idx) => (
                                <div key={idx} className="education-value">{edu}</div>
                              ))
                            ) : (
                              <div className="education-value">—</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="profile-specialization-grid">
                        <div className="specialization-field">
                          <div className="specialization-label">Specialization</div>
                          <div className="specialization-value">
                            <select className="form-control" value={SPECIALTIES.includes(specForm.specialty) ? specForm.specialty : OTHER_VALUE} onChange={(e) => { const v = e.target.value; setSpecForm(f => ({ ...f, specialty: v === OTHER_VALUE ? '' : v })); }}>
                              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                              <option value={OTHER_VALUE}>Other…</option>
                            </select>
                            {(!SPECIALTIES.includes(specForm.specialty)) && (
                              <input className="form-control mt-2" placeholder="Enter specialty" value={specForm.specialty} onChange={(e) => setSpecForm(f => ({ ...f, specialty: e.target.value }))} />
                            )}
                          </div>
                        </div>
                        <div className="specialization-field">
                          <div className="specialization-label">Education</div>
                          <div className="education-edit-container">
                            {(specForm.education || []).map((edu, idx) => (
                              <div key={idx} className="education-edit-item">
                                <input className="form-control" value={edu} onChange={(e) => setSpecForm(prev => ({ ...prev, education: prev.education.map((x, i) => i === idx ? e.target.value : x) }))} />
                                <button type="button" className="btn btn-outline-danger" onClick={() => setSpecForm(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== idx) }))}>Remove</button>
                              </div>
                            ))}
                            <button type="button" className="btn btn-secondary" onClick={() => setSpecForm(prev => ({ ...prev, education: [...(prev.education || []), ''] }))}>+ Add Education</button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!specEditing ? (
                        <button className="btn btn-outline-primary" onClick={() => { setSpecEditing(true); setSpecForm({ specialty: doctor?.specialty || 'Mental Health', education: Array.isArray(doctor?.education) ? doctor.education : [''] }); }}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={saveSpec} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={() => { setSpecEditing(false); setSpecForm({ specialty: doctor?.specialty || 'Mental Health', education: Array.isArray(doctor?.education) ? doctor.education : [''] }); }} disabled={saving}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Clinic & Contact */}
                  <div className="profile-box">
                    <h3>Contact Information</h3>
                    {!contactEditing ? (
                      <div className="profile-contact-grid">
                        <div className="contact-field">
                          <div className="contact-label">Email</div>
                          <div className="contact-value">{doctor?.email || ''}</div>
                        </div>
                        <div className="contact-field">
                          <div className="contact-label">Phone Number</div>
                          <div className="contact-value">{doctor?.contact || `${countryCode} ${localNumber}`.trim()}</div>
                        </div>
                        <div className="contact-field contact-address-field">
                          <div className="contact-label">Clinic Address</div>
                          <div className="contact-value">{doctor?.address1 || ''}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="profile-contact-grid">
                        <div className="contact-field">
                          <div className="contact-label">Email</div>
                          <div className="contact-value"><input className="form-control" value={doctor?.email || ''} readOnly /></div>
                        </div>
                        <div className="contact-field">
                          <div className="contact-label">Phone Number</div>
                          <div className="contact-value">
                            <div className="d-flex gap-2">
                              <select className="form-select" style={{ maxWidth: 210 }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                              </select>
                              <input type="tel" inputMode="numeric" pattern="[0-9]*" className="form-control" placeholder="e.g., 9123456789" maxLength={LOCAL_MAX} value={localNumber} onChange={(e) => setLocalNumber(e.target.value.replace(/\D/g, '').slice(0, LOCAL_MAX))} />
                            </div>
                          </div>
                        </div>
                        <div className="contact-field contact-address-field">
                          <div className="contact-label">Clinic Address</div>
                          <div className="contact-value"><input className="form-control" value={contactForm.address1} onChange={(e) => setContactForm(f => ({ ...f, address1: e.target.value }))} /></div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!contactEditing ? (
                        <button className="btn btn-outline-primary" onClick={() => { setContactEditing(true); setContactForm({ address1: doctor?.address1 || '', contact: doctor?.contact || '' }); }}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={saveContact} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={() => { setContactEditing(false); setContactForm({ address1: doctor?.address1 || '', contact: doctor?.contact || '' }); }} disabled={saving}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* About */}
                  <div className="profile-box">
                    <h3>About</h3>
                    {!aboutEditing ? (
                      <div className="about-content">
                        {doctor?.about || 'No information provided.'}
                      </div>
                    ) : (
                      <textarea className="form-control" style={{ marginTop: 16 }} rows={5} value={aboutForm.about} onChange={(e) => setAboutForm({ about: e.target.value })} />
                    )}
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!aboutEditing ? (
                        <button className="btn btn-outline-primary" onClick={() => { setAboutEditing(true); setAboutForm({ about: doctor?.about || '' }); }}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={saveAbout} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={() => { setAboutEditing(false); setAboutForm({ about: doctor?.about || '' }); }} disabled={saving}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Experience */}
                  <div className="profile-box">
                    <h3>Experience</h3>
                    {!infoEditing ? (
                      <div className="experience-grid">
                        <div className="experience-field">
                          <div className="experience-value">
                            {Array.isArray(doctor?.experience) ? (doctor.experience.filter(Boolean).join('\n')) : (doctor?.experience || 'No experience provided.')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="experience-grid">
                        {(infoForm.experience || []).map((exp, idx) => (
                          <div key={idx} className="d-flex align-items-center gap-2 mb-2">
                            <input className="form-control" value={exp} onChange={(e) => setInfoForm(prev => ({ ...prev, experience: prev.experience.map((x, i) => i === idx ? e.target.value : x) }))} />
                            <button type="button" className="btn btn-outline-danger" onClick={() => setInfoForm(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== idx) }))}>Remove</button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-secondary" onClick={() => setInfoForm(prev => ({ ...prev, experience: [...(prev.experience || []), ''] }))}>+ Add Experience</button>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {!infoEditing ? (
                        <button className="btn btn-outline-primary" onClick={() => { setInfoEditing(true); setInfoForm({ firstName: doctor?.firstName || '', lastName: doctor?.lastName || '', email: doctor?.email || '', experience: Array.isArray(doctor?.experience) ? doctor.experience : (doctor?.experience ? [doctor.experience] : ['']), fees: doctor?.fees || '' }); }}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-secondary" onClick={() => { setInfoEditing(false); setInfoForm({ firstName: doctor?.firstName || '', lastName: doctor?.lastName || '', email: doctor?.email || '', experience: Array.isArray(doctor?.experience) ? doctor.experience : (doctor?.experience ? [doctor.experience] : ['']), fees: doctor?.fees || '' }); }} disabled={saving}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>

                  {(message || error) && <div className="alert alert-info mt-2">{message || error}</div>}
                </div>
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
                        <label htmlFor="theme-toggle-d" style={{ fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer' }}>
                          Dark Mode
                        </label>
                        <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                          {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                        </span>
                      </div>
                      <label className="theme-switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                        <input
                          id="theme-toggle-d"
                          type="checkbox"
                          checked={theme === 'dark'}
                          onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
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
                        <PasswordInput className="form-control flat-pw" value={pwdForm.current} onChange={(e) => setPwdForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter your current password" required style={{ padding: '10px 14px', fontSize: '0.95rem' }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block', fontSize: '0.9rem' }}>New Password</label>
                        <PasswordInput className="form-control flat-pw" value={pwdForm.next} onChange={(e) => setPwdForm(f => ({ ...f, next: e.target.value }))} placeholder="Enter your new password" required style={{ padding: '10px 14px', fontSize: '0.95rem' }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block', fontSize: '0.9rem' }}>Confirm New Password</label>
                        <PasswordInput className="form-control flat-pw" value={pwdForm.confirm} onChange={(e) => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Confirm your new password" required style={{ padding: '10px 14px', fontSize: '0.95rem' }} />
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
                          <label htmlFor="mute-all-notifs-d" style={{ fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                            Mute All Notifications
                          </label>
                          <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                            {notifMuted ? 'Notifications are muted' : 'Notifications are enabled'}
                          </span>
                        </div>
                        <label className="theme-switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                          <input
                            id="mute-all-notifs-d"
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
                          <label htmlFor="sound-notifs-d" style={{ fontWeight: 600, fontSize: '1rem', cursor: notifMuted ? 'not-allowed' : 'pointer' }}>
                            Notification Sound
                          </label>
                          <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                            {notifSound ? 'Sound enabled' : 'Sound disabled'}
                          </span>
                        </div>
                        <label className="theme-switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                          <input
                            id="sound-notifs-d"
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

export default DSettings;