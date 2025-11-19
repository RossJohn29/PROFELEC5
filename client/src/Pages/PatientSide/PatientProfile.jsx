//PatientProfile.jsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiUrl } from '../../api/base'
import { LifeLine } from 'react-loading-indicators'
import PNavbar from '../../SideBar/PNavbar'
import '../../Styles/Ddashboard.css'
import '../../Styles/PatientProfile.css'
// removed pre-assessment local import; dashboard will manage pre-assessment UI

function PatientProfile() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [patient, setPatient] = useState(null)
  const [preview, setPreview] = useState('')
  const [hmoPreview, setHmoPreview] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [hmoEditing, setHmoEditing] = useState(false)
  const [hmoForm, setHmoForm] = useState({ hmoNumber: '', hmoCardImage: '' })
  const [savingHmo, setSavingHmo] = useState(false)
  const hmoOriginalRef = useRef('')
  const [medEditing, setMedEditing] = useState(false)
  const [medForm, setMedForm] = useState({ medicalHistory: '' })
  const [savingMed, setSavingMed] = useState(false)
  const navigate = useNavigate()
  // pre-assessment actions moved to Dashboard

  useEffect(() => {
    const email = localStorage.getItem('email')
    if (!email) {
      navigate('/login')
      return
    }
    setLoading(true)
    setError('')

  axios.post(apiUrl('/patient/get-profile'), { email })
      .then(res => {
        const p = res.data?.patient
        if (!p) {
          setError('No profile found. Please complete your profile.')
          return
        }
        setPatient(p)
        setPreview(p.profileImage || '')
        setHmoPreview(p.hmoCardImage || '')
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [navigate])

  // removed import/upload handlers; dashboard now owns pre-assessment actions

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleHmoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setHmoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const computeAge = (dateStr) => {
    if (!dateStr) return ''
    try {
      const today = new Date()
      const birthDate = new Date(dateStr)
      if (isNaN(birthDate.getTime())) return ''
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      return age >= 0 ? String(age) : '0'
    } catch {
      return ''
    }
  }

  const startEdit = () => {
    if (!patient) return
    setEditForm({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      email: patient.email || '',
      birthday: patient.birthday ? new Date(patient.birthday).toISOString().slice(0,10) : '',
      age: patient.age || '',
      gender: patient.gender || '',
      contact: patient.contact || '',
      address: patient.address || '',
      medicalHistory: patient.medicalHistory || '',
      hmoNumber: patient.hmoNumber || '',
      emergencyName: patient.emergencyName || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyAddress: patient.emergencyAddress || ''
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditForm(null)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'birthday') {
        next.age = computeAge(value)
      }
      return next
    })
  }

  const handleSaveProfile = async () => {
    if (!patient?.email || !editForm) return
    setSavingProfile(true)
    try {
      const payload = { email: patient.email, ...editForm }
  const res = await axios.post(apiUrl('/patient/profile'), payload)
      if (res.data && res.data.patient) {
        setPatient(res.data.patient)
        setPreview(res.data.patient.profileImage || preview)
        setHmoPreview(res.data.patient.hmoCardImage || hmoPreview)
        setEditing(false)
        setEditForm(null)
        setMessage('Profile saved successfully')
      } else {
        setError('Failed to save profile')
      }
    } catch (err) {
      console.error('Save profile error', err)
      setError('Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const startHmoEdit = () => {
    if (!patient) return
    // save/remember current preview so we it can restore if user cancels 
    hmoOriginalRef.current = hmoPreview || patient.hmoCardImage || ''
    setHmoForm({ hmoNumber: patient.hmoNumber || '', hmoCardImage: patient.hmoCardImage || hmoOriginalRef.current })
    setHmoEditing(true)
  }

  const cancelHmoEdit = () => {
    setHmoEditing(false)
    // restore preview to the original image before edit
    setHmoPreview(hmoOriginalRef.current || '')
    setHmoForm({ hmoNumber: '', hmoCardImage: '' })
  }

  const handleHmoChange = (e) => {
    const { name, value } = e.target
    setHmoForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveHmo = async () => {
    if (!patient?.email) return
    setSavingHmo(true)
    setMessage('')
    setError('')
    try {
      const payload = { email: patient.email, hmoNumber: hmoForm.hmoNumber, hmoCardImage: hmoPreview || hmoForm.hmoCardImage || '' }
  const res = await axios.post(apiUrl('/patient/profile'), payload)
      if (res.data && res.data.patient) {
        setPatient(res.data.patient)
        // update preview and original reference to the saved image
        const newPreview = res.data.patient.hmoCardImage || hmoPreview
        setHmoPreview(newPreview)
        hmoOriginalRef.current = newPreview
        setHmoEditing(false)
        setHmoForm({ hmoNumber: '', hmoCardImage: '' })
        setMessage('HMO info saved')
      } else {
        setError('Failed to save HMO info')
      }
    } catch (err) {
      console.error('Save HMO error', err)
      setError('Failed to save HMO info')
    } finally {
      setSavingHmo(false)
    }
  }

  const startMedEdit = () => {
    if (!patient) return
    setMedForm({ medicalHistory: patient.medicalHistory || '' })
    setMedEditing(true)
  }

  const cancelMedEdit = () => {
    setMedEditing(false)
    setMedForm({ medicalHistory: '' })
  }

  const handleMedChange = (e) => {
    const { name, value } = e.target
    setMedForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveMed = async () => {
    if (!patient?.email) return
    setSavingMed(true)
    setMessage('')
    setError('')
    try {
      const payload = { email: patient.email, medicalHistory: medForm.medicalHistory }
  const res = await axios.post(apiUrl('/patient/profile'), payload)
      if (res.data && res.data.patient) {
        setPatient(res.data.patient)
        setMedEditing(false)
        setMedForm({ medicalHistory: '' })
        setMessage('Medical history saved')
      } else {
        setError('Failed to save medical history')
      }
    } catch (err) {
      console.error('Save medical history error', err)
      setError('Failed to save medical history')
    } finally {
      setSavingMed(false)
    }
  }

  const handleSavePhoto = async () => {
    if (!patient?.email) return
    setMessage('')
    setError('')
    try {
  await axios.post(apiUrl('/patient/profile'), {
        email: patient.email,
        profileImage: preview || ''
      })
      setMessage('Profile picture saved')
    } catch {
      setError('Failed to save picture')
    }
  }

  const formatDate = (d) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString()
    } catch {
      return ''
    }
  }

  return (
    <div className="dashboard">
      <PNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="dashboard-main">
        <h2>Patient Profile</h2>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
          </div>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
<div className="patient-profile-container">
  {/* Pre-assessment actions moved to Dashboard (bottom). This profile view now focuses on patient info only. */}
  {/* profile picture */}
  <div className="profile-box profile-image-box">
    <h3>Profile Picture</h3>
    <img
      src={preview || '/default-avatar.png'}
      alt="Profile"
      className="profile-img"
    />
    <div className="profile-buttons">
      <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
        Change
        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
      </label>
      <button className="btn btn-primary" onClick={handleSavePhoto}>Save Photo</button>
    </div>
  </div>

  {/* patient information */}
  <div className="profile-box profile-info-box">
    <h3>Patient Information</h3>

    <div className="info-grid">
      {!editing ? (
        <>
          <div className="label">First Name</div><div className="value">{patient?.firstName || ''}</div>
        <div className="label">Last Name</div><div className="value">{patient?.lastName || ''}</div>
          <div className="label">Birthday</div><div className="value">{formatDate(patient?.birthday)}</div>
          <div className="label">Age</div><div className="value">{patient?.age ?? ''}</div>
          <div className="label">Gender</div><div className="value">{patient?.gender || ''}</div>
          <div className="label">Email</div><div className="value">{patient?.email || ''}</div>
          <div className="label">Contact</div><div className="value">{patient?.contact || ''}</div>
          <div className="label">Address</div><div className="value">{patient?.address || ''}</div>
          <div className="label">Emergency Contact Name</div><div className="value">{patient?.emergencyName || ''}</div>
          <div className="label">Emergency Contact Number</div><div className="value">{patient?.emergencyContact || ''}</div>
          <div className="label">Emergency Contact Address</div><div className="value">{patient?.emergencyAddress || ''}</div>
        </>
      ) : (
        <>
          <div className="label">First Name</div>
          <div className="value"><input name="firstName" value={editForm.firstName} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Last Name</div>
          <div className="value"><input name="lastName" value={editForm.lastName} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Birthday</div>
          <div className="value"><input type="date" name="birthday" value={editForm.birthday} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Age</div>
          <div className="value"><input name="age" value={editForm.age} readOnly className="form-control" /></div>

          <div className="label">Gender</div>
          <div className="value">
            <select name="gender" value={editForm.gender} onChange={handleEditChange} className="form-control">
              <option value="">Select</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="label">Email</div>
          <div className="value"><input name="email" value={editForm.email} readOnly className="form-control" /></div>

          <div className="label">Contact</div>
          <div className="value"><input name="contact" value={editForm.contact} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Address</div>
          <div className="value"><input name="address" value={editForm.address} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Emergency Contact Name</div>
          <div className="value"><input name="emergencyName" value={editForm.emergencyName} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Emergency Contact Number</div>
          <div className="value"><input name="emergencyContact" value={editForm.emergencyContact} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Emergency Contact Address</div>
          <div className="value"><input name="emergencyAddress" value={editForm.emergencyAddress} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">HMO Number</div>
          <div className="value"><input name="hmoNumber" value={editForm.hmoNumber} onChange={handleEditChange} className="form-control" /></div>

          <div className="label">Medical History</div>
          <div className="value"><textarea name="medicalHistory" value={editForm.medicalHistory} onChange={handleEditChange} className="form-control" rows={3} /></div>
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

  {/* HMO number and card */}
  <div className="profile-box profile-hmo-box">
    <h3>HMO Number and Card</h3>
    <div className="hmo-inner">
      <div className="hmo-left">
        {!hmoEditing ? (
          <p className="hmo-number"><strong>HMO Number:</strong> {patient?.hmoNumber || 'Not available'}</p>
        ) : (
          <div>
            <label className="form-label">HMO Number</label>
            <input name="hmoNumber" value={hmoForm.hmoNumber} onChange={handleHmoChange} className="form-control" />
          </div>
        )}
      </div>

      <div className="hmo-right">
        {!hmoEditing ? (
          (hmoPreview ? (
            <img src={hmoPreview} alt="HMO Card" className="hmo-card-img" />
          ) : (
            <div className="hmo-card-placeholder">No HMO card uploaded</div>
          ))
        ) : (
          <div>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              Change HMO Card
              <input type="file" accept="image/*" onChange={handleHmoUpload} style={{ display: 'none' }} />
            </label>
            <div style={{ marginTop: 8 }}>{hmoPreview ? <img src={hmoPreview} alt="HMO Preview" className="hmo-card-img" /> : <div className="hmo-card-placeholder">No HMO card uploaded</div>}</div>
          </div>
        )}
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
        {message && <div className="alert alert-info mt-3">{message}</div>}
      </div>
    </div>
  );
}

export default PatientProfile;
