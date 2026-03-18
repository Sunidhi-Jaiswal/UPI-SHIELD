const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');

// Dashboard Stats (general — used by Dashboard component)
router.get('/', protect, async (req, res) => {
    try {
        const totalTransactions = await Transaction.countDocuments();
        const fraudTransactions = await Transaction.countDocuments({ isFraud: true });
        const blockedTransactions = await Transaction.countDocuments({ action: 'BLOCKED' });
        const flaggedTransactions = await Transaction.countDocuments({ action: 'FLAGGED' });
        const approvedTransactions = await Transaction.countDocuments({ action: 'APPROVED' });

        const amountSaved = await Transaction.aggregate([
            { $match: { isFraud: true } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const riskDistribution = await Transaction.aggregate([
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
        ]);

        const riskDist = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
        riskDistribution.forEach(item => {
            if (item._id && riskDist.hasOwnProperty(item._id)) {
                riskDist[item._id] = item.count;
            }
        });

        const fraudRate = totalTransactions > 0
            ? ((fraudTransactions / totalTransactions) * 100).toFixed(2)
            : '0';

        res.json({
            success: true,
            data: {
                total_transactions: totalTransactions,
                fraud_detected: fraudTransactions,
                legit_transactions: totalTransactions - fraudTransactions,
                fraud_rate: fraudRate,
                amount_saved: amountSaved[0]?.total || 0,
                actions: {
                    blocked: blockedTransactions,
                    flagged: flaggedTransactions,
                    approved: approvedTransactions,
                },
                risk_distribution: riskDist,
                model_accuracy: 96.5,
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/dashboard', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const totalTransactions = await Transaction.countDocuments({ userId });
        const fraudTransactions = await Transaction.countDocuments({ userId, isFraud: true });
        const blockedTransactions = await Transaction.countDocuments({ userId, action: 'BLOCKED' });
        const flaggedTransactions = await Transaction.countDocuments({ userId, action: 'FLAGGED' });

        const recentTransactions = await Transaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10);

        const totalAmount = await Transaction.aggregate([
            { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const riskDistribution = await Transaction.aggregate([
            { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            stats: {
                totalTransactions,
                fraudTransactions,
                blockedTransactions,
                flaggedTransactions,
                safeTransactions: totalTransactions - fraudTransactions,
                fraudRate: totalTransactions > 0
                    ? ((fraudTransactions / totalTransactions) * 100).toFixed(2)
                    : 0,
                totalAmount: totalAmount[0]?.total || 0,
                riskDistribution: riskDistribution.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                recentTransactions
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;