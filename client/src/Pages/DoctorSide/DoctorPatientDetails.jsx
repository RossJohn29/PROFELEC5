//DoctorPatientDetails.jsx
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiUrl } from '../../api/base'
import { LifeLine } from 'react-loading-indicators'
import Navbar from '../../SideBar/Navbar.jsx'
import '../../Styles/Ddashboard.css'
import '../../Styles/PatientProfile.css'

export default function DoctorPatientDetails() {
  const { email: encodedEmail } = useParams()
  const email = decodeURIComponent(encodedEmail || '')
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [patient, setPatient] = useState(null)

  useEffect(() => {
    if (!email) {
      setError('Missing patient email')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    axios.post(apiUrl('/patient/get-profile'), { email })
      .then(res => {
        const p = res.data?.patient
        if (!p) {
          setError('Patient not found')
          return
        }
        setPatient(p)
      })
      .catch(() => setError('Failed to load patient details'))
      .finally(() => setLoading(false))
  }, [email])

  const formatDate = (d) => {
    if (!d) return ''
    try { return new Date(d).toLocaleDateString() } catch { return '' }
  }

  return (
    <div className="doctor-page-wrapper">
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className={`dashboard ${sidebarOpen ? 'sidebar-open' : ''}`}>
         <main className="patientdetails-dashboard-main">
          <h2 style={{ 
            margin: '16px 0 16px 0',
            fontSize: '1.75rem',
            fontWeight: '600',
            color: '#2c3e50',
            textAlign: 'left',
            maxWidth: '1100px',
            marginLeft: 'auto',
            marginRight: 'auto',
            paddingLeft: '20px',
            paddingRight: '20px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            Patient Details
          </h2>

          {loading ? (
            <div className="card" style={{ padding: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
            </div>
          ) : error ? (
            <div className="card" style={{ padding: 16, color: 'red' }}>{error}</div>
          ) : !patient ? (
            <div className="card" style={{ padding: 16 }}>No data</div>
          ) : (
            <>
              <div className="patient-profile-container">
                {/* profile picture */}
                <div className="profile-box profile-image-box">
                  <h3>Profile Picture</h3>
                  <img
                    src={patient.profileImage || '/default-avatar.png'}
                    alt="Profile"
                    className="profile-img"
                  />
                </div>

                {/* patient information */}
                <div className="profile-box profile-info-box">
                  <h3>Patient Information</h3>
                  <div className="info-grid">
                    <div className="label">First Name</div><div className="value">{patient.firstName || ''}</div>
                    <div className="label">Last Name</div><div className="value">{patient.lastName || ''}</div>
                    <div className="label">Birthday</div><div className="value">{formatDate(patient.birthday)}</div>
                    <div className="label">Age</div><div className="value">{patient.age ?? ''}</div>
                    <div className="label">Gender</div><div className="value">{patient.gender || ''}</div>
                    <div className="label">Contact</div><div className="value">{patient.contact || ''}</div>
                    <div className="label">Address</div><div className="value">{patient.address || ''}</div>
                    <div className="label">Email</div><div className="value">{patient.email || ''}</div>
                    <div className="label">Emergency Contact Name</div><div className="value">{patient.emergencyName || ''}</div>
                    <div className="label">Emergency Contact Number</div><div className="value">{patient.emergencyContact || ''}</div>
                    <div className="label">Emergency Contact Address</div><div className="value">{patient.emergencyAddress || ''}</div>
                  </div>
                </div>

                {/* HMO number and card */}
                <div className="profile-box profile-hmo-box">
                  <h3>HMO Number and Card</h3>
                  <div className="hmo-inner">
                    <div className="hmo-left">
                      <p className="hmo-number"><strong>HMO Number:</strong> {patient.hmoNumber || 'Not available'}</p>
                    </div>
                    <div className="hmo-right">
                      {patient.hmoCardImage ? (
                        <img src={patient.hmoCardImage} alt="HMO Card" className="hmo-card-img" />
                      ) : (
                        <div className="hmo-card-placeholder">No HMO card uploaded</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* medical history */}
                <div className="profile-box profile-medbox">
                  <h3>Medical History</h3>
                  <div className="medical-history">
                    {patient.medicalHistory ? (
                      <p style={{ whiteSpace: 'pre-wrap' }}>{patient.medicalHistory}</p>
                    ) : (
                      <p>No medical history provided.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}