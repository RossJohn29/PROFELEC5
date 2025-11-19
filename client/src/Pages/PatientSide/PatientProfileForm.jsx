//PatientProfileForm.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../../Styles/Calendar.css';
import '../../Styles/PatientProfileForm.css';

function PatientProfileForm() {
  const hmoInputRef = useRef(null);
  const [showBirthdayCalendar, setShowBirthdayCalendar] = useState(false);
  
  // Phone number helpers
  const COUNTRY_CODES = [
    { code: '+63', label: '🇵🇭 Philippines (+63)' },
  
  ];
  const LOCAL_MAX = 10;
  const [countryCode, setCountryCode] = useState('+63');
  const [localNumber, setLocalNumber] = useState('');
  const [emergencyCountryCode, setEmergencyCountryCode] = useState('+63');
  const [emergencyLocalNumber, setEmergencyLocalNumber] = useState('');
  const [contactError, setContactError] = useState('');
  const [emergencyContactError, setEmergencyContactError] = useState('');
  const [ageError, setAgeError] = useState('');
  
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    birthday: '',
    age: '',
    gender: '',
    contact: '',
    address: '',
    medicalHistory: '',
    hmoNumber: '',
    emergencyName: '',
    emergencyContact: '',
    emergencyAddress: '',
    hmoCardImage: '',
  });
  const [hmoPreview, setHmoPreview] = useState('');
  const [showHmoOptions, setShowHmoOptions] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // to redirect to pdashboard


// Computes Age
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
    } catch (error) {
      console.error('Error calculating age:', error);
      return '';
    }
  };

// Validate if patient is at least 10 years old
  const validateAge = (dateStr) => {
    if (!dateStr) return false;
    const age = parseInt(computeAge(dateStr), 10);
    return age >= 10;
  };

  const validatePhilippineNumber = (countryCode, localNumber) => {
  // Check if country code is +63
  if (countryCode !== '+63') {
    console.log('Validation failed: Invalid country code', countryCode);
    return false;
  }
  
  // Check if local number is exactly 10 digits
  if (localNumber.length !== 10) {
    console.log('Validation failed: Local number length is', localNumber.length, 'instead of 10');
    return false;
  }
  
  // Check if local number starts with 9 (Philippine mobile numbers)
  if (!localNumber.startsWith('9')) {
    console.log('Validation failed: Local number does not start with 9', localNumber);
    return false;
  }
  
  console.log('Validation passed:', countryCode + localNumber);
  return true;
};

