const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const hashChain = require('../services/hashChain');

// In-memory counters (fast, no DB needed for demo)
let stats = {
    total: 0,
    frauds: 0,
    legit: 0,
    blocked: 0,
    flagged: 0,
    approved: 0,
    amount_saved: 0,
    risk_distribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
};

exports.updateStats = (result) => {
    stats.total++;
    if (result.is_fraud) {
        stats.frauds++;
        stats.amount_saved += result.amount || 0;
    } else {
        stats.legit++;
    }

    if (result.action === 'BLOCKED') stats.blocked++;
    else if (result.action === 'FLAGGED') stats.flagged++;
    else stats.approved++;

    if (result.risk_level) {
        stats.risk_distribution[result.risk_level]++;
    }
};

exports.getStats = async (req, res) => {
    try {
        const blockchainStats = hashChain.getStats();

        res.json({
            success: true,
            data: {
                total_transactions: stats.total,
                fraud_detected: stats.frauds,
                legit_transactions: stats.legit,
                fraud_rate: stats.total > 0
                    ? ((stats.frauds / stats.total) * 100).toFixed(2)
                    : 0,
                amount_saved: Math.round(stats.amount_saved),
                actions: {
                    blocked: stats.blocked,
                    flagged: stats.flagged,
                    approved: stats.approved
                },
                risk_distribution: stats.risk_distribution,
                blockchain: blockchainStats,
                model_accuracy: 96.5,
                avg_response_time: '< 100ms',
                system_uptime: process.uptime().toFixed(0) + 's'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTimeline = async (req, res) => {
    try {
        // Return recent transactions for timeline chart
        const chain = hashChain.getChain().slice(-100);
        const timeline = chain.map(block => ({
            timestamp: block.timestamp,
            is_fraud: block.data.is_fraud,
            amount: block.data.amount,
            risk_level: block.data.risk_level
        }));

        res.json({ success: true, data: timeline });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBlockchain = async (req, res) => {
    try {
        const chain = hashChain.getChain();
        const verification = hashChain.verifyChain();

        res.json({
            success: true,
            verification,
            total_blocks: chain.length,
            chain: chain.slice(-20) // Last 20 blocks
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resetStats = () => {
    stats = {
        total: 0, frauds: 0, legit: 0,
        blocked: 0, flagged: 0, approved: 0,
        amount_saved: 0,
        risk_distribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    };
};