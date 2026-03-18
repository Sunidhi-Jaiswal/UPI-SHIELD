const mlBridge = require('./mlBridge');
const ruleEngine = require('./ruleEngine');
const hashChain = require('./hashChain');
const generateTransaction = require('../utils/generateTransaction');

// Store active simulations per socket
const activeSimulations = new Map();

const socketHandler = {
    startSimulation(io, socket, config = {}) {
        // Stop any existing simulation for this socket
        this.stopSimulation(socket);

        const speed = config.speed || 3000; // ms between transactions
        const fraudRate = config.fraudRate || 0.15;

        const intervalId = setInterval(async () => {
            try {
                const txn = generateTransaction(fraudRate);
                const result = await this.processTransaction(txn);

                // Emit to ALL connected clients
                io.emit('new_transaction', result);

                // If fraud, emit special alert
                if (result.risk_level === 'CRITICAL' || result.risk_level === 'HIGH') {
                    io.emit('fraud_alert', {
                        transaction_id: result.transaction_id,
                        amount: result.amount,
                        fraud_probability: result.fraud_probability,
                        risk_level: result.risk_level,
                        action: result.action,
                        reason: result.top_reason,
                        timestamp: result.timestamp
                    });
                }

            } catch (err) {
                console.error('Simulation error:', err.message);
            }
        }, speed);

        activeSimulations.set(socket.id, intervalId);

        socket.emit('simulation_status', {
            status: 'RUNNING',
            speed,
            fraudRate,
            message: 'Live simulation started'
        });
    },

    stopSimulation(socket) {
        const intervalId = activeSimulations.get(socket.id);
        if (intervalId) {
            clearInterval(intervalId);
            activeSimulations.delete(socket.id);
            socket.emit('simulation_status', {
                status: 'STOPPED',
                message: 'Simulation stopped'
            });
        }
    },

    async processTransaction(txn) {
        // Layer 1: Rule Engine
        const ruleResult = ruleEngine.evaluate(txn);

        let mlResult;
        let detectionMethod = 'RULE_ENGINE';

        if (ruleResult.skip_ml) {
            // Rule engine already blocked it
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
            mlResult = await mlBridge.predict(txn);
            detectionMethod = ruleResult.triggered ? 'HYBRID' : 'ML_MODEL';

            // If rule flagged but ML says safe, use rule (conservative)
            if (ruleResult.triggered && mlResult.fraud_probability < 30) {
                mlResult.risk_level = ruleResult.severity;
                mlResult.action = ruleResult.action;
                detectionMethod = 'HYBRID';
            }
        }

        // Build final result
        const result = {
            transaction_id: txn.transaction_id,
            sender: txn.sender_upi,
            receiver: txn.receiver_upi,
            amount: txn.amount,
            hour: txn.hour,
            timestamp: new Date().toISOString(),

            // Detection results
            is_fraud: mlResult.is_fraud,
            fraud_probability: mlResult.fraud_probability,
            risk_level: mlResult.risk_level,
            action: mlResult.action,
            detection_method: detectionMethod,

            // XAI
            shap_values: mlResult.shap_values || {},
            top_reason: mlResult.top_reason || 'Normal pattern',
            risk_factors: this.getRiskFactors(txn),

            // Rule info
            rules_triggered: ruleResult.rules_triggered,

            // Transaction details
            details: {
                is_new_device: txn.is_new_device,
                location_change: txn.location_change,
                is_new_receiver: txn.is_new_receiver,
                failed_pin_attempts: txn.failed_pin_attempts,
                transaction_frequency: txn.transaction_frequency,
                transaction_speed_sec: txn.transaction_speed_sec,
                avg_daily_transaction: txn.avg_daily_transaction
            }
        };

        // Add to blockchain
        const block = hashChain.addBlock(result);
        result.block_hash = block.hash;

        return result;
    },

    getRiskFactors(txn) {
        const factors = [];
        if (txn.amount > 15000) factors.push('High amount');
        if (txn.hour <= 5 || txn.hour >= 22) factors.push('Odd hour');
        if (txn.is_new_device) factors.push('New device');
        if (txn.location_change) factors.push('Location changed');
        if (txn.is_new_receiver) factors.push('New receiver');
        if (txn.failed_pin_attempts > 2) factors.push('Failed PINs');
        if (txn.transaction_speed_sec < 3) factors.push('Rapid transaction');
        if (txn.transaction_frequency > 8) factors.push('High frequency');
        return factors;
    },

    async handlePrediction(io, socket, data) {
        const result = await this.processTransaction(data);
        socket.emit('prediction_result', result);
        io.emit('new_transaction', result);
    }
};

module.exports = socketHandler;