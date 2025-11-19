//Availability.js
const mongoose = require('mongoose');

const TimeRangeSchema = new mongoose.Schema(
  {
    start: {
      type: String, // 'HH:mm'
      required: true,
      validate: {
        validator: (v) => /^\d{2}:\d{2}$/.test(v),
        message: 'Invalid time format, expected HH:mm'
      }
    },
    end: {
      type: String, // 'HH:mm'
      required: true,
      validate: {
        validator: (v) => /^\d{2}:\d{2}$/.test(v),
        message: 'Invalid time format, expected HH:mm'
      }
    }
  },
  { _id: false }
);

const AvailabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Psychiatrist',
      required: true
    },
    date: {
      type: Date, // normalized to day start
      required: true
    },
    ranges: {
      type: [TimeRangeSchema],
      default: []
    }
  },
  { timestamps: true }
);

// Normalize date to start of day
AvailabilitySchema.pre('save', function (next) {
  if (this.date instanceof Date) {
    this.date.setHours(0, 0, 0, 0);
  }
  next();
});

AvailabilitySchema.index({ doctor: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Availability', AvailabilitySchema);