const express = require('express');
const router = express.Router();
const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Simulate Transaction (no auth needed for demo)
router.post('/transaction', async (req, res) => {
    try {
        const features = {
            amount: parseFloat(req.body.amount) || 1000,
            hour: parseInt(req.body.hour) || new Date().getHours(),
            transaction_frequency: parseInt(req.body.transaction_frequency) || 1,
            is_new_device: parseInt(req.body.is_new_device) || 0,
            location_change: parseInt(req.body.location_change) || 0,
            is_new_receiver: parseInt(req.body.is_new_receiver) || 0,
            failed_pin_attempts: parseInt(req.body.failed_pin_attempts) || 0,
            avg_daily_transaction: parseFloat(req.body.avg_daily_transaction) || 2000,
            transaction_speed_sec: parseFloat(req.body.transaction_speed_sec) || 15
        };

        let prediction;
        try {
            const mlRes = await axios.post(`${ML_URL}/predict`, features, { timeout: 5000 });
            prediction = mlRes.data;
        } catch (err) {
            prediction = {
                is_fraud: features.amount > 50000 ? 1 : 0,
                fraud_probability: features.amount > 50000 ? 75 : 15,
                risk_level: features.amount > 50000 ? 'HIGH' : 'LOW',
                action: features.amount > 50000 ? 'FLAGGED' : 'APPROVED',
                model_used: 'SERVER_FALLBACK'
            };
        }

        // Get explanation
        let explanation = null;
        try {
            const explainRes = await axios.post(`${ML_URL}/explain`, features, { timeout: 5000 });
            explanation = explainRes.data;
        } catch (err) {}

        res.json({
            success: true,
            simulation: {
                input: features,
                prediction,
                explanation
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;