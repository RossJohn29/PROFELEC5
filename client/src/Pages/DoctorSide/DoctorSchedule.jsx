// DoctorSchedule.jsx
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../../api/base';
import Navbar from '../../SideBar/Navbar.jsx';
import '../../Styles/Ddashboard.css';
import '../../Styles/DoctorProfile.css';
import '../../Styles/Calendar.css';
import '../../Styles/DoctorSchedule.css';
import CalendarC from '../../Calendar/CalendarC.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

function DoctorSchedule() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const nowHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  };
  const roundUpHHMM = (hhmm, step = 5) => {
    try {
      const [h, m] = hhmm.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
      const mins = h * 60 + m;
      const rounded = Math.ceil(mins / step) * step;
      const capped = Math.min(rounded, (24 * 60) - 1);
      const hh = String(Math.floor(capped / 60)).padStart(2, '0');
      const mm = String(capped % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch { return hhmm; }
  };

  // doctor identity
  const [doctorEmail, setDoctorEmail] = useState('');
  const [ownDoctor, setOwnDoctor] = useState(null);
  const [listed, setListed] = useState(false);
  const [pendingListed, setPendingListed] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // availability state
  const [availDate, setAvailDate] = useState(() => toYMD(new Date()));
  const [ranges, setRanges] = useState([{ start: '09:00', end: '10:30' }]);
  const [avLoading, setAvLoading] = useState(false);
  const [bulkDays, setBulkDays] = useState(5);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  // Add these new state variables after the existing ones
  const [submittedRanges, setSubmittedRanges] = useState([]); // Track submitted ranges
  const [editingIndex, setEditingIndex] = useState(null); // Track which range is being edited
  const [pendingSave, setPendingSave] = useState(false);

  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('theme') || 'light');
    window.addEventListener('storage', handleTheme);
    window.addEventListener('themeChange', handleTheme);
    return () => {
      window.removeEventListener('storage', handleTheme);
      window.removeEventListener('themeChange', handleTheme);
    };
  }, []);

  // Fetch doctor email/profile
  useEffect(() => {
    const email = localStorage.getItem('doctorEmail') || localStorage.getItem('email');
    if (!email) {
      setMessage('Doctor email missing. Please login again.');
      return;
    }
    axios.post(apiUrl('/doctor/get-profile'), { email })
      .then(res => {
        const doctor = res.data?.doctor;
        const finalEmail = doctor?.email || email;
        setDoctorEmail(finalEmail);
        if (doctor) {
          setOwnDoctor(doctor);
          setListed(doctor.listed === true);
        }
      })
      .catch(() => setDoctorEmail(email));
  }, []);

  const toggleListed = async () => {
    if (!doctorEmail) {
      showToast('Doctor identity missing. Please login again.', 'error');
      return;
    }
    const newListed = !listed;
    setPendingListed(true);
    try {
      const res = await axios.post(apiUrl('/doctor/listed'), { email: doctorEmail, listed: newListed });
      if (res.data && res.data.status === 'success' && res.data.doctor) {
        setOwnDoctor(res.data.doctor);
        setListed(res.data.doctor.listed === true);
        showToast(newListed ? 'You are now visible to patients.' : 'You are no longer listed publicly.', 'success');
      } else {
        console.error('Failed to update listing:', res.data);
        showToast('Unable to update listing. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Listing toggle error:', e);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setPendingListed(false);
    }
  };

  const loadAvailability = async (ymd) => {
    if (!doctorEmail || !ymd) return;
    console.log('[loadAvailability] Loading for date:', ymd, 'doctor:', doctorEmail);
    setAvLoading(true);
    try {
      const res = await axios.get(apiUrl('/doctor/availability'), { params: { email: doctorEmail, date: ymd } });
      console.log('[loadAvailability] Response:', res.data);
      const r = res.data?.availability?.ranges || [];
      console.log('[loadAvailability] Loaded ranges:', r);
      setRanges(r.length ? r : []);
      // Mark all loaded ranges as submitted (green)
      setSubmittedRanges(r.length ? r.map((_, idx) => idx) : []);
      setEditingIndex(null); // Reset editing state
    } catch (err) {
      console.error('[loadAvailability] Error:', err);
      setRanges([]);
      setSubmittedRanges([]);
    } finally {
      setAvLoading(false);
    }
  };

  const addRange = () => {
    console.log('[addRange] Adding new range');
    const newIndex = ranges.length;
    setRanges(prev => [...prev, { start: '09:00', end: '10:00' }]);
    // New ranges are not submitted and not in editing mode
    // They will be saved via the main "Save Availability" button
    console.log('[addRange] New range added at index:', newIndex, 'waiting for Save Availability');
  };

  const updateRange = (i, key, val) => {
    console.log('[updateRange] Updating range', i, key, '=', val);
    
    const isSubmitted = submittedRanges.includes(i);
    const isEditing = editingIndex === i;
    
    // Allow updates if:
    // 1. Range is not submitted (new range)
    // 2. Range is submitted but currently being edited
    if (isSubmitted && !isEditing) {
      console.warn('[updateRange] Cannot update submitted range without clicking Edit first');
      showToast('Please click Edit button to modify this schedule.', 'error');
      return;
    }
    
    setRanges(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
    console.log('[updateRange] Range updated successfully');
  };

  const removeRange = async (i) => {
    console.log('[removeRange] Deleting range at index:', i);
    const rangeToDelete = ranges[i];
    
    if (!rangeToDelete) {
      console.error('[removeRange] No range found at index', i);
      return;
    }

    console.log('[removeRange] Range to delete:', rangeToDelete);

    // Optimistically update UI
    const newRanges = ranges.filter((_, idx) => idx !== i);
    const newSubmittedIndices = submittedRanges
      .filter(idx => idx !== i)
      .map(idx => idx > i ? idx - 1 : idx); // Adjust indices after removal
    
    setRanges(newRanges);
    setSubmittedRanges(newSubmittedIndices);
    
    // Reset editing index if we're deleting the range being edited
    if (editingIndex === i) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > i) {
      setEditingIndex(editingIndex - 1);
    }

    try {
      console.log('[removeRange] Saving updated ranges to backend:', newRanges);
      const payload = { 
        email: doctorEmail, 
        date: availDate, 
        ranges: newRanges 
      };

      const res = await axios.post(apiUrl('/doctor/availability'), payload);
      console.log('[removeRange] Backend response:', res.data);
      
      if (res.data?.status === 'success') {
        showToast('Schedule deleted successfully.', 'success');
        console.log('[removeRange] Delete successful');
      } else {
        console.error('[removeRange] Backend returned non-success status:', res.data);
        // Revert on failure
        setRanges(ranges);
        setSubmittedRanges(submittedRanges);
        if (editingIndex === i) setEditingIndex(i);
        else if (editingIndex !== null && editingIndex > i) setEditingIndex(editingIndex + 1);
        showToast('Failed to delete schedule.', 'error');
      }
    } catch (e) {
      console.error('[removeRange] Error deleting schedule:', e);
      console.error('[removeRange] Error response:', e?.response?.data);
      // Revert on error
      setRanges(ranges);
      setSubmittedRanges(submittedRanges);
      if (editingIndex === i) setEditingIndex(i);
      else if (editingIndex !== null && editingIndex > i) setEditingIndex(editingIndex + 1);
      showToast(e?.response?.data?.message || 'Error deleting schedule.', 'error');
    }
  };

  const saveEditedRange = async (i) => {
    console.log('[saveEditedRange] Saving edited range at index:', i);
    
    if (i < 0 || i >= ranges.length) {
      console.error('[saveEditedRange] Invalid index:', i);
      return;
    }
    
    // Validate the specific range
    const range = ranges[i];
    if (!isValidRange(range)) {
      console.warn('[saveEditedRange] Invalid range:', range);
      showToast('Invalid time range. Ensure start time is before end time.', 'error');
      return;
    }
    
    // Check for duplicates with other ranges
    for (let j = 0; j < ranges.length; j++) {
      if (i !== j) {
        const otherRange = ranges[j];
        if (range.start === otherRange.start && range.end === otherRange.end) {
          console.warn('[saveEditedRange] Duplicate range detected');
          showToast('This time slot already exists.', 'error');
          return;
        }
      }
    }
    
    setPendingSave(true);
    
    try {
      const picked = new Date(availDate);
      picked.setHours(0, 0, 0, 0);
      
      if (picked < todayStart) {
        console.warn('[saveEditedRange] Cannot save for past date');
        showToast('Cannot set availability for past dates.', 'error');
        setPendingSave(false);
        return;
      }
      
      let payloadRanges = [...ranges];
      let partialToday = false;
      
      if (picked.getTime() === todayStart.getTime()) {
        const now = nowHHMM();
        console.log('[saveEditedRange] Checking range for today, current time:', now);
        
        if (range.end <= now) {
          console.warn('[saveEditedRange] Range is in the past');
          showToast('This time range is in the past for today.', 'error');
          setPendingSave(false);
          return;
        }
        
        if (range.start < now) {
          partialToday = true;
        }
      }
      
      console.log('[saveEditedRange] Saving all ranges to backend:', payloadRanges);
      const payload = { email: doctorEmail, date: availDate, ranges: payloadRanges };
      const res = await axios.post(apiUrl('/doctor/availability'), payload);
      console.log('[saveEditedRange] Backend response:', res.data);
      
      if (res.data?.status === 'success') {
        // Mark this range as submitted
        if (!submittedRanges.includes(i)) {
          setSubmittedRanges(prev => [...prev, i]);
        }
        setEditingIndex(null);
        console.log('[saveEditedRange] Save successful, range marked as submitted');
        
        if (partialToday) {
          const from = roundUpHHMM(nowHHMM());
          showToast(`Schedule updated! For today, patients will see times from ${from} onward.`, 'success');
        } else {
          showToast('Schedule updated successfully!', 'success');
        }
      } else {
        console.error('[saveEditedRange] Backend returned non-success status:', res.data);
        showToast('Error updating schedule.', 'error');
      }
    } catch (e) {
      console.error('[saveEditedRange] Error:', e);
      console.error('[saveEditedRange] Error response:', e?.response?.data);
      showToast(e?.response?.data?.message || 'Error updating schedule.', 'error');
    } finally {
      setPendingSave(false);
    }
  };

  const setPreset = (type) => {
    console.log('[setPreset] Setting preset:', type);
    
    let presetRange = { start: '09:00', end: '10:00' };
    switch (type) {
      case 'morning': presetRange = { start: '09:00', end: '12:00' }; break;
      case 'afternoon': presetRange = { start: '13:00', end: '17:00' }; break;
      case 'fullday': presetRange = { start: '09:00', end: '17:00' }; break;
    }
    
    // Determine target index for preset
    let targetIndex = -1;
    
    if (ranges.length === 0) {
      // No ranges exist, create a new one
      console.log('[setPreset] No ranges exist, adding new range with preset');
      setRanges([presetRange]);
      setSubmittedRanges([]);
      setEditingIndex(null);
      showToast('Preset applied to new slot.', 'success');
      return;
    }
    
    // Priority 1: Apply to the range currently being edited
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < ranges.length) {
      targetIndex = editingIndex;
      console.log('[setPreset] Applying to currently editing range:', targetIndex);
    } else {
      // Priority 2: Apply to the most recently added non-submitted range (last in list)
      for (let i = ranges.length - 1; i >= 0; i--) {
        if (!submittedRanges.includes(i)) {
          targetIndex = i;
          console.log('[setPreset] Found most recent non-submitted range:', targetIndex);
          break;
        }
      }
    }
    
    // If all ranges are submitted and none is being edited, show error
    if (targetIndex === -1) {
      console.warn('[setPreset] All ranges are submitted and none is being edited');
      showToast('Please add a new slot or click Edit on an existing schedule to apply preset.', 'error');
      return;
    }
    
    // Apply preset to target range
    console.log('[setPreset] Applying preset to index', targetIndex, ':', presetRange);
    setRanges(prev => prev.map((r, idx) => idx === targetIndex ? presetRange : r));
    showToast(`Preset applied to slot ${targetIndex + 1}.`, 'success');
  };

  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'save' | 'bulk'

  const executeSave = async () => {
    try {
      console.log('[executeSave] Starting save process');
      console.log('[executeSave] Current ranges:', ranges);
      
      // Validation: Check if there are schedules
      if (ranges.length === 0) {
        console.warn('[executeSave] No ranges to save');
        showToast('Please add at least one valid schedule before saving.', 'error');
        return;
      }

      // Validation: Check for duplicates
      if (hasDuplicateSchedules()) {
        console.warn('[executeSave] Duplicate schedules detected');
        showToast('Duplicate schedule detected. Please remove overlapping time slots.', 'error');
        return;
      }

      // Validation: Check all ranges are valid
      if (!hasValidSchedules()) {
        console.warn('[executeSave] Invalid schedules detected');
        showToast('Invalid time range detected. Ensure start time is before end time.', 'error');
        return;
      }

      const picked = new Date(availDate); 
      picked.setHours(0,0,0,0);
      if (picked < todayStart) { 
        console.warn('[executeSave] Cannot save for past date');
        showToast('Cannot set availability for past dates.', 'error');
        return; 
      }

      let payloadRanges = ranges; 
      let partialToday = false;
      if (picked.getTime() === todayStart.getTime()) {
        const now = nowHHMM();
        console.log('[executeSave] Filtering ranges for today, current time:', now);
        payloadRanges = ranges.filter(r => r.end > now);
        partialToday = payloadRanges.some(r => r.start < now && r.end > now);
        if (payloadRanges.length === 0) {
          console.warn('[executeSave] All ranges in the past');
          showToast('All time ranges are in the past for today.', 'error');
          return; 
        }
      }

      console.log('[executeSave] Payload ranges:', payloadRanges);
      const payload = { email: doctorEmail, date: availDate, ranges: payloadRanges };
      const res = await axios.post(apiUrl('/doctor/availability'), payload);
      console.log('[executeSave] Backend response:', res.data);
      
      if (res.data?.status === 'success') {
        // Mark all current ranges as submitted (green)
        setSubmittedRanges(ranges.map((_, idx) => idx));
        setEditingIndex(null);
        console.log('[executeSave] Save successful, all ranges marked as submitted');
        
        if (partialToday) {
          const from = roundUpHHMM(nowHHMM());
          showToast(`For today, patients will only see times from ${from} onward.`, 'success');
        } else {
          showToast('Availability saved successfully!', 'success');
        }
      } else {
        console.error('[executeSave] Backend returned non-success status:', res.data);
        showToast('Error saving availability.', 'error');
      }
    } catch (e) {
      console.error('[executeSave] Error:', e);
      console.error('[executeSave] Error response:', e?.response?.data);
      showToast(e?.response?.data?.message || 'Error saving availability.', 'error');
    }
  };

  const saveAvailability = () => {
    setPendingAction('save');
    setConfirmSaveOpen(true);
  };

