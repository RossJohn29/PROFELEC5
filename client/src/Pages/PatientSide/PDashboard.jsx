//PDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LifeLine } from 'react-loading-indicators';
import PNavbar from "../../SideBar/PNavbar";
import "../../Styles/PNavbar.css";
import "../../Styles/PDashboard.css";
import "../../Styles/About.css";
import PDashboardCalendar from "../../Calendar/PatientCalendar/PDashboardCalendar";
import apiUrl from "../../api/base";
import PreAssessmentForm from "../Others/PreAssessmentForm";
import { getPreAssessmentLocal, savePreAssessmentLocal } from "../../api/preAssess";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Import pdfjs from react-pdf to ensure version compatibility
import { pdfjs } from 'react-pdf';

// Set up PDF.js worker - Use the version that matches react-pdf's internal pdfjs version
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

ChartJS.register(ArcElement, Tooltip, Legend);

function PDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [topDoctor, setTopDoctor] = useState(null);
  const [showPreModal, setShowPreModal] = useState(false);
  const [localPre, setLocalPre] = useState(null); 
  const [uploadedPre, setUploadedPre] = useState(null); 
  const [uploadError, setUploadError] = useState("");
  const [serverPre, setServerPre] = useState(null); 
  const navigate = useNavigate();

  const handleBookAppointment = () => {
    navigate("/DoctorLists");
  };

  // Poll appointments with simple de-duplication to avoid overlapping fetches
  useEffect(() => {
    const patientId = localStorage.getItem('patientId') || localStorage.getItem('userId') || null;
    const email = localStorage.getItem('email') || null;
    if (!patientId && !email) return;

    const buildUrl = () => {
      if (patientId) return apiUrl(`/api/appointments?patientId=${patientId}`);
      return apiUrl(`/api/appointments?patientEmail=${encodeURIComponent(email)}`);
    };

    const fetching = { current: false };
    let mounted = true;

    const fetchAppointments = async () => {
      if (fetching.current) return; // skip if a previous request is still in-flight
      fetching.current = true;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(buildUrl(), { signal: controller.signal });
        const data = await res.json();
        if (mounted && data && data.appointments) setAppointments(data.appointments);
      } catch (err) {
        if (err?.name !== 'AbortError') console.error('Failed loading appointments', err);
      } finally {
        clearTimeout(timeoutId);
        fetching.current = false;
      }
    };

    fetchAppointments();
    const iv = setInterval(fetchAppointments, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  // Load any existing local pre-assessment
  useEffect(() => {
    try {
      const prev = getPreAssessmentLocal();
      if (prev && typeof prev === 'object') setLocalPre(prev);
    } catch {}
  }, []);

  // Fetch saved pre-assessment from server profile
  useEffect(() => {
    const email = localStorage.getItem('email');
    if (!email) return;
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const res = await fetch(apiUrl('/patient/get-profile'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const j = await res.json();
        if (!cancelled) setServerPre(j?.patient?.preAssessment || null);
      } catch {}
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  // After closing modal, refresh local saved result
  const handleClosePreModal = () => {
    setShowPreModal(false);
    try {
      const prev = getPreAssessmentLocal();
      if (prev && typeof prev === 'object') setLocalPre(prev);
    } catch {}
  };

  useEffect(() => {
    const email = localStorage.getItem('email');
    if (!email) return;
    if (!localPre) return;
    try {
      const localAt = new Date(localPre.createdAt || 0).getTime();
      const serverAt = new Date(serverPre?.createdAt || 0).getTime();
      const serverHasNewerOrEqual = serverPre && serverAt >= localAt;
      if (serverHasNewerOrEqual) return;
    } catch {
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/patient/pre-assessment'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, data: localPre })
        });
        const j = await res.json().catch(() => ({}));
        if (!cancelled && j?.status === 'success' && j?.preAssessment) {
          setServerPre(j.preAssessment);
        }
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, [localPre, serverPre]);

  // Parse uploaded PDF
    const handleUploadPdf = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setUploadError("");
      setUploadedPre(null);
      
      // Validate file type
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Please select a valid PDF file');
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setUploadError('PDF file is too large. Maximum size is 10MB');
        return;
      }
      
      console.log('Starting PDF upload and parsing...', { 
        name: file.name, 
        size: file.size, 
        type: file.type 
      });
      
      try {
        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          setUploadError('Failed to read PDF file. File may be corrupted');
          return;
        }
        
        console.log('File read successfully, parsing PDF...');
        
        // Load PDF document using pdfjs from react-pdf
        let pdf;
        try {
          // Use pdfjs.getDocument from react-pdf's pdfjs
          const loadingTask = pdfjs.getDocument({ 
            data: arrayBuffer,
            standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/standard_fonts/`,
          });
          
          pdf = await loadingTask.promise;
          console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
        } catch (pdfLoadError) {
          console.error('PDF loading error:', pdfLoadError);
          setUploadError('Failed to load PDF. The file may be corrupted or password-protected');
          return;
        }
        
        let foundData = null;
        let allText = '';
        
        // Extract text from all pages
        try {
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              
              // Extract all text from the page
              const pageText = textContent.items
                .map(item => {
                  if (item.str) return item.str;
                  return '';
                })
                .filter(str => str.trim().length > 0)
                .join(' ');
              
              allText += pageText + ' ';
              console.log(`Page ${pageNum} text extracted (${pageText.length} chars)`);
              
              // Check for embedded data markers
              const startMarker = 'EMBEDDED_DATA_START';
              const endMarker = 'EMBEDDED_DATA_END';
              
              if (pageText.includes(startMarker) && pageText.includes(endMarker)) {
                try {
                  const startIndex = pageText.indexOf(startMarker);
                  const endIndex = pageText.indexOf(endMarker);
                  
                  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                    const jsonStart = startIndex + startMarker.length;
                    const jsonText = pageText.substring(jsonStart, endIndex).trim();
                    
                    try {
                      const cleanedJson = jsonText
                        .replace(/[\r\n\t]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                      
                      const json = JSON.parse(cleanedJson);
                      
                      if (json?.type === 'theraPH_pre_assessment' && json.result?.percentage != null) {
                        console.log('Found embedded data in PDF');
                        foundData = json;
                        break;
                      }
                    } catch (parseErr) {
                      console.warn('Embedded JSON parse failed:', parseErr.message);
                    }
                  }
                } catch (markerError) {
                  console.warn('Error extracting embedded data:', markerError.message);
                }
              }
            } catch (pageError) {
              console.warn(`Error reading page ${pageNum}:`, pageError.message);
              continue;
            }
          }
        } catch (extractError) {
          console.error('Text extraction error:', extractError);
          setUploadError('Failed to extract text from PDF');
          return;
        }
        
        console.log('All text extracted:', allText.substring(0, 200) + '...');
        
        // If no embedded data, parse from visible text
        if (!foundData) {
          console.log('No embedded data found, parsing visible text...');
          
          // Validate this is a TheraPH assessment PDF
          const isTheraPH = allText.includes('TheraPH Pre-Assessment Report') || 
                            allText.includes('TheraPH') ||
                            allText.includes('Assessment Score');
          
          if (!isTheraPH) {
            setUploadError('This PDF does not appear to be a TheraPH Pre-Assessment Report');
            return;
          }
          
          // Extract percentage
          let percentage = null;
          const percentPatterns = [
            /Assessment Score:\s*(\d+)%/i,
            /(\d+)%\s*\(/,
            /Score:\s*(\d+)/i,
            /percentage:\s*(\d+)/i
          ];
          
          for (const pattern of percentPatterns) {
            const match = allText.match(pattern);
            if (match) {
              percentage = parseInt(match[1], 10);
              if (percentage >= 0 && percentage <= 100) {
                console.log('Percentage found:', percentage);
                break;
              }
            }
          }
          
          if (percentage === null || isNaN(percentage)) {
            setUploadError('Could not find assessment score in PDF');
            return;
          }
          
          // Extract severity
          const severityMatch = allText.match(/Severity:\s*((?:Low|Mild|Moderate|High)\s+likelihood)/i);
          let severity = severityMatch ? severityMatch[1] : '';
          
          // Determine range and default severity
          let range = '';
          if (percentage <= 40) {
            range = "0–40%";
            if (!severity) severity = 'Low likelihood';
          } else if (percentage <= 60) {
            range = "41–60%";
            if (!severity) severity = 'Mild likelihood';
          } else if (percentage <= 80) {
            range = "61–80%";
            if (!severity) severity = 'Moderate likelihood';
          } else {
            range = "81–100%";
            if (!severity) severity = 'High likelihood';
          }
          
          // Extract message
          let message = '';
          const messagePatterns = [
            /Severity:.*?(You (?:are|have|often|may)[^\.]+\.(?:[^\.]+\.)*)/i,
            /(?:High|Moderate|Mild|Low) likelihood\s+(You[^\.]+\.(?:[^\.]+\.)*)/i
          ];
          
          for (const pattern of messagePatterns) {
            const match = allText.match(pattern);
            if (match) {
              message = match[1].trim()
                .replace(/\s+/g, ' ')
                .replace(/\s+\./g, '.')
                .substring(0, 500);
              if (message.length > 50) break;
            }
          }
          
          // Default messages
          if (!message || message.length < 20) {
            const defaultMessages = {
              low: 'You have a relatively stable mental health. You experience stress, dissatisfaction, and other negative emotions, but are coping well.',
              mild: 'You have emerging signs of distress. You may feel negative emotions, anxiety, and social withdrawal.',
              moderate: 'You have a noticeable emotional and psychological strain. This affects you mentally and physically.',
              high: 'You are experiencing significant mental health distress. You often feel overwhelmed, disconnected or lose passion or interest in doing the things you love or even responsibilities. Immediate professional help is strongly recommended.'
            };
            
            if (percentage <= 40) message = defaultMessages.low;
            else if (percentage <= 60) message = defaultMessages.mild;
            else if (percentage <= 80) message = defaultMessages.moderate;
            else message = defaultMessages.high;
          }
          
          // Extract answers
          const answers = {};
          let answersFound = 0;
          
          for (let qNum = 1; qNum <= 15; qNum++) {
            const patterns = [
              new RegExp(`Q${qNum}:.*?Answer:\\s*(\\d+)\\s*-`, 'i'),
              new RegExp(`Q${qNum}\\s*.*?Answer\\s*:\\s*(\\d+)`, 'i')
            ];
            
            for (const pattern of patterns) {
              const match = allText.match(pattern);
              if (match) {
                const answer = parseInt(match[1], 10);
                if (answer >= 1 && answer <= 5) {
                  answers[qNum] = answer;
                  answersFound++;
                  break;
                }
              }
            }
            
            if (!answers[qNum]) {
              answers[qNum] = 3;
            }
          }
          
          console.log(`Extracted ${answersFound} out of 15 answers`);
          
          foundData = {
            type: 'theraPH_pre_assessment',
            version: 1,
            createdAt: new Date().toISOString(),
            result: {
              percentage,
              interpretation: { range, severity, message }
            },
            answers
          };
        }
        
        if (!foundData || typeof foundData.result?.percentage !== 'number') {
          setUploadError('Could not extract valid assessment data from PDF');
          return;
        }
        
        const data = {
          percentage: foundData.result.percentage,
          interpretation: foundData.result.interpretation || {},
          answers: foundData.answers || {},
          createdAt: foundData.createdAt || new Date().toISOString(),
          version: foundData.version || 1
        };
        
        console.log('PDF parsed successfully:', data);
        
        setUploadedPre(data);
        
        try { 
          savePreAssessmentLocal(data); 
          setLocalPre(data);
        } catch (localSaveErr) {
          console.warn('localStorage save failed:', localSaveErr);
        }
        
        const email = localStorage.getItem('email');
        if (email) {
          try {
            const response = await fetch(apiUrl('/patient/pre-assessment'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, data })
            });
            
            const res = await response.json();
            if (res?.status === 'success' && res.preAssessment) {
              setServerPre(res.preAssessment);
            }
          } catch (serverErr) {
            console.warn('Server save failed:', serverErr);
          }
        }
        
        e.target.value = '';
        
      } catch (err) {
        console.error('PDF parsing error:', err);
        setUploadError(`Failed to parse PDF: ${err.message || 'Unknown error'}`);
      }
    };

  const activePre = uploadedPre || localPre || serverPre;

  const getPctClass = (percentage) => {
    if (percentage <= 40) return 'low';
    if (percentage <= 60) return 'mild';
    if (percentage <= 80) return 'moderate';
    return 'high';
  };

  const getChartColors = (percentage) => {
    if (percentage <= 40) {
      return { main: '#16a34a', hover: '#15803d', background: '#dcfce7' };
    } else if (percentage <= 60) {
      return { main: '#eab308', hover: '#ca8a04', background: '#fef9c3' };
    } else if (percentage <= 80) {
      return { main: '#f97316', hover: '#ea580c', background: '#fed7aa' };
    }
    return { main: '#dc2626', hover: '#b91c1c', background: '#fecaca' };
  };

  const chartData = useMemo(() => {
    if (!activePre?.percentage && activePre?.percentage !== 0) return null;
    const colors = getChartColors(activePre.percentage);
    return {
      labels: ['Your score', 'Remaining'],
      datasets: [{
        data: [activePre.percentage, 100 - activePre.percentage],
        backgroundColor: [colors.main, colors.background],
        borderWidth: 0,
        hoverBackgroundColor: [colors.hover, colors.background]
      }]
    };
  }, [activePre]);

  const chartOpts = useMemo(() => ({
    cutout: '70%',
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    animation: { duration: 500 }
  }), []);

  // fetch top doctor (highest avgRating, fallback to first)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchTop = async () => {
      try {
        const res = await fetch(apiUrl('/api/doctors/with-ratings'), { signal: controller.signal });
        const j = await res.json();
        const docs = j?.doctors || j || [];
        if (!Array.isArray(docs) || docs.length === 0) return;
        // pick by avgRating then ratingCount
        const sorted = docs.slice().sort((a, b) => {
          const ra = (a.avgRating == null) ? -1 : a.avgRating;
          const rb = (b.avgRating == null) ? -1 : b.avgRating;
          if (rb !== ra) return rb - ra;
          return (b.ratingCount || 0) - (a.ratingCount || 0);
        });
        if (!cancelled) setTopDoctor(sorted[0]);
      } catch (e) {
        if (e?.name !== 'AbortError') console.error('Failed loading top doctor', e);
      }
    };
    fetchTop();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Mark dates for pending or approved appointments so they show a dot
  const markedDates = useMemo(() => {
    try {
      const ymdSet = new Set();
      const out = [];
      for (const a of appointments) {
        const s = String(a.status || '').toLowerCase();
        if (s !== 'approved' && s !== 'pending') continue;
        if (!a.date) continue;
        const d = new Date(a.date);
        if (isNaN(d)) continue;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${day}`;
        if (!ymdSet.has(key)) {
          ymdSet.add(key);
          out.push(new Date(d));
        }
      }
      return out;
    } catch { return []; }
  }, [appointments]);

  // appointments to show in My Appointments: only pending or approved
  const visibleAppointments = useMemo(() => {
    try {
      const base = (appointments || []).filter((a) => {
        const s = String(a.status || '').toLowerCase();
        return s === 'pending' || s === 'approved';
      });

      if (!selectedDate) return base;

      // match Y-M-D equality
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;

      return base.filter((a) => {
        if (!a.date) return false;
        const dt = new Date(a.date);
        if (isNaN(dt)) return false;
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        const k = `${yy}-${mm}-${dd}`;
        return k === key;
      });
    } catch (e) {
      console.error('Filtering appointments failed', e);
      return [];
    }
  }, [appointments, selectedDate]);

  return (
    <div className="patient-dashboard">
      <PNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className={`main-content ${sidebarOpen ? "sidebar-open" : ""}`}>
        {/* Grid container with named areas */}
        <div className="pdashboard-grid">
          <div className="welcome-box">
            <h1>Welcome to Your Dashboard!</h1>
            <p className="lead">Healing is not linear, but it is possible.</p>
          </div>

          {/* Top Doctor box placed beside welcome-box */}
          <div
            className="top-doctor-box"
            role="button"
            tabIndex={0}
            onClick={() => { if (topDoctor?.email) navigate(`/BookApp/${encodeURIComponent(topDoctor.email)}`, { state: { email: topDoctor.email } }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (topDoctor?.email) navigate(`/BookApp/${encodeURIComponent(topDoctor.email)}`, { state: { email: topDoctor.email } }); } }}
          >
            <h3 className="top-doctor-title">Top Doctor</h3>
            {!topDoctor ? (
              <div className="top-doctor-loading">
                <LifeLine color="#8EACCD" size="medium" text="" textColor="" />
              </div>
            ) : (
              <div className="top-doctor-body">
                <div className="top-doctor-left">
                  <img src={(topDoctor && (topDoctor.profileImage || topDoctor.profilePicture)) || '/public/avatar-placeholder.png'} alt="Top Doctor" />
                </div>
                <div className="top-doctor-right">
                  <div className="td-name">{topDoctor ? `${topDoctor.firstName || ''} ${topDoctor.lastName || ''}`.trim() : 'Loading...'}</div>
                  <div className="td-specialty">{topDoctor?.specialty || topDoctor?.specialization || 'General'}</div>
                  <div className="td-meta">{(topDoctor?.ratingCount || topDoctor?.ratingCount === 0) ? `${topDoctor.ratingCount} Completed` : ''}</div>
                  <div className="td-rating">{topDoctor?.avgRating != null ? `Rating: ${topDoctor.avgRating}/5` : ''}</div>
                </div>
              </div>
            )}
          </div>

          <div className="calendar-section">
            <PDashboardCalendar
              selectedDate={selectedDate}
              onDateChange={(date) => {
                // date may be null when cleared
                if (date === null) setSelectedDate(null);
                else setSelectedDate(new Date(date));
              }}
              markedDates={markedDates}
            />
          </div>

          <div className="appointments-section">
              <h3>My Appointments</h3>

              <div className="my-appointments-list">
                {visibleAppointments.length === 0 && (
                  <p className="no-appointments">You have no pending or approved appointments.</p>
                )}

                {visibleAppointments.map((a) => {
                  const doc = a.doctor || {};
                  const apptDate = a.date ? new Date(a.date) : null;
                  const dateStr = apptDate ? apptDate.toLocaleString() : '—';
                  const handleOpen = () => {
                    try {
                      navigate('/PatientAppDetails', { state: { appointment: a, appointmentId: a._id } });
                    } catch (e) {
                      console.error('Navigation error', e);
                    }
                  };

                  const onKeyDown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpen();
                    }
                  };

                  // format date and time separately
                  const dt = apptDate;
                  const dateOnly = dt ? dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
                  const timeOnly = dt ? dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

                  return (
                    <div
                      className="appt-item appt-row-style"
                      key={a._id}
                      role="button"
                      tabIndex={0}
                      onClick={handleOpen}
                      onKeyDown={onKeyDown}
                    >
                      <div className="appt-left">
                        <img className="appt-avatar" src={doc.profileImage || '/public/avatar-placeholder.png'} alt="avatar" />
                      </div>

                      <div className="appt-center">
                        <div className="doctor-name">{(doc.firstName || '') + (doc.lastName ? ' ' + doc.lastName : '') || 'Doctor'}</div>
                        <div className="appt-datetime">{dateOnly} / {timeOnly}</div>
                      </div>

                      <div className="appt-right">
                        <div className={`appt-status status-${a.status || ''}`}>{(a.status || '').toUpperCase()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="book-btn" onClick={handleBookAppointment}>
                Book an Appointment
              </button>
          </div>

          {/* Pre-Assessment Section */}
          <div className="preassess-section">
            <h3>Pre‑Assessment</h3>
            <div className="preassess-actions">
              <button className="btn btn-primary" onClick={() => setShowPreModal(true)}>
                Take / Retake Assessment
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                Upload PDF File
                <input 
                  type="file" 
                  accept="application/pdf,.pdf" 
                  style={{ display: 'none' }} 
                  onChange={handleUploadPdf} 
                />
              </label>
            </div>

            {uploadError && (
              <div className="preassess-error">{uploadError}</div>
            )}

            {activePre ? (
              <div className="preassess-chart-container">
                {chartData && (
                  <div className="preassess-chart-wrapper">
                    <Doughnut data={chartData} options={chartOpts} />
                  </div>
                )}
                <div className="preassess-chart-info">
                  <div className="preassess-percentage" style={{
                    color: activePre.percentage >= 80 ? '#dc2626' :
                           activePre.percentage >= 60 ? '#f97316' :
                           activePre.percentage >= 40 ? '#eab308' : '#16a34a'
                  }}>
                    {activePre.percentage}%
                  </div>
                  <div className="preassess-interpretation">
                    {(() => {
                      const interp = activePre.interpretation || {};
                      const severity = interp.severity || (typeof interp.label === 'string' ? interp.label.split('-')[0].trim() : '') || 'Interpretation unavailable.';
                      const message = interp.message || (typeof interp.label === 'string' ? interp.label : '') || '';
                      const cls = getPctClass(typeof activePre.percentage === 'number' ? activePre.percentage : 0);
                      return (
                        <>
                          <div className={`severity-label ${cls}`}>{severity}</div>
                          <div className="preassess-interpretation-text">{message}</div>
                        </>
                      )
                    })()}
                  </div>
                  <div className="preassess-source">
                    {uploadedPre && 'Showing uploaded result.'}
                    {!uploadedPre && localPre && 'Showing locally saved result.'}
                    {!uploadedPre && !localPre && serverPre && 'Showing saved profile result.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="preassess-placeholder">
                No pre‑assessment result yet. Take the assessment or upload a PDF file.
              </div>
            )}
          </div>
        </div>

        {/* Pre-Assessment Modal */}
        {showPreModal && (
          <div className="modal-overlay" onClick={handleClosePreModal}>
            <div className="modal-content square" onClick={(e) => e.stopPropagation()}>
              <PreAssessmentForm onClose={handleClosePreModal} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PDashboard;