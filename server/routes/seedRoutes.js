const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const mongoose = require('mongoose');

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Jaipur'];
const banks = ['@okicici', '@okhdfcbank', '@oksbi', '@okaxis', '@paytm', '@ybl'];
const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const actions = ['APPROVED', 'REVIEW', 'FLAGGED', 'BLOCKED'];

function randomUPI(prefix) {
    const bank = banks[Math.floor(Math.random() * banks.length)];
    return `${prefix}${Math.floor(Math.random() * 9000 + 1000)}${bank}`;
}

function randomAmount(isFraud) {
    if (isFraud) return Math.round((Math.random() * 85000 + 15000) * 100) / 100;
    return Math.round((Math.random() * 8000 + 100) * 100) / 100;
}

router.post('/', async (req, res) => {
    try {
        console.log('\n🔄 [SEED] Starting database seed...');
        console.log(`📊 [SEED] DB Connection State: ${mongoose.connection.readyState}`);

        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ [SEED] Database not connected. State:', mongoose.connection.readyState);
            return res.status(503).json({
                success: false,
                message: 'Database not connected',
                connectionState: mongoose.connection.readyState,
                states: { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' },
                hint: 'Check MONGODB_URI in .env and ensure MongoDB service is running'
            });
        }

        console.log('✅ [SEED] Database connected');

        // 1. Create demo user
        console.log('👤 [SEED] Checking for existing admin user...');
        let demoUser = null;

        try {
            const existingUser = await User.findOne({ email: 'admin@upishield.com' }).lean();

            if (existingUser) {
                demoUser = existingUser;
                console.log('ℹ️  [SEED] Demo user already exists:', demoUser._id);
            } else {
                console.log('➕ [SEED] Creating new demo user...');
                const newUser = await User.create({
                    name: 'Admin User',
                    email: 'admin@upishield.com',
                    password: 'admin123',
                    phone: '+91-9876543210',
                    upiId: 'admin@okicici',
                    role: 'admin'
                });
                demoUser = newUser.toObject();
                console.log('✅ [SEED] Demo user created:', demoUser._id);
            }
        } catch (userErr) {
            console.error('❌ [SEED] User error:', userErr.message);
            return res.status(500).json({
                success: false,
                message: 'User creation failed',
                error: userErr.message
            });
        }

        // 2. Clear old demo data
        try {
            console.log('🗑️  [SEED] Clearing old data...');
            await Transaction.deleteMany({}).catch(() => {});
            await Alert.deleteMany({}).catch(() => {});
            console.log('✅ [SEED] Old data cleared');
        } catch (delErr) {
            console.warn('⚠️  [SEED] Cleanup warning:', delErr.message);
        }

        // 3. Create transactions
        console.log('📝 [SEED] Creating 80 transactions...');
        const transactions = [];
        const now = new Date();
        const fraudReasons = [
            'High transaction amount',
            'Unusual hour',
            'Location mismatch',
            'Failed PIN attempts',
            'Unrecognized device'
        ];

        for (let i = 0; i < 80; i++) {
            const isFraud = Math.random() < 0.2;
            const amount = isFraud
                ? Math.round((Math.random() * 85000 + 15000) * 100) / 100
                : Math.round((Math.random() * 8000 + 100) * 100) / 100;

            const riskIdx = isFraud ? Math.floor(Math.random() * 2 + 2) : Math.floor(Math.random() * 2);
            const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
            const actions = ['APPROVED', 'REVIEW', 'FLAGGED', 'BLOCKED'];
            const riskLevel = riskLevels[riskIdx];
            const action = actions[riskIdx];
            const riskScore = isFraud ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 30 + 5);

            const txnDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            const topReason = isFraud ? fraudReasons[Math.floor(Math.random() * fraudReasons.length)] : 'Normal';

            transactions.push({
                userId: demoUser._id,
                amount,
                receiverUpi: isFraud ? `unknown${Math.floor(Math.random() * 9000 + 1000)}@unknownbank` : `merchant${Math.floor(Math.random() * 9000 + 1000)}@okicici`,
                receiverName: isFraud ? 'Unknown' : 'Store',
                transactionType: 'SEND',
                remarks: topReason,
                riskScore,
                riskLevel,
                isFraud,
                action,
                modelUsed: 'XGBOOST',
                topReason,
                features: {},
                reviewed: false,
                createdAt: txnDate,
                updatedAt: txnDate
            });
        }

        try {
            const insertedTxns = await Transaction.insertMany(transactions, { ordered: false });
            console.log(`✅ [SEED] Inserted ${insertedTxns.length} transactions`);

            const fraudTxns = insertedTxns.filter(t => t.isFraud || t.riskLevel === 'HIGH' || t.riskLevel === 'CRITICAL');

            if (fraudTxns.length > 0) {
                const alerts = fraudTxns.map((txn) => ({
                    txn_id: txn._id,
                    transaction_id: txn._id.toString(),
                    alert_type: txn.riskLevel === 'CRITICAL' ? 'FRAUD_DETECTED' : 'SUSPICIOUS_ACTIVITY',
                    severity: txn.riskLevel,
                    message: `Suspicious: ₹${txn.amount} — ${txn.topReason}`,
                    details: {
                        amount: txn.amount,
                        sender: 'admin@okicici',
                        receiver: txn.receiverUpi,
                        fraud_probability: txn.riskScore
                    },
                    status: 'ACTIVE',
                    createdAt: txn.createdAt,
                    updatedAt: txn.updatedAt
                }));

                try {
                    await Alert.insertMany(alerts, { ordered: false });
                    console.log(`✅ [SEED] Inserted ${alerts.length} alerts`);
                } catch (alertErr) {
                    console.warn('⚠️  [SEED] Alert insert warning:', alertErr.message);
                }
            }

            return res.json({
                success: true,
                message: 'Database seeded successfully!',
                data: {
                    user: { email: 'admin@upishield.com', password: 'admin123' },
                    transactions: insertedTxns.length,
                    alerts: fraudTxns.length
                }
            });

        } catch (insertErr) {
            console.error('❌ [SEED] Insert error:', insertErr.message);
            return res.status(500).json({
                success: false,
                message: 'Database insert failed',
                error: insertErr.message
            });
        }

    } catch (error) {
        console.error('❌ [SEED] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message,
            error: error.name
        });
    }
});

module.exports = router;