// Validation helpers
  const hasValidSchedules = () => {
    return ranges.length > 0 && ranges.every(r => isValidRange(r));
  };

  const hasDuplicateSchedules = () => {
    const seen = new Set();
    for (const r of ranges) {
      const key = `${r.start}-${r.end}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  };

  const isValidRange = (r) => {
    return (
      /^\d{2}:\d{2}$/.test(r.start) &&
      /^\d{2}:\d{2}$/.test(r.end) &&
      toMinutes(r.end) > toMinutes(r.start)
    );
  };

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const executeBulk = async () => {
    try {
      // Validation: Check if there are schedules
      if (ranges.length === 0) {
        showToast('Please add at least one valid schedule before applying bulk.', 'error');
        return;
      }

      // Validation: Check for duplicates
      if (hasDuplicateSchedules()) {
        showToast('Duplicate schedule detected. Please remove overlapping time slots.', 'error');
        return;
      }

      // Validation: Check all ranges are valid
      if (!hasValidSchedules()) {
        showToast('Please select a valid time range before applying bulk schedule.', 'error');
        return;
      }

      const base = new Date(availDate); 
      base.setHours(0,0,0,0);
      const dates = [];
      const days = Math.max(1, Number(bulkDays) || 1);
      for (let i = 1; i <= days; i++) {
        const d = new Date(base); 
        d.setDate(base.getDate() + i);
        if (d >= todayStart) dates.push(toYMD(d));
      }
      if (dates.length === 0) { 
        showToast('No future days to apply.', 'error');
        return; 
      }

      const payload = { email: doctorEmail, dates, ranges };
      const res = await axios.post(apiUrl('/doctor/availability/bulk'), payload);
      if (res.data?.status === 'success') {
        showToast(`Applied to ${res.data.updated} day(s) successfully!`, 'success');
      } else {
        showToast('Bulk apply failed.', 'error');
      }
    } catch (e) { 
      showToast(e?.response?.data?.message || 'Bulk apply failed.', 'error');
    }
  };

  const applyToNextNDays = () => {
    setPendingAction('bulk');
    setConfirmSaveOpen(true);
  };

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const executeClearAll = async () => {
    console.log('[executeClearAll] Clearing all schedules');
    try {
      const payload = { 
        email: doctorEmail, 
        date: availDate, 
        ranges: [] 
      };

      console.log('[executeClearAll] Sending payload:', payload);
      const res = await axios.post(apiUrl('/doctor/availability'), payload);
      console.log('[executeClearAll] Backend response:', res.data);
      
      if (res.data?.status === 'success') {
        setRanges([]);
        setSubmittedRanges([]);
        setEditingIndex(null);
        showToast('All schedules cleared successfully.', 'success');
        console.log('[executeClearAll] Clear successful');
      } else {
        console.error('[executeClearAll] Backend returned non-success status:', res.data);
        showToast('Failed to clear schedules.', 'error');
      }
    } catch (e) {
      console.error('[executeClearAll] Error:', e);
      console.error('[executeClearAll] Error response:', e?.response?.data);
      showToast(e?.response?.data?.message || 'Error clearing schedules.', 'error');
    }
  };

  const toggleEdit = (i) => {
    console.log('[toggleEdit] Toggling edit for index:', i);
    
    const isSubmitted = submittedRanges.includes(i);
    
    if (!isSubmitted) {
      console.warn('[toggleEdit] Cannot edit a non-submitted range');
      showToast('This schedule is not yet saved. Use "Save Availability" button first.', 'error');
      return;
    }
    
    if (editingIndex === i) {
      // Cancel editing - revert changes by reloading
      console.log('[toggleEdit] Cancelling edit, reloading availability');
      loadAvailability(availDate);
    } else {
      // Start editing
      setEditingIndex(i);
      console.log('[toggleEdit] Started editing range:', i);
    }
  };

  useEffect(() => { if (doctorEmail && availDate) loadAvailability(availDate); }, [doctorEmail, availDate]);

  return (
    <div className={`doctor-page-wrapper ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <Navbar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <div className={`doctor-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <main className="doctor-main">
          <div className="doctor-schedule-page">
            {/* Modern Header */}
            <div className="schedule-header">
              <div className="header-content">
                <h1 className="schedule-title">Schedule Management</h1>
                <p className="schedule-subtitle">Set your availability and manage appointment slots</p>
              </div>
              <div className="header-actions">
                <div className="optin-control">
                  <div className="optin-label">Public Directory</div>
                  <div className="optin-status">{listed ? 'Visible to patients' : 'Hidden from patients'}</div>
                  <button
                    type="button"
                    className={`btn-modern btn-optin ${listed ? 'opted' : 'not-opted'}`}
                    onClick={toggleListed}
                    disabled={pendingListed}
                    title={listed ? 'Hide from public directory' : 'Show in public directory'}
                  >
                    {pendingListed ? '...' : (listed ? '− Hide' : '+ List')}
                  </button>
                </div>
              </div>
            </div>

            {/* Toast Notification */}
            {toast.show && (
              <div className={`toast-notification toast-${toast.type}`}>
                <div className="toast-content">
                  <span className="toast-icon">{toast.type === 'success' ? '✓' : '⚠'}</span>
                  <span className="toast-message">{toast.message}</span>
                </div>
              </div>
            )}

            <div className="schedule-container">
              {/* Main Schedule Card */}
              <div className="schedule-card">
                <div className="schedule-card-header">
                  <h3 className="section-title">
                    Set Available Schedule
                  </h3>
                  <p className="section-description">Select a date and configure your time slots</p>
                </div>

                <div className="schedule-grid">
                  {/* Calendar Section */}
                  <div className="calendar-section">
                    <div className="calendar-wrap">
                      <div className="calendar-header">
                        <h4>Select Date</h4>
                        <span className="selected-date">{new Date(availDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <CalendarC
                        value={new Date(availDate)}
                        minDate={todayStart}
                        onChange={(d) => {
                          try { const picked = new Date(d); picked.setHours(0,0,0,0); if (picked < todayStart) return; setAvailDate(toYMD(picked)); } catch {}
                        }}
                        showHeader={false}
                      />
                    </div>
                  </div>

                  {/* Controls Section */}
                  <div className="controls-section">
                    {/* Action Buttons */}
                    <div className="action-buttons">
                      <button 
                        type="button" 
                        className="btn-modern btn-reload" 
                        onClick={() => loadAvailability(availDate)}
                        disabled={avLoading}
                      >
                        <span className="btn-icon">↻</span>
                        {avLoading ? 'Loading...' : 'Reload'}
                      </button>
                      <button 
                        type="button" 
                        className="btn-modern btn-clear" 
                        onClick={() => setConfirmClearOpen(true)}
                      >
                        <span className="btn-icon">✕</span>
                        Clear All
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="presets-section">
                      <h4 className="subsection-title">Quick Presets</h4>
                      <div className="preset-buttons">
                        <button type="button" className="btn-preset" onClick={() => setPreset('morning')}>
                          <span className="preset-emoji">🌅</span>
                          <span className="preset-label">Morning</span>
                          <span className="preset-time">09:00 - 12:00</span>
                        </button>
                        <button type="button" className="btn-preset" onClick={() => setPreset('afternoon')}>
                          <span className="preset-emoji">☀️</span>
                          <span className="preset-label">Afternoon</span>
                          <span className="preset-time">13:00 - 17:00</span>
                        </button>
                        <button type="button" className="btn-preset" onClick={() => setPreset('fullday')}>
                          <span className="preset-emoji">🌤️</span>
                          <span className="preset-label">Full Day</span>
                          <span className="preset-time">09:00 - 17:00</span>
                        </button>
                      </div>
                    </div>

                    {/* Time Ranges */}
                    <div className="ranges-section">
                      <div className="ranges-header">
                        <h4 className="subsection-title">Time Slots</h4>
                        <button type="button" className="btn-add-range" onClick={addRange}>
                          <span className="btn-icon">+</span>
                          Add Slot
                        </button>
                      </div>
                      <div className="ranges-list">
                        {ranges.length === 0 ? (
                          <div className="empty-state">
                            <span className="empty-icon">🕐</span>
                            <p>No time slots configured</p>
                            <p className="empty-hint">Add a slot or choose a preset</p>
                          </div>
                        ) : (
                          ranges.map((r, i) => {
                            const isSubmitted = submittedRanges.includes(i);
                            const isEditing = editingIndex === i;
                            const isDisabled = isSubmitted && !isEditing;
                            
                            console.log(`[Render] Range ${i}:`, { isSubmitted, isEditing, isDisabled, range: r });
                            
                            return (
                              <div 
                                key={i} 
                                className={`time-range-item ${isSubmitted ? 'submitted' : ''} ${isEditing ? 'editing' : ''}`}
                              >
                                <div className="range-inputs">
                                  <div className="input-group">
                                    <label className="input-label">Start Time</label>
                                    <input 
                                      type="time" 
                                      className="time-input" 
                                      value={r.start} 
                                      onChange={(e) => updateRange(i, 'start', e.target.value)}
                                      disabled={isDisabled}
                                    />
                                  </div>
                                  <div className="range-separator">→</div>
                                  <div className="input-group">
                                    <label className="input-label">End Time</label>
                                    <input 
                                      type="time" 
                                      className="time-input" 
                                      value={r.end} 
                                      onChange={(e) => updateRange(i, 'end', e.target.value)}
                                      disabled={isDisabled}
                                    />
                                  </div>
                                </div>
                                <div className="range-actions">
                                  {/* Edit button - only show for submitted (saved) ranges that are not being edited */}
                                  {isSubmitted && !isEditing && (
                                    <button 
                                      type="button" 
                                      className="btn-edit-range"
                                      onClick={() => toggleEdit(i)}
                                      title="Edit this slot"
                                    >
                                      <span>✎</span>
                                    </button>
                                  )}
                                  
                                  {/* Check and Cancel buttons - only show when editing a submitted range */}
                                  {isSubmitted && isEditing && (
                                    <>
                                      <button 
                                        type="button" 
                                        className="btn-check-range"
                                        onClick={() => saveEditedRange(i)}
                                        disabled={pendingSave}
                                        title="Save changes"
                                      >
                                        <span>{pendingSave ? '...' : '✓'}</span>
                                      </button>
                                      <button 
                                        type="button" 
                                        className="btn-cancel-range"
                                        onClick={() => toggleEdit(i)}
                                        title="Cancel editing"
                                      >
                                        <span>✕</span>
                                      </button>
                                    </>
                                  )}
                                  
                                  {/* Delete button - show for all ranges when not editing */}
                                  {!isEditing && (
                                    <button 
                                      type="button" 
                                      className="btn-remove-range" 
                                      onClick={() => removeRange(i)}
                                      title="Remove slot"
                                    >
                                      <span>✕</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Bulk Apply Section */}
                    <div className="bulk-section">
                      <h4 className="subsection-title">Apply to Multiple Days</h4>
                      <div className="bulk-controls">
                        <div className="bulk-input-group">
                          <span className="bulk-label">Apply same schedule to next</span>
                          <input 
                            type="number" 
                            min="1" 
                            max="30" 
                            value={bulkDays} 
                            onChange={(e) => setBulkDays(e.target.value)} 
                            className="bulk-input" 
                          />
                          <span className="bulk-label">day(s)</span>
                        </div>
                        <button type="button" className="btn-modern btn-bulk" onClick={applyToNextNDays}>
                          Apply Bulk
                        </button>
                      </div>
                    </div>

                    {/* Clear All Confirmation Dialog */}
                    <ConfirmDialog
                      open={confirmClearOpen}
                      title="Clear All Schedules"
                      message={
                        <>
                          <strong>Are you sure you want to clear all schedules?</strong>
                          <br />This will immediately remove all time slots for the selected date.
                        </>
                      }
                      confirmLabel="Clear All"
                      cancelLabel="Cancel"
                      onCancel={() => setConfirmClearOpen(false)}
                      onConfirm={() => {
                        setConfirmClearOpen(false);
                        executeClearAll();
                      }}
                    />

                    {/* Save Button */}
                    <div className="save-section">
                      <button type="button" className="btn-save" onClick={saveAvailability}>
                        <span className="btn-icon">✓</span>
                        Save Availability
                      </button>
                    </div>

                    {message && <div className="legacy-message">{message}</div>}
                  </div>
                </div>
              </div>
            </div>
            <ConfirmDialog
              open={confirmSaveOpen}
              title={pendingAction === 'bulk' ? 'Apply Schedule in Bulk' : 'Save Availability'}
              message={pendingAction === 'bulk' ? (
                <>
                  <strong>Confirm bulk apply?</strong>
                  <br />This will copy the current time slots to the next <em>{bulkDays}</em> day(s). Existing availability on those days will be replaced.
                </>
              ) : (
                <>
                  <strong>Confirm save?</strong>
                  <br />Patients will immediately see these time slots when booking.
                </>
              )}
              confirmLabel={pendingAction === 'bulk' ? 'Apply' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => { setConfirmSaveOpen(false); setPendingAction(null); }}
              onConfirm={() => {
                setConfirmSaveOpen(false);
                if (pendingAction === 'bulk') executeBulk(); else executeSave();
                setPendingAction(null);
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default DoctorSchedule;
