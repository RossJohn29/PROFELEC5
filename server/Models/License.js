//License.js
const mongoose = require('mongoose');

const LicenseSchema = new mongoose.Schema(
    {
        doctorEmail: {
            type: String,
            required: true,
            index: true
        },
        licenseNumber: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true
        },
        note: {
            type: String
        },
    },

    {
        timestamps: true
    }
);

LicenseSchema.index({
    doctorEmail: 1,
    licenseNumber: 1
},
    { 
        unique: true
    }
);

module.exports = mongoose.model('LicenseRequest', LicenseSchema);