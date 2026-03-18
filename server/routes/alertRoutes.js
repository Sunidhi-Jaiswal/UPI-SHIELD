const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// Get Alerts (flagged/blocked transactions)
router.get('/', protect, async (req, res) => {
    try {
        const alerts = await Transaction.find({
            userId: req.user.id,
            $or: [
                { isFraud: true },
                { action: 'BLOCKED' },
                { action: 'FLAGGED' },
                { riskScore: { $gte: 50 } }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(20);

        res.json({
            success: true,
            count: alerts.length,
            alerts: alerts.map(a => ({
                id: a._id,
                amount: a.amount,
                receiverUpi: a.receiverUpi,
                riskScore: a.riskScore,
                riskLevel: a.riskLevel,
                action: a.action,
                reason: a.topReason,
                timestamp: a.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark alert as reviewed
router.patch('/:id/review', protect, async (req, res) => {
    try {
        const transaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            { reviewed: true, reviewedAt: new Date() },
            { new: true }
        );

        res.json({ success: true, transaction });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;