// Add this handler for contact number validation
  const handleContactBlur = () => {
    if (localNumber) {
      const isValid = validatePhilippineNumber(countryCode, localNumber);
      if (!isValid) {
        setContactError('Please enter a valid Philippine contact number (e.g., +639123456789).');
        console.log('Contact validation error triggered');
      } else {
        setContactError('');
        console.log('Contact validation passed');
      }
    }
  };

  // Add this handler for emergency contact validation
  const handleEmergencyContactBlur = () => {
      if (emergencyLocalNumber) {
        const isValid = validatePhilippineNumber(emergencyCountryCode, emergencyLocalNumber);
        if (!isValid) {
          setEmergencyContactError('Please enter a valid Philippine contact number (e.g., +639123456789).');
          console.log('Emergency contact validation error triggered');
        } else {
          setEmergencyContactError('');
          console.log('Emergency contact validation passed');
        }
      }
  };

  useEffect(() => {
    const nextAge = computeAge(form.birthday);
    if (nextAge !== form.age) {
      setForm(prev => ({ ...prev, age: nextAge }));
      
      // Validate age immediately when birthday changes
      if (form.birthday && !validateAge(form.birthday)) {
        setAgeError('Patient must be at least 10 years old.');
      } else {
        setAgeError('');
      }
    }
  }, [form.birthday]);

  useEffect(() => {
    const email = localStorage.getItem('email');
    
    if (!email) {
      console.error('[ProfileForm] No email found in localStorage, redirecting to login');
      navigate('/login');
      return;
    }

    console.log('[ProfileForm] Fetching profile for email:', email);

    // Fetch patient profile
    axios.post(apiUrl('/patient/get-profile'), { email })
      .then(res => {
        console.log('[ProfileForm] Profile fetch response:', res.data);
        
        const patient = res.data.patient; 
        
        if (patient) {
          console.log('[ProfileForm] Patient data found:', {
            hasFirstName: !!patient.firstName,
            hasLastName: !!patient.lastName,
            hasName: !!patient.name,
            firstName: patient.firstName,
            lastName: patient.lastName
          });

          // Parse name field as fallback if firstName/lastName are missing
          let firstName = patient.firstName || '';
          let lastName = patient.lastName || '';
          
          // If firstName/lastName are empty but name exists, split the name
          if ((!firstName || !lastName) && patient.name) {
            const nameParts = patient.name.trim().split(/\s+/);
            if (nameParts.length > 0 && !firstName) {
              firstName = nameParts[0];
              console.log('[ProfileForm] Extracted firstName from name field:', firstName);
            }
            if (nameParts.length > 1 && !lastName) {
              lastName = nameParts.slice(1).join(' ');
              console.log('[ProfileForm] Extracted lastName from name field:', lastName);
            }
          }

          // Prefill form with existing values
          setForm({
            firstName: firstName,
            lastName: lastName,
            birthday: patient.birthday ? new Date(patient.birthday).toISOString().slice(0, 10) : '',
            age: patient.age || '',
            gender: patient.gender || '',
            contact: patient.contact || '',
            address: patient.address || '',
            medicalHistory: patient.medicalHistory || '',
            hmoNumber: patient.hmoNumber || '',
            emergencyName: patient.emergencyName || '',
            emergencyContact: patient.emergencyContact || '',
            emergencyAddress: patient.emergencyAddress || '',
          });

          console.log('[ProfileForm] Form pre-filled with:', {
            firstName,
            lastName,
            hasOtherFields: !!(patient.age || patient.gender || patient.contact)
          });

          // Load existing HMO card preview
          if (patient.hmoCardImage) {
            setHmoPreview(patient.hmoCardImage);
            console.log('[ProfileForm] HMO card image loaded');
          }
          
          // Parse contact phone number
          if (patient.contact) {
            try {
              const match = patient.contact.match(/^(\+\d{1,4})\s*(.*)$/);
              if (match) {
                setCountryCode(match[1]);
                setLocalNumber(match[2].replace(/\D/g, '').slice(0, LOCAL_MAX));
                console.log('[ProfileForm] Contact parsed:', { countryCode: match[1], localLength: match[2].length });
              } else {
                setLocalNumber(patient.contact.replace(/\D/g, '').slice(0, LOCAL_MAX));
                console.log('[ProfileForm] Contact parsed (no country code)');
              }
            } catch (err) {
              console.error('[ProfileForm] Error parsing contact:', err);
            }
          }
          
          // Parse emergency contact phone number
          if (patient.emergencyContact) {
            try {
              const match = patient.emergencyContact.match(/^(\+\d{1,4})\s*(.*)$/);
              if (match) {
                setEmergencyCountryCode(match[1]);
                setEmergencyLocalNumber(match[2].replace(/\D/g, '').slice(0, LOCAL_MAX));
                console.log('[ProfileForm] Emergency contact parsed:', { countryCode: match[1] });
              } else {
                setEmergencyLocalNumber(patient.emergencyContact.replace(/\D/g, '').slice(0, LOCAL_MAX));
                console.log('[ProfileForm] Emergency contact parsed (no country code)');
              }
            } catch (err) {
              console.error('[ProfileForm] Error parsing emergency contact:', err);
            }
          }
        } else {
          console.warn('[ProfileForm] No patient data returned from server');
          // For brand new patients, the form will remain empty - that's OK
        }
      })
      .catch(err => {
        console.error('[ProfileForm] Error fetching profile:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        
        // Show user-friendly error message
        setMessage('Error loading profile. Please try refreshing the page.');
      });
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleBirthdaySelect = (date) => {
    // Convert Date object to YYYY-MM-DD format
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    // Validate age before setting
    if (!validateAge(dateStr)) {
      setAgeError('Patient must be at least 10 years old.');
      setForm({ ...form, birthday: dateStr });
    } else {
      setAgeError('');
      setForm({ ...form, birthday: dateStr });
    }
    
    setShowBirthdayCalendar(false);
  };

  const handleHmoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setHmoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveHmo = () => {
    setHmoPreview('');
    if (hmoInputRef.current) {
      hmoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate age before submission
    if (!form.birthday) {
      setAgeError('Please select your birthday');
      return;
    }
    
    if (!validateAge(form.birthday)) {
      setAgeError('Patient must be at least 10 years old.');
      return;
    }
    
    // Validate contact number before submission
    const isContactValid = validatePhilippineNumber(countryCode, localNumber);
    const isEmergencyContactValid = validatePhilippineNumber(emergencyCountryCode, emergencyLocalNumber);
    
    if (!isContactValid) {
      setContactError('Please enter a valid Philippine contact number (e.g., +639123456789).');
      console.log('Form submission blocked: Invalid contact number');
      return;
    }
    
    if (!isEmergencyContactValid) {
      setEmergencyContactError('Please enter a valid Philippine contact number (e.g., +639123456789).');
      console.log('Form submission blocked: Invalid emergency contact number');
      return;
    }
    
    console.log('All validations passed, submitting form...');
    
    try {
      const email = localStorage.getItem('email');
      
      // Format phone numbers
      const fullContact = `${countryCode} ${localNumber}`.trim();
      const fullEmergencyContact = `${emergencyCountryCode} ${emergencyLocalNumber}`.trim();
      
      // HMO preview
      const submitForm = { 
        ...form, 
        email, 
        contact: fullContact,
        emergencyContact: fullEmergencyContact,
        hmoCardImage: hmoPreview 
      };
      
      const res = await axios.post(apiUrl('/patient/profile'), submitForm);
      setMessage('Profile saved successfully!');
      console.log('Profile saved successfully');
      setTimeout(() => navigate('/PatientDashboard'), 1000);
    } catch (err) {
      setMessage('Error saving profile.');
      console.error('Error saving profile:', err);
    }
  };


  return (
    <div className="patient-form-page">
      <div className="container mt-5">
      <h1 className="mb-4 text-center">Patient Profile Form</h1>
      <div className="patient-form-divider"></div>
      <form onSubmit={handleSubmit} className="p-4 border rounded bg-light">
        <div className="mb-3">
          <label className="form-label">First Name</label>
          <input type="text" className="form-control" name="firstName" value={form.firstName} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Last Name</label>
          <input type="text" className="form-control" name="lastName" value={form.lastName} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Birthday</label>
          <div className="birthday-field">
            <input
              type="text"
              className={`form-control birthday-input ${ageError ? 'is-invalid invalid' : 'valid'} ${form.birthday ? 'has-value' : 'no-value'}`}
              value={form.birthday}
              onClick={() => setShowBirthdayCalendar(!showBirthdayCalendar)}
              readOnly
              placeholder="Click to select your birthday"
            />
            {showBirthdayCalendar && (
              <div className="calendar-popup">
                <Calendar
                  onChange={handleBirthdaySelect}
                  value={form.birthday ? new Date(form.birthday) : new Date()}
                  maxDate={new Date()}
                />
              </div>
            )}
          </div>
          {ageError && (
            <div className="validation-error">
              {ageError}
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label">Age</label>
          <input type="number" className="form-control" name="age" value={form.age} readOnly required />
        </div>
        <div className="mb-3">
          <label className="form-label">Gender</label>
          <select className="form-select" name="gender" value={form.gender} onChange={handleChange} required>
            <option value="">Select gender</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Contact Number</label>
          <div className="d-flex gap-2">
            <select 
              className="form-select" 
              style={{ maxWidth: 210 }} 
              value={countryCode} 
              onChange={(e) => {
                setCountryCode(e.target.value);
                if (localNumber) handleContactBlur();
              }}
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input 
              type="tel" 
              inputMode="numeric"
              pattern="[0-9]*"
              className={`form-control ${contactError ? 'is-invalid' : ''}`}
              placeholder="e.g., 9123456789" 
              maxLength={LOCAL_MAX}
              value={localNumber} 
              onChange={(e) => {
                const newValue = e.target.value.replace(/\D/g, '').slice(0, LOCAL_MAX);
                setLocalNumber(newValue);
                if (contactError && newValue.length === 10 && newValue.startsWith('9')) {
                  setContactError('');
                }
              }}
              onBlur={handleContactBlur}
              required 
              style={contactError ? { borderColor: '#dc3545', borderWidth: '2px' } : {}}
            />
          </div>
          {contactError && (
            <div className="text-danger mt-1" style={{ fontSize: '0.875rem' }}>
              {contactError}
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label">Address</label>
          <input type="text" className="form-control" name="address" value={form.address} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Medical History</label>
          <textarea className="form-control" name="medicalHistory" value={form.medicalHistory} onChange={handleChange} rows={3} />
        </div>
        <div className="mb-3">
          <label className="form-label">HMO Number</label>
          <input type="text" className="form-control" name="hmoNumber" value={form.hmoNumber} onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="form-label">HMO Card</label>
        </div>
        <div className="hmo-upload-container">
          <input
            type="file"
            accept="image/*"
            onChange={handleHmoUpload}
            style={{ display: 'none' }}
            ref={hmoInputRef}
            id="hmo-upload-input"
          />
          {!hmoPreview ? (
            <label htmlFor="hmo-upload-input" className="hmo-upload-box">
              <span className="hmo-plus">+</span>
            </label>
          ) : (
            <div
              className="hmo-upload-box hmo-has-image"
              style={{ backgroundImage: `url(${hmoPreview})` }}
              onMouseEnter={() => setShowHmoOptions(true)}
              onMouseLeave={() => setShowHmoOptions(false)}
            >
              {showHmoOptions && (
                <div className="hmo-options">
                  <label htmlFor="hmo-upload-input" className="hmo-option-btn">Change</label>
                  <button type="button" className="hmo-option-btn" onClick={handleRemoveHmo}>Remove</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label">Emergency Contact Information</label>
        </div>
        <div className="mb-3">
          <label className="form-label">Name</label>
          <input type="text" className="form-control" name="emergencyName" value={form.emergencyName} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Contact Number</label>
          <div className="d-flex gap-2">
            <select 
              className="form-select" 
              style={{ maxWidth: 210 }} 
              value={emergencyCountryCode} 
              onChange={(e) => {
                setEmergencyCountryCode(e.target.value);
                if (emergencyLocalNumber) handleEmergencyContactBlur();
              }}
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input 
              type="tel" 
              inputMode="numeric"
              pattern="[0-9]*"
              className={`form-control ${emergencyContactError ? 'is-invalid' : ''}`}
              placeholder="e.g., 9123456789" 
              maxLength={LOCAL_MAX}
              value={emergencyLocalNumber} 
              onChange={(e) => {
                const newValue = e.target.value.replace(/\D/g, '').slice(0, LOCAL_MAX);
                setEmergencyLocalNumber(newValue);
                if (emergencyContactError && newValue.length === 10 && newValue.startsWith('9')) {
                  setEmergencyContactError('');
                }
              }}
              onBlur={handleEmergencyContactBlur}
              required 
              style={emergencyContactError ? { borderColor: '#dc3545', borderWidth: '2px' } : {}}
            />
          </div>
          {emergencyContactError && (
            <div className="text-danger mt-1" style={{ fontSize: '0.875rem' }}>
              {emergencyContactError}
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label">Address</label>
          <input type="text" className="form-control" name="emergencyAddress" value={form.emergencyAddress} onChange={handleChange} required />
        </div>
        <button type="submit" className="btn btn-primary">Save Profile</button>
      </form>
      {message && <div className="alert alert-info mt-3">{message}</div>}
      </div>
    </div>
  );
}

export default PatientProfileForm;
