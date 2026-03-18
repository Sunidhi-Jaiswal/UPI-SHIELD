/**
 * ML BRIDGE — Connects Node.js to Python ML Service
 * Sends transaction features, receives predictions
 */

const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

class MLBridge {
    constructor() {
        this.client = axios.create({
            baseURL: ML_URL,
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });
        this.isAvailable = false;
        this.checkHealth();
    }

    async checkHealth() {
        try {
            const res = await this.client.get('/health');
            this.isAvailable = res.data.status === 'online';
            console.log(`🤖 ML Service: ${this.isAvailable ? '✅ Connected' : '❌ Offline'}`);
        } catch (err) {
            this.isAvailable = false;
            console.log('🤖 ML Service: ❌ Offline (will use fallback)');
        }
    }

    async predict(transactionData) {
        try {
            if (!this.isAvailable) {
                await this.checkHealth();
            }

            if (!this.isAvailable) {
                return this.fallbackPredict(transactionData);
            }

            const response = await this.client.post('/predict', {
                amount: transactionData.amount,
                hour: transactionData.hour,
                transaction_frequency: transactionData.transaction_frequency,
                is_new_device: transactionData.is_new_device ? 1 : 0,
                location_change: transactionData.location_change ? 1 : 0,
                is_new_receiver: transactionData.is_new_receiver ? 1 : 0,
                failed_pin_attempts: transactionData.failed_pin_attempts,
                avg_daily_transaction: transactionData.avg_daily_transaction,
                transaction_speed_sec: transactionData.transaction_speed_sec
            });

            return response.data;

        } catch (error) {
            console.error('ML Bridge error:', error.message);
            this.isAvailable = false;
            return this.fallbackPredict(transactionData);
        }
    }

    async getExplanation(transactionData) {
        try {
            if (!this.isAvailable) return null;

            const response = await this.client.post('/explain', transactionData);
            return response.data;
        } catch (error) {
            return null;
        }
    }

    // Fallback when Python service is down
    fallbackPredict(txn) {
        let score = 0;

        // Simple scoring logic
        if (txn.amount > 20000) score += 25;
        if (txn.amount > 50000) score += 20;
        if (txn.hour >= 0 && txn.hour <= 5) score += 20;
        if (txn.hour >= 22 || txn.hour <= 4) score += 10;
        if (txn.is_new_device) score += 15;
        if (txn.location_change) score += 15;
        if (txn.is_new_receiver) score += 10;
        if (txn.failed_pin_attempts > 2) score += 20;
        if (txn.failed_pin_attempts > 4) score += 15;
        if (txn.transaction_speed_sec < 3) score += 15;
        if (txn.transaction_frequency > 8) score += 10;
        if (txn.avg_daily_transaction > 30000) score += 10;

        score = Math.min(score, 99);

        let risk_level, action;
        if (score >= 75) { risk_level = 'CRITICAL'; action = 'BLOCKED'; }
        else if (score >= 50) { risk_level = 'HIGH'; action = 'FLAGGED'; }
        else if (score >= 30) { risk_level = 'MEDIUM'; action = 'REVIEW'; }
        else { risk_level = 'LOW'; action = 'APPROVED'; }

        return {
            is_fraud: score >= 50 ? 1 : 0,
            fraud_probability: score,
            risk_level,
            action,
            model_used: 'FALLBACK_SCORING',
            shap_values: {
                amount: txn.amount > 20000 ? 0.3 : 0.05,
                hour: (txn.hour <= 5 || txn.hour >= 22) ? 0.25 : 0.03,
                new_device: txn.is_new_device ? 0.2 : 0.02,
                location_change: txn.location_change ? 0.2 : 0.02,
                failed_pins: txn.failed_pin_attempts > 2 ? 0.25 : 0.02,
                speed: txn.transaction_speed_sec < 3 ? 0.2 : 0.03,
                frequency: txn.transaction_frequency > 8 ? 0.15 : 0.02,
                new_receiver: txn.is_new_receiver ? 0.12 : 0.02,
                avg_daily: txn.avg_daily_transaction > 30000 ? 0.1 : 0.02
            },
            top_reason: this.getTopReason(txn, score)
        };
    }

    getTopReason(txn, score) {
        const reasons = [];
        if (txn.amount > 20000) reasons.push('High transaction amount');
        if (txn.hour <= 5 || txn.hour >= 22) reasons.push('Unusual transaction hour');
        if (txn.is_new_device) reasons.push('Unrecognized device');
        if (txn.location_change) reasons.push('Location mismatch');
        if (txn.failed_pin_attempts > 2) reasons.push('Multiple failed PIN attempts');
        if (txn.transaction_speed_sec < 3) reasons.push('Suspiciously fast transaction');

        return reasons.length > 0
            ? reasons.join(', ')
            : 'Normal transaction pattern';
    }
}

module.exports = new MLBridge();