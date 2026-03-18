const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    receiverUpi: {
        type: String,
        default: 'unknown@upi'
    },
    receiverName: {
        type: String,
        default: 'Unknown'
    },
    transactionType: {
        type: String,
        enum: ['SEND', 'RECEIVE', 'REQUEST'],
        default: 'SEND'
    },
    remarks: {
        type: String,
        default: ''
    },
    riskScore: {
        type: Number,
        default: 0
    },
    riskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW'
    },
    isFraud: {
        type: Boolean,
        default: false
    },
    action: {
        type: String,
        enum: ['APPROVED', 'REVIEW', 'FLAGGED', 'BLOCKED'],
        default: 'APPROVED'
    },
    modelUsed: {
        type: String,
        default: 'FALLBACK'
    },
    topReason: {
        type: String,
        default: ''
    },
    features: {
        type: Object,
        default: {}
    },
    reviewed: {
        type: Boolean,
        default: false
    },
    reviewedAt: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);