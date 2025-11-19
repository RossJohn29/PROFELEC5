//PreAssessmentForm.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import jsPDF from 'jspdf';
import "../../Styles/PreAssessment.css";
import { savePreAssessmentLocal, getPreAssessmentLocal } from "../../api/preAssess";

ChartJS.register(ArcElement, Tooltip, Legend);

const QUESTIONS = [
  {
    id: 1,
    text: "I have little interest or pleasure in doing things.",
    helper: ""
  },
  {
    id: 2,
    text: "I often feel detached from reality and myself.",
    helper: ""
  },
  {
    id: 3,
    text: "I find myself withdrawing from friends, family, and others.",
    helper: ""
  },
  {
    id: 4,
    text: "I find it difficult to relax and unwind.",
    helper: ""
  },
  {
    id: 5,
    text: "I often feel irritable and easily annoyed.",
    helper: ""
  },
  {
    id: 6,
    text: "I feel helpless and uninterested in envisioning the future.",
    helper: ""
  },
  {
    id: 7,
    text: "I have trouble sleeping, or I sleep too much.",
    helper: ""
  },
  {
    id: 8,
    text: "I dwell on my past failures and often doubt my ability.",
    helper: ""
  },
  {
    id: 9,
    text: "Experience loss of appetite or overeating.",
    helper: ""
  },
  {
    id: 10,
    text: "I have a good and strong relationship with my friends and family.",
    helper: ""
  },
  {
    id: 11,
    text: "I can socialize with people without fear.",
    helper: ""
  },
  {
    id: 12,
    text: "I can identify, acknowledge, and express my feelings and emotions.",
    helper: ""
  },
  {
    id: 13,
    text: "I am often overwhelmed by my daily responsibilities.",
    helper: ""
  },
  {
    id: 14,
    text: "I feel isolated even when surrounded.",
    helper: ""
  },
  {
    id: 15,
    text: "I often feel guilty or ashamed without clear reasons.",
    helper: ""
  }
];

const SCALE_LABELS = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];

function percentFromAnswers(answers) {
  const n = QUESTIONS.length;
  const sum = Object.values(answers).reduce((a, b) => a + (Number(b) || 0), 0);
  const pct = n > 0 ? (sum / (n * 5)) * 100 : 0;
  return Math.round(pct);
}

function interpret(pct) {
  if (pct <= 40) return {
    range: "0–40%",
    severity: 'Low likelihood',
    message: 'You have a relatively stable mental health. You experience stress, dissatisfaction, and other negative emotions, but are coping well.'
  };
  if (pct <= 60) return {
    range: "41–60%",
    severity: 'Mild likelihood',
    message: 'You have emerging signs of distress. You may feel negative emotions, anxiety, and social withdrawal. Reinforce self-care, confide in your support system, and consider informal support like peer conversations or journaling.'
  };
  if (pct <= 80) return {
    range: "61–80%",
    severity: 'Moderate likelihood',
    message: 'You have a noticeable emotional and psychological strain. This affects you mentally and physically. You may have trouble sleeping, loss or excessive appetite, and loss of energy. You may need professional help, such as counselling or therapy, to avoid escalation.'
  };
  return {
    range: "81–100%",
    severity: 'High likelihood',
    message: 'You are experiencing significant mental health distress. You often feel overwhelmed, disconnected or lose passion or interest in doing the things you love or even responsibilities. Immediate professional help is strongly recommended.'
  };
}

