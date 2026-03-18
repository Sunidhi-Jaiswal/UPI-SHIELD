const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    txn_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Transaction'
    },
    transaction_id: { type: String }, // Dummy field purely to bypass the un-droppable MongoDB native unique index
    alert_type: {
        type: String,
        enum: ['FRAUD_DETECTED', 'SUSPICIOUS_ACTIVITY', 'ACCOUNT_BLOCKED', 'HIGH_RISK'],
        required: true
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        required: true
    },
    message: String,
    details: {
        amount: Number,
        sender: String,
        receiver: String,
        fraud_probability: Number,
        risk_factors: [String]
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
        default: 'ACTIVE'
    },
    acknowledged_by: String,
    acknowledged_at: Date
}, { timestamps: true });

alertSchema.index({ status: 1 });
alertSchema.index({ severity: 1 });

module.exports = mongoose.model('Alert', alertSchema);