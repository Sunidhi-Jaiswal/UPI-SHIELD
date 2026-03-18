const mlBridge = require('../services/mlBridge');
const ruleEngine = require('../services/ruleEngine');
const hashChain = require('../services/hashChain');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');

exports.predictTransaction = async (req, res) => {
    try {
        const txnData = req.body;
        const io = req.app.get('io');

        // Generate transaction ID if not provided
        if (!txnData.transaction_id) {
            txnData.transaction_id = 'TXN' + Date.now().toString(36).toUpperCase();
        }

        // Layer 1: Rule Engine
        const ruleResult = ruleEngine.evaluate(txnData);

        let mlResult;
        let detectionMethod = 'RULE_ENGINE';

        if (ruleResult.skip_ml) {
            mlResult = {
                is_fraud: 1,
                fraud_probability: 95,
                risk_level: ruleResult.severity,
                action: ruleResult.action,
                shap_values: {},
                top_reason: ruleResult.primary_rule.description
            };
        } else {
            // Layer 2: ML Model
            mlResult = await mlBridge.predict(txnData);
            detectionMethod = ruleResult.triggered ? 'HYBRID' : 'ML_MODEL';
        }

        // Build response
        const result = {
            transaction_id: txnData.transaction_id,
            sender: txnData.sender_upi || 'user@upi',
            receiver: txnData.receiver_upi || 'merchant@upi',
            amount: txnData.amount,
            timestamp: new Date().toISOString(),
            is_fraud: mlResult.is_fraud,
            fraud_probability: mlResult.fraud_probability,
            risk_level: mlResult.risk_level,
            action: mlResult.action,
            detection_method: detectionMethod,
            shap_values: mlResult.shap_values,
            top_reason: mlResult.top_reason,
            rules_triggered: ruleResult.rules_triggered,
            model_used: mlResult.model_used || 'XGBOOST'
        };

        // Blockchain log
        const block = hashChain.addBlock(result);
        result.block_hash = block.hash;

        // Save to DB (non-blocking)
        Transaction.create({
            ...txnData,
            ...result,
            shap_values: new Map(Object.entries(mlResult.shap_values || {}))
        }).catch(err => console.error('DB save error:', err.message));

        // Create alert if fraud
        if (mlResult.is_fraud || result.risk_level === 'HIGH' || result.risk_level === 'CRITICAL') {
            Alert.create({
                transaction_id: result.transaction_id,
                alert_type: 'FRAUD_DETECTED',
                severity: result.risk_level,
                message: `Suspicious transaction of ₹${result.amount} detected`,
                details: {
                    amount: result.amount,
                    sender: result.sender,
                    receiver: result.receiver,
                    fraud_probability: result.fraud_probability,
                    risk_factors: ruleResult.rules_triggered.map(r => r.name)
                }
            }).catch(err => console.error('Alert save error:', err.message));
        }

        // Emit real-time
        if (io) {
            io.emit('new_transaction', result);
            if (result.risk_level === 'CRITICAL') {
                io.emit('fraud_alert', result);
            }
        }

        res.json({ success: true, data: result });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.batchPredict = async (req, res) => {
    try {
        const { transactions } = req.body;

        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({
                success: false,
                message: 'transactions array required'
            });
        }

        const results = [];
        for (const txn of transactions) {
            const ruleResult = ruleEngine.evaluate(txn);
            const mlResult = ruleResult.skip_ml
                ? { is_fraud: 1, fraud_probability: 95, risk_level: 'CRITICAL', action: 'BLOCKED' }
                : await mlBridge.predict(txn);

            results.push({
                transaction_id: txn.transaction_id || `TXN${Date.now()}`,
                amount: txn.amount,
                is_fraud: mlResult.is_fraud,
                fraud_probability: mlResult.fraud_probability,
                risk_level: mlResult.risk_level,
                action: mlResult.action
            });
        }

        res.json({
            success: true,
            total: results.length,
            frauds: results.filter(r => r.is_fraud).length,
            data: results
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};