export default function PreAssessmentForm({ onClose }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const prev = getPreAssessmentLocal();
    if (prev?.answers) setAnswers(prev.answers);
  }, []);

  const pct = useMemo(() => percentFromAnswers(answers), [answers]);
  const interp = useMemo(() => interpret(pct), [pct]);

  const complete = useMemo(() => QUESTIONS.every(q => answers[q.id] != null), [answers]);

  // Clear and reload function - Fixed version
  const handleClose = () => {
    // Clear all possible localStorage keys that might store pre-assessment data
    localStorage.removeItem('preAssessment');
    localStorage.removeItem('preAssessmentData');
    localStorage.removeItem('theraPH_preAssessment');
    localStorage.removeItem('pre-assessment');
    
    // Clear any other potential variations
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.toLowerCase().includes('preassess') || key.toLowerCase().includes('assessment')) {
        localStorage.removeItem(key);
      }
    });
    
    // Reset component state
    setAnswers({});
    setSubmitted(false);
    
    // Force component to re-render with empty state
    setTimeout(() => {
      if (onClose) onClose();
    }, 0);
  };

  const getPctColorClass = (percentage) => {
    if (percentage <= 40) return 'low';
    if (percentage <= 60) return 'mild';
    if (percentage <= 80) return 'moderate';
    return 'high';
  };

  const getChartColors = (percentage) => {
    if (percentage <= 40) {
      return {
        main: '#16a34a',
        hover: '#15803d',
        background: '#dcfce7'
      };
    } else if (percentage <= 60) {
      return {
        main: '#eab308',
        hover: '#ca8a04',
        background: '#fef9c3'
      };
    } else if (percentage <= 80) {
      return {
        main: '#f97316',
        hover: '#ea580c',
        background: '#fed7aa'
      };
    } else {
      return {
        main: '#dc2626',
        hover: '#b91c1c',
        background: '#fecaca'
      };
    }
  };

  function setAnswer(qid, val) {
    setAnswers(prev => ({ ...prev, [qid]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!complete) return;
    setSubmitted(true);
    savePreAssessmentLocal({
      answers,
      percentage: pct,
      interpretation: interp,
      createdAt: new Date().toISOString(),
      version: 1,
    });
  }

function generatePDF() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 20;
  
  // Simple Header
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('TheraPH Pre-Assessment Report', 20, currentY);
  
  currentY += 8;
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, currentY);
  
  currentY += 15;
  
  // Score Section
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Assessment Score:', 20, currentY);
  
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`${pct}% (${interp.range})`, 80, currentY);
  
  currentY += 8;
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(`Severity: ${interp.severity}`, 20, currentY);
  
  currentY += 10;
  
  // Interpretation
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  const interpretationLines = doc.splitTextToSize(interp.message, pageWidth - 40);
  doc.text(interpretationLines, 20, currentY);
  currentY += interpretationLines.length * 4 + 10;
  
  // Separator line
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 8;
  
  // Answers Section
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Responses:', 20, currentY);
  currentY += 8;
  
  // Simple two-column layout for questions
  let leftColumn = true;
  let leftY = currentY;
  let rightY = currentY;
  const columnWidth = (pageWidth - 50) / 2;
  
  QUESTIONS.forEach((question, index) => {
    const answerValue = answers[question.id];
    const answerLabel = SCALE_LABELS.find(s => s.value === answerValue)?.label || 'Not answered';
    
    if (leftColumn) {
      // Left column
      if (leftY > 250) {
        doc.addPage();
        leftY = 20;
        rightY = 20;
      }
      
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text(`Q${question.id}:`, 20, leftY);
      
      doc.setFont(undefined, 'normal');
      const questionLines = doc.splitTextToSize(question.text, columnWidth - 15);
      doc.text(questionLines, 30, leftY);
      
      doc.setFontSize(6);
      doc.text(`Answer: ${answerValue} - ${answerLabel}`, 20, leftY + (questionLines.length * 3) + 2);
      
      leftY += (questionLines.length * 3) + 8;
    } else {
      // Right column
      if (rightY > 250) {
        doc.addPage();
        leftY = 20;
        rightY = 20;
      }
      
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text(`Q${question.id}:`, pageWidth/2 + 10, rightY);
      
      doc.setFont(undefined, 'normal');
      const questionLines = doc.splitTextToSize(question.text, columnWidth - 15);
      doc.text(questionLines, pageWidth/2 + 20, rightY);
      
      doc.setFontSize(6);
      doc.text(`Answer: ${answerValue} - ${answerLabel}`, pageWidth/2 + 10, rightY + (questionLines.length * 3) + 2);
      
      rightY += (questionLines.length * 3) + 8;
    }
    
    leftColumn = !leftColumn;
  });
  
  // Add a new page for embedded data
  doc.addPage();
  
  // Embed JSON data as hidden/small text for parsing
  const embeddedData = {
    type: "theraPH_pre_assessment",
    version: 1,
    createdAt: new Date().toISOString(),
    result: {
      percentage: pct,
      interpretation: interp,
    },
    answers,
  };
  
  doc.setFontSize(1); // Very small font
  doc.setTextColor(255, 255, 255); // White text (invisible)
  doc.text('EMBEDDED_DATA_START', 20, 20);
  doc.text(JSON.stringify(embeddedData), 20, 22);
  doc.text('EMBEDDED_DATA_END', 20, 24);
  
  // Simple Footer on visible page
  const footerY = 280;
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0); // Reset to black
  doc.text('This assessment is for informational purposes only. Consult healthcare professionals for proper diagnosis.', pageWidth/2, footerY, { align: 'center' });
  doc.text('TheraPH - Your Mental Health Matters', pageWidth/2, footerY + 4, { align: 'center' });
  
  // Save the PDF
  const timestamp = new Date().toISOString().slice(0,10);
  doc.save(`TheraPH-Assessment-${timestamp}.pdf`);
}
  function handleDownload() {
    generatePDF();
  }

  // Add a function to clear assessment after download if needed
  function handleDownloadAndClear() {
    generatePDF();
    // Optionally clear after download - uncomment if you want this behavior
    // setTimeout(() => {
    //   handleClose();
    // }, 1000);
  }

  const chartData = useMemo(() => {
    const colors = getChartColors(pct);
    return {
      labels: ["Your score", "Remaining"],
      datasets: [
        {
          data: [pct, 100 - pct],
          backgroundColor: [
            colors.main,
            colors.background
          ],
          borderWidth: 0,
          hoverBackgroundColor: [
            colors.hover,
            colors.background
          ]
        },
      ],
    };
  }, [pct]);

  const chartOpts = useMemo(() => ({
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: { 
        enabled: true,
        backgroundColor: '#34656D',
        titleColor: '#FAF8F1',
        bodyColor: '#FAF8F1',
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      },
    },
    animation: { duration: 600, easing: 'easeInOutQuart' },
  }), []);

  return (
    <div className="preassess-root">
      <div className="preassess-header">
        <h3>Pre‑Assessment</h3>
        <button className="icon-btn" aria-label="Close" onClick={handleClose}>×</button>
      </div>
      <p className="disclaimer">
        You can retake this pre-assessment at any time to periodically assess your condition. Your wellbeing is important to us.💙
      </p>

      {!submitted && (
        <form id="preassessForm" className="preassess-form" onSubmit={handleSubmit}>
          <div className="questions-grid">
          {QUESTIONS.map((q) => (
            <div key={q.id} className="question-card">
              <div className="q-header">
                <span className="q-number">{q.id}</span>
                <span className="q-text" htmlFor={`q-${q.id}`}>{q.text}</span>
              </div>
              <div className="q-helper">{q.helper}</div>
              <div className="scale">
                {SCALE_LABELS.map((s) => (
                  <label key={s.value} className={`scale-pill ${answers[q.id] === s.value ? 'active' : ''}`}> 
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={s.value}
                      checked={answers[q.id] === s.value}
                      onChange={() => setAnswer(q.id, s.value)}
                      required
                    />
                    <span>{s.value}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          </div>
        </form>
      )}

      {submitted && (
        <div className="results">
          <div className="chart-wrap">
            <Doughnut data={chartData} options={chartOpts} />
            <div className="chart-center">
              <div className={`pct ${getPctColorClass(pct)}`}>{pct}%</div>
              <div className="range">{interp.range}</div>
            </div>
          </div>
          <div className="interpretation">
            <h4>Preliminary Interpretation</h4>
            <div className={`severity-label ${getPctColorClass(pct)}`}>{interp.severity}</div>
            <p>{interp.message}</p>
          </div>
          <div className="next-steps">
            <p>
              If you prefer to stay anonymous, you can download your results now and attach the file when filling the patient profile form.
            </p>
          </div>
        </div>
      )}
      
      {!submitted && (
        <div className="preassess-footer">
          <button type="submit" form="preassessForm" className="submit-btn" disabled={!complete}>See Results</button>
        </div>
      )}

      {submitted && (
        <div className="preassess-footer">
          <button className="secondary" onClick={() => setSubmitted(false)}>Edit Answers</button>
          <button className="primary" onClick={handleDownload}>Download Results (PDF)</button>
        </div>
      )}
    </div>
  );
}