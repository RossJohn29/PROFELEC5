//Appointment.js
const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Psychiatrist',
        required: true,
    },

    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,

    },

    date: {
        type: Date,
        required: true,

    },

    status: {
        type: String,
        enum: ['pending', 'approved', 'completed', 'cancelled'],
        default: 'pending',
    },

    notes: {
        type: String,
    },

    // patient review/rating after appointment
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },

    review: {
        type: String,
    },

}, { timestamps: true });

// Helpful index for recent-patient queries
AppointmentSchema.index({ doctor: 1, status: 1, date: -1 });
// Optimize aggregation for ratings grouped by doctor
AppointmentSchema.index({ doctor: 1, rating: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema)