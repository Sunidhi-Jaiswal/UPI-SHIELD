const generateTransaction = require('../utils/generateTransaction');
const ruleEngine = require('../services/ruleEngine');
const mlBridge = require('../services/mlBridge');
const hashChain = require('../services/hashChain');
const { updateStats } = require('../controllers/statsController');

let simulationInterval = null;

const initSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Send current stats immediately on connect
        socket.emit('system_status', {
            status: 'online',
            connectedAt: new Date().toISOString(),
            message: 'Connected to UPI Shield Real-Time Engine'
        });

        socket.on('request_simulation', async () => {
            try {
                const result = await simulateOneTransaction(io);
                socket.emit('simulation_result', result);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });

    // Auto-simulate transactions every 4 seconds for live dashboard
    startAutoSimulation(io);
};

async function simulateOneTransaction(io) {
    const fraudRate = 0.18;
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

    // Update stats
    updateStats(result);

    // Emit to all connected clients
    io.emit('new_transaction', result);

    if (result.risk_level === 'CRITICAL' || result.risk_level === 'HIGH') {
        io.emit('fraud_alert', {
            ...result,
            alert_type: result.risk_level === 'CRITICAL' ? 'FRAUD_DETECTED' : 'SUSPICIOUS_ACTIVITY',
            severity: result.risk_level,
            message: `⚠️ ${result.risk_level} risk: ₹${result.amount.toLocaleString()} from ${result.sender}`
        });
    }

    return result;
}

function startAutoSimulation(io) {
    if (simulationInterval) clearInterval(simulationInterval);
    
    simulationInterval = setInterval(async () => {
        try {
            if (io.engine && io.engine.clientsCount > 0) {
                await simulateOneTransaction(io);
            }
        } catch (err) {
            // Silent fail — don't crash server on simulation error
        }
    }, 4000); // Every 4 seconds

    console.log('🔄 Auto-simulation started (every 4s)');
}

module.exports = { initSocket };