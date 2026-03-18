const generateTransaction = require('../utils/generateTransaction');
const ruleEngine = require('../services/ruleEngine');
const mlBridge = require('../services/mlBridge');
const hashChain = require('../services/hashChain');

exports.simulateOne = async (req, res) => {
    try {
        const fraudRate = req.body.fraudRate || 0.15;
        const txn = generateTransaction(fraudRate);

        const ruleResult = ruleEngine.evaluate(txn);
        let mlResult;

        if (ruleResult.skip_ml) {
            mlResult = {
                is_fraud: 1,
                fraud_probability: 95,
                risk_level: 'CRITICAL',
                action: 'BLOCKED',
                top_reason: ruleResult.primary_rule.description
            };
        } else {
            mlResult = await mlBridge.predict(txn);
        }

        const result = {
            transaction_id: txn.transaction_id,
            sender: txn.sender_upi,
            receiver: txn.receiver_upi,
            amount: txn.amount,
            hour: txn.hour,
            city: txn.city,
            is_fraud: mlResult.is_fraud,
            fraud_probability: mlResult.fraud_probability,
            risk_level: mlResult.risk_level,
            action: mlResult.action,
            top_reason: mlResult.top_reason,
            rules_triggered: ruleResult.rules_triggered,
            timestamp: new Date().toISOString()
        };

        // Blockchain
        const block = hashChain.addBlock(result);
        result.block_hash = block.hash;

        // Emit real-time
        const io = req.app.get('io');
        if (io) {
            io.emit('new_transaction', result);
            if (result.risk_level === 'CRITICAL') {
                io.emit('fraud_alert', result);
            }
        }

        res.json({ success: true, data: result });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.simulateBulk = async (req, res) => {
    try {
        const { count = 10, fraudRate = 0.15 } = req.body;
        const results = [];

        for (let i = 0; i < Math.min(count, 100); i++) {
            const txn = generateTransaction(fraudRate);
            const ruleResult = ruleEngine.evaluate(txn);
            const mlResult = ruleResult.skip_ml
                ? { is_fraud: 1, fraud_probability: 95, risk_level: 'CRITICAL', action: 'BLOCKED' }
                : await mlBridge.predict(txn);

            results.push({
                transaction_id: txn.transaction_id,
                amount: txn.amount,
                is_fraud: mlResult.is_fraud,
                fraud_probability: mlResult.fraud_probability,
                risk_level: mlResult.risk_level,
                action: mlResult.action
            });
        }

        const summary = {
            total: results.length,
            frauds: results.filter(r => r.is_fraud).length,
            blocked: results.filter(r => r.action === 'BLOCKED').length,
            flagged: results.filter(r => r.action === 'FLAGGED').length,
            approved: results.filter(r => r.action === 'APPROVED').length,
            total_amount: results.reduce((sum, r) => sum + r.amount, 0).toFixed(2)
        };

        res.json({ success: true, summary, data: results });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};