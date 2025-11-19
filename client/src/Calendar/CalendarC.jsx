import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../Styles/Calendar.css'; 

function CalendarC({ value, onChange, showHeader = true, minDate, markedDates = [], allowClear = false, availableDates = null }) {
  // selectedDate can be null to represent no selection (cleared)
  const [selectedDate, setSelectedDate] = useState(value ?? null);
  const marks = React.useMemo(() => {
    try {
      return new Set(
        (markedDates || []).map((d) => {
          if (d instanceof Date) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          }
          // assume already Y-M-D
          return String(d).slice(0, 10);
        })
      );
    } catch {
      return new Set();
    }
  }, [markedDates]);

  // keep internal selectedDate in sync with incoming value (including null)
  useEffect(() => {
    // if value is explicitly provided (could be null), sync to it
    if (value === null) {
      setSelectedDate(null);
      return;
    }
    if (value && (!selectedDate || value.toDateString() !== selectedDate.toDateString())) {
      setSelectedDate(value);
    }
  }, [value]); 

  const handleDateChange = (date) => {
    setSelectedDate(date);
    onChange?.(date);
    console.log('Selected date:', date);
  };

  // allow clearing selection when clicking the already-selected day
  const handleClickDay = (date) => {
    if (allowClear && selectedDate && date.toDateString() === selectedDate.toDateString()) {
      setSelectedDate(null);
      onChange?.(null);
      console.log('Cleared selected date');
      return;
    }
    handleDateChange(date);
  };

  return (
    <div className="calendar-container">
      {showHeader && <h3>Calendar</h3>}
      <Calendar
        onChange={handleDateChange}
        onClickDay={handleClickDay}
        value={selectedDate}
        minDate={minDate}
        tileDisabled={({ date, view }) => {
          if (view !== 'month') return false;
          // if minDate provided, respect it
          if (minDate) {
            const d = new Date(date); d.setHours(0,0,0,0);
            const m = new Date(minDate); m.setHours(0,0,0,0);
            if (d < m) return true;
          }
          try {
            if (Array.isArray(availableDates)) {
              // disable all days if doctor doesn'y have any availability
              if (availableDates.length === 0) return true;
              if (availableDates.length > 0) {
              // normalize availableDates to a set of Y-M-D strings
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const dStr = String(date.getDate()).padStart(2, '0');
              const key = `${y}-${m}-${dStr}`;
              const set = new Set((availableDates || []).map((ad) => {
                if (!ad) return '';
                if (ad instanceof Date) {
                  const yy = ad.getFullYear();
                  const mm = String(ad.getMonth() + 1).padStart(2, '0');
                  const dd = String(ad.getDate()).padStart(2, '0');
                  return `${yy}-${mm}-${dd}`;
                }
                // assume Y-M-D string
                return String(ad).slice(0, 10);
              }));
              return !set.has(key);
              }
            }
          } catch (err) {
            // fallback: do not disable
          }
          return false;
        }}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return null;
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const key = `${y}-${m}-${d}`;
          // add class for marked dates; also for selected date
          const classes = [];
          if (marks.has(key)) classes.push('has-appt');
          if (selectedDate && date.toDateString() === selectedDate.toDateString()) classes.push('selected-day');
          return classes.length ? classes.join(' ') : null;
        }}
      />
    </div>
  );
}

export default CalendarC;
