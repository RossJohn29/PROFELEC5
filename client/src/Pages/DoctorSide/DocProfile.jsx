//DocProfile.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import Navbar from '../../SideBar/Navbar.jsx';
import '../../Styles/Ddashboard.css';
import '../../Styles/DoctorProfile.css';
import '../../Styles/PatientProfile.css';
import { formatLicense, isValidLicense } from '../../api/licenseUtils';

function DocProfile() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [doctor, setDoctor] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const [infoEditing, setInfoEditing] = useState(false);
  const [infoForm, setInfoForm] = useState(null);
  const [specEditing, setSpecEditing] = useState(false);
  const [specForm, setSpecForm] = useState({ specialty: 'Mental Health', education: [''] });
  const [contactEditing, setContactEditing] = useState(false);
  const [contactForm, setContactForm] = useState({ address1: '', contact: '' });
  const [aboutEditing, setAboutEditing] = useState(false);
  const [aboutForm, setAboutForm] = useState({ about: '' });
  const [saving, setSaving] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState({ status: 'none', number: '', raw: null });
  const [licenseEditing, setLicenseEditing] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseMsg, setLicenseMsg] = useState('');

  const COUNTRY_CODES = [ 
    { code: '+63', label: '🇵🇭 Philippines (+63)' } 
  ];
  const LOCAL_MAX = 10;
  const [countryCode, setCountryCode] = useState('+63');
  const [localNumber, setLocalNumber] = useState('');
  const origHRef = useRef(null);

  const SPECIALTIES = [
    'Mental Health','General Psychiatry','Child and Adolescent Psychiatry','Geriatric Psychiatry','Addiction Psychiatry','Consultation-Liaison Psychiatry','Forensic Psychiatry','Community Psychiatry','Psychotherapy',
  ];
  const OTHER_VALUE = '__OTHER__';

  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('theme') || 'light');
    window.addEventListener('storage', handleTheme);
    window.addEventListener('themeChange', handleTheme);
    return () => {
      window.removeEventListener('storage', handleTheme);
      window.removeEventListener('themeChange', handleTheme);
    };
  }, []);

  // Load doctor profile
  useEffect(() => {
    const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
    if (!email) { setError('Doctor email missing. Please login again.'); setLoading(false); return; }
    setLoading(true); setError(''); setMessage('');
    axios.post(apiUrl('/doctor/get-profile'), { email })
      .then(res => {
        const d = res.data?.doctor;
        if (!d) { setError('No profile data found.'); return; }
        setDoctor(d);
        setPhotoPreview(d.profileImage || '');
        // seed forms
        setInfoForm({
          firstName: d.firstName || '',
          lastName: d.lastName || '',
          email: d.email || '',
          experience: Array.isArray(d.experience) ? d.experience : (d.experience ? [d.experience] : ['']),
          fees: d.fees || ''
        });
        setSpecForm({ specialty: d.specialty || 'Mental Health', education: Array.isArray(d.education) ? d.education : [''] });
        setContactForm({ address1: d.address1 || '', contact: d.contact || '' });
        setAboutForm({ about: d.about || '' });
        // parse contact parts for UI
        try {
          const m = String(d.contact || '').match(/^(\+\d{1,4})\s*(.*)$/);
          if (m) { setCountryCode(m[1]); setLocalNumber(((m[2] || '').replace(/\D/g, '')).slice(0, LOCAL_MAX)); }
          else { setCountryCode('+63'); setLocalNumber(String(d.contact || '').replace(/\D/g, '').slice(0, LOCAL_MAX)); }
        } catch { setCountryCode('+63'); setLocalNumber(''); }
      })
      .catch((err) => {
        // Ignore cancellations (happens during refresh/HMR/unmount)
        try {
          if (typeof axios.isCancel === 'function' && axios.isCancel(err)) return;
        } catch {}
        if (err?.code === 'ERR_CANCELED') return;
        console.error('Load profile error', err);
        setError(err?.response?.data?.message || 'Failed to load profile');
      })
      .finally(() => setLoading(false));

    // Load license status
    axios.get(apiUrl('/api/license/status'), { params: { email } })
      .then(res => {
        const lic = res.data?.license || null;
        if (!lic) { setLicenseInfo({ status: 'none', number: '', raw: null }); return; }
        setLicenseInfo({ status: lic.status, number: lic.licenseNumber, raw: lic });
        setLicenseInput(lic.licenseNumber || '');
      })
      .catch(err => {
        console.error('Load license status error', err);
      });
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => setPhotoPreview(reader.result); reader.readAsDataURL(file);
  };

  const savePhoto = async () => {
    if (!doctor?.email) return;
    try {
      setSaving(true); setError(''); setMessage('');
      await axios.post(apiUrl('/doctor/profile'), { email: doctor.email, profileImage: photoPreview || '' });
      setMessage('Profile picture saved');
    } catch (err) { console.error('Save photo error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save picture'); } finally { setSaving(false); }
  };

  // Info card save
  const saveInfo = async () => {
    if (!doctor?.email || !infoForm) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const payload = { email: doctor.email, firstName: infoForm.firstName, lastName: infoForm.lastName, experience: infoForm.experience, fees: infoForm.fees };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') {
        setDoctor(prev => ({ ...prev, ...payload }));
        setInfoEditing(false);
        setMessage('Profile info saved');
      } else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save info error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  // Specialty & education
  const saveSpec = async () => {
    if (!doctor?.email) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const payload = { email: doctor.email, specialty: specForm.specialty, education: specForm.education };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') {
        setDoctor(prev => ({ ...prev, ...payload }));
        setSpecEditing(false);
        setMessage('Specialization saved');
      } else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save specialization error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  // Contact & address
  const saveContact = async () => {
    if (!doctor?.email) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const fullContact = `${countryCode} ${localNumber}`.trim();
      const payload = { email: doctor.email, address1: contactForm.address1, contact: fullContact };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') {
        setDoctor(prev => ({ ...prev, ...payload }));
        setContactEditing(false);
        setMessage('Contact info saved');
      } else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save contact error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  // About
  const saveAbout = async () => {
    if (!doctor?.email) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const payload = { email: doctor.email, about: aboutForm.about };
      const res = await axios.post(apiUrl('/doctor/profile'), payload);
      if (res.data?.status === 'success') {
        setDoctor(prev => ({ ...prev, ...payload }));
        setAboutEditing(false);
        setMessage('About saved');
      } else setError(res.data?.message || 'Failed to save');
    } catch (err) { console.error('Save about error', err); setError(err?.response?.data?.message || err?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div className={`doctor-page-wrapper ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className={`doctor-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <main className="doctor-main">
          <div className="doctor-profile-page">
            <div className="page-header d-flex justify-content-between align-items-center">
              <h1 className="mb-0">Doctor Profile</h1>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>Loading…</div>
            ) : error ? (
              <div className="alert alert-info">{error}</div>
            ) : (
              <div className="patient-profile-container">
                {/* Photo */}
                <div className="profile-box profile-image-box">
                  <h3>Profile Picture</h3>
                  <img src={photoPreview || '/default-avatar.png'} alt="Profile" className="profile-img" />
                  <div className="profile-buttons">
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                      Change
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    </label>
                    <button className="btn btn-primary" onClick={savePhoto} disabled={saving}>{saving ? 'Saving…' : 'Save Photo'}</button>
                  </div>
                </div>

                {/* Info */}
                <div className="profile-box profile-info-box">
                  <h3>Personal & Professional Info</h3>
                  {!infoEditing ? (
                    <div className="info-grid">
                      <div className="label">First Name</div><div className="value">{doctor?.firstName || ''}</div>
                      <div className="label">Last Name</div><div className="value">{doctor?.lastName || ''}</div>
                      <div className="label">Email</div><div className="value">{doctor?.email || ''}</div>
                      <div className="label">Experience</div>
                      <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{Array.isArray(doctor?.experience) ? (doctor.experience.filter(Boolean).join('\n')) : (doctor?.experience || '')}</div>
                      <div className="label">Fees (₱)</div><div className="value">{doctor?.fees || ''}</div>
                      <div className="label">License Number</div>
                      <div className="value">
                        {licenseInfo.number ? (
                          <span>
                            {licenseInfo.number}
                            {licenseInfo.status === 'approved' && <span className="badge bg-success" style={{ marginLeft: 8 }}>Approved</span>}
                            {licenseInfo.status === 'pending' && <span className="badge bg-warning text-dark" style={{ marginLeft: 8 }}>Pending</span>}
                            {licenseInfo.status === 'rejected' && <span className="badge bg-danger" style={{ marginLeft: 8 }}>Rejected</span>}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <button className="btn btn-outline-primary btn-sm" onClick={() => { setLicenseEditing(true); setLicenseMsg(''); setLicenseInput(formatLicense(licenseInfo.number || '')); }}>Change License</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="info-grid">
                      <div className="label">First Name</div><div className="value"><input className="form-control" value={infoForm.firstName} onChange={(e) => setInfoForm({ ...infoForm, firstName: e.target.value })} /></div>
                      <div className="label">Last Name</div><div className="value"><input className="form-control" value={infoForm.lastName} onChange={(e) => setInfoForm({ ...infoForm, lastName: e.target.value })} /></div>
                      <div className="label">Email</div><div className="value"><input className="form-control" value={infoForm.email} readOnly /></div>
                      <div className="label">Experience</div>
                      <div className="value">
                        {(infoForm.experience || []).map((exp, idx) => (
                          <div key={idx} className="d-flex align-items-center gap-2 mb-2">
                            <input className="form-control" value={exp} onChange={(e) => setInfoForm(prev => ({ ...prev, experience: prev.experience.map((x,i) => i === idx ? e.target.value : x) }))} />
                            <button type="button" className="btn btn-outline-danger" onClick={() => setInfoForm(prev => ({ ...prev, experience: prev.experience.filter((_,i) => i !== idx) }))}>Remove</button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-secondary" onClick={() => setInfoForm(prev => ({ ...prev, experience: [...(prev.experience || []), ''] }))}>+ Add Experience</button>
                      </div>
                      <div className="label">Fees (₱)</div><div className="value"><input type="number" className="form-control" value={infoForm.fees} onChange={(e) => setInfoForm({ ...infoForm, fees: e.target.value })} /></div>
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

                  {/* License change inline form */}
                  {licenseEditing && (
                    <div className="mt-3" style={{ borderTop: '1px solid #e5e5e5', paddingTop: 12 }}>
                      <div className="info-grid">
                        <div className="label">New License</div>
                        <div className="value">
                          <input
                            className="form-control"
                            placeholder="1234-1234-123"
                            value={licenseInput}
                            onChange={(e) => setLicenseInput(formatLicense(e.target.value))}
                            inputMode="numeric"
                            pattern="[0-9]{4}-[0-9]{4}-[0-9]{3}"
                            title="Format: 1234-1234-123"
                          />
                          <div className="form-text">Submitting will send this license for admin review.</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                          className="btn btn-primary"
                          onClick={async () => {
                            setLicenseMsg(''); setError('');
                            const email = doctor?.email; if (!email) return;
                            if (!isValidLicense(licenseInput)) { setError('Enter a valid license number (1234-1234-123)'); return; }
                            try {
                              const resp = await axios.post(apiUrl('/api/license/submit'), { email, licenseNumber: licenseInput.trim() });
                              const st = resp.data?.status;
                              const req = resp.data?.request;
                              if (st === 'success' || st === 'already_pending' || st === 'revived_pending' || st === 'duplicate') {
                                setLicenseInfo({ status: req?.status || 'pending', number: req?.licenseNumber || licenseInput.trim(), raw: req || null });
                                setLicenseMsg('License submitted for review');
                                setLicenseEditing(false);
                              } else if (st === 'already_approved') {
                                setLicenseInfo({ status: 'approved', number: req?.licenseNumber || licenseInput.trim(), raw: req || null });
                                setLicenseMsg('This license is already approved');
                                setLicenseEditing(false);
                              } else {
                                setError(resp.data?.message || 'Could not submit license');
                              }
                            } catch (err) {
                              console.error('Submit license error', err);
                              setError(err?.response?.data?.message || err?.message || 'Failed to submit');
                            }
                          }}
                        >Submit for review</button>
                        <button className="btn btn-secondary" onClick={() => setLicenseEditing(false)}>Cancel</button>
                      </div>
                      {licenseMsg && <div className="alert alert-info mt-2">{licenseMsg}</div>}
                    </div>
                  )}
                </div>

                {/* Specialization & Education */}
                <div className="profile-box">
                  <h3>Specialization & Education</h3>
                  {!specEditing ? (
                    <div className="info-grid">
                      <div className="label">Specialization</div><div className="value">{doctor?.specialty || 'Mental Health'}</div>
                      <div className="label">Education</div>
                      <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{(doctor?.education || []).filter(Boolean).join('\n') || '—'}</div>
                    </div>
                  ) : (
                    <div className="info-grid">
                      <div className="label">Specialization</div>
                      <div className="value">
                        <select className="form-control" value={SPECIALTIES.includes(specForm.specialty) ? specForm.specialty : OTHER_VALUE} onChange={(e) => { const v = e.target.value; setSpecForm(f => ({ ...f, specialty: v === OTHER_VALUE ? '' : v })); }}>
                          {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                          <option value={OTHER_VALUE}>Other…</option>
                        </select>
                        {(!SPECIALTIES.includes(specForm.specialty)) && (
                          <input className="form-control mt-2" placeholder="Enter specialty" value={specForm.specialty} onChange={(e) => setSpecForm({ ...specForm, specialty: e.target.value })} />
                        )}
                      </div>

                      <div className="label">Education</div>
                      <div className="value">
                        {(specForm.education || []).map((edu, idx) => (
                          <div key={idx} className="d-flex align-items-center gap-2 mb-2">
                            <input className="form-control" value={edu} onChange={(e) => setSpecForm(prev => ({ ...prev, education: prev.education.map((x,i)=> i===idx ? e.target.value : x) }))} />
                            <button type="button" className="btn btn-outline-danger" onClick={() => setSpecForm(prev => ({ ...prev, education: prev.education.filter((_,i)=>i!==idx) }))}>Remove</button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-secondary" onClick={() => setSpecForm(prev => ({ ...prev, education: [...(prev.education||[]), ''] }))}>+ Add Education</button>
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
                  <h3>Clinic & Contact</h3>
                  {!contactEditing ? (
                    <div className="info-grid">
                      <div className="label">Clinic Address</div><div className="value">{doctor?.address1 || ''}</div>
                      <div className="label">Contact Number</div><div className="value">{doctor?.contact || `${countryCode} ${localNumber}`.trim()}</div>
                    </div>
                  ) : (
                    <div className="info-grid">
                      <div className="label">Clinic Address</div>
                      <div className="value"><input className="form-control" value={contactForm.address1} onChange={(e) => setContactForm({ ...contactForm, address1: e.target.value })} /></div>
                      <div className="label">Contact Number</div>
                      <div className="value">
                        <div className="d-flex gap-2">
                          <select className="form-select" style={{ maxWidth: 210 }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                            {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                          </select>
                          <input type="tel" inputMode="numeric" pattern="[0-9]*" className="form-control" placeholder="e.g., 9123456789" maxLength={LOCAL_MAX} value={localNumber} onChange={(e) => setLocalNumber(e.target.value.replace(/\D/g, '').slice(0, LOCAL_MAX))} />
                        </div>
                        <div className="form-text">Stores in international format (e.g., +64 221234567). Max {LOCAL_MAX} digits for the local number.</div>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {!contactEditing ? (
                      <button className="btn btn-outline-primary" onClick={() => { setContactEditing(true); setContactForm({ address1: doctor?.address1 || '', contact: doctor?.contact || '' }); }}>Edit</button>
                    ) : (
                      <>
                        <button className="btn btn-primary" onClick={saveContact} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        <button className="btn btn-secondary" onClick={() => { setContactEditing(false); setContactForm({ address1: doctor?.address1 || '', contact: doctor?.contact || '' }); setCountryCode('+63'); setLocalNumber(String(doctor?.contact || '').replace(/\D/g, '').slice(0, LOCAL_MAX)); }} disabled={saving}>Cancel</button>
                      </>
                    )}
                  </div>
                </div>

                {/* About */}
                <div className="profile-box">
                  <h3>About</h3>
                  {!aboutEditing ? (
                    <div className="medical-history" style={{ minHeight: 40 }}>
                      {doctor?.about ? (<p style={{ whiteSpace: 'pre-wrap' }}>{doctor.about}</p>) : (<p>No information provided.</p>)}
                    </div>
                  ) : (
                    <textarea className="form-control" rows={5} value={aboutForm.about} onChange={(e) => setAboutForm({ about: e.target.value })} />
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

                {(message || error) && <div className="alert alert-info mt-2">{message || error}</div>}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DocProfile;
