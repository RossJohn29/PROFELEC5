import React, { useState } from "react";
import CalendarC from "../CalendarC.jsx";
import "react-calendar/dist/Calendar.css";
import "../../Styles/Calendar.css";

function PDashboardCalendar({ selectedDate, onDateChange, markedDates = [] }) {
  return (
    <div className="calendar-container">
      <h3>Calendar</h3>
      <CalendarC
        value={selectedDate ?? null}
        onChange={onDateChange}
        showHeader={false}
        markedDates={markedDates}
        //
        allowClear={true} 
      />
    </div>
  );
}

export default PDashboardCalendar;
