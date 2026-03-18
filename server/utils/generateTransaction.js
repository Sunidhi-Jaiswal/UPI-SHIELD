/**
 * TRANSACTION GENERATOR
 * Creates realistic simulated UPI transactions
 * Some are fraudulent based on fraudRate
 */

const crypto = require('crypto');

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow', 'Ahmedabad'];
const banks = ['@okicici', '@okhdfcbank', '@oksbi', '@okaxis', '@paytm', '@ybl', '@ibl', '@apl'];

function generateTransaction(fraudRate = 0.15) {
    const isFraud = Math.random() < fraudRate;
    const txnId = 'TXN' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const senderBank = banks[Math.floor(Math.random() * banks.length)];
    const receiverBank = banks[Math.floor(Math.random() * banks.length)];

    if (isFraud) {
        return {
            transaction_id: txnId,
            sender_upi: `user${Math.floor(Math.random() * 9000 + 1000)}${senderBank}`,
            receiver_upi: `unknown${Math.floor(Math.random() * 900 + 100)}${receiverBank}`,
            amount: Math.round((Math.random() * 85000 + 15000) * 100) / 100,
            hour: [0, 1, 2, 3, 4, 23, 22][Math.floor(Math.random() * 7)],
            transaction_frequency: Math.floor(Math.random() * 20 + 8),
            is_new_device: true,
            location_change: Math.random() > 0.2,
            is_new_receiver: Math.random() > 0.15,
            failed_pin_attempts: Math.floor(Math.random() * 6 + 2),
            avg_daily_transaction: Math.round((Math.random() * 60000 + 20000) * 100) / 100,
            transaction_speed_sec: Math.round((Math.random() * 2.5 + 0.5) * 100) / 100,
            device_fingerprint: crypto.randomBytes(8).toString('hex'),
            ip_address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            city: cities[Math.floor(Math.random() * cities.length)]
        };
    } else {
        return {
            transaction_id: txnId,
            sender_upi: `user${Math.floor(Math.random() * 9000 + 1000)}${senderBank}`,
            receiver_upi: `shop${Math.floor(Math.random() * 900 + 100)}${receiverBank}`,
            amount: Math.round((Math.random() * 8000 + 50) * 100) / 100,
            hour: Math.floor(Math.random() * 14 + 7), // 7 AM to 9 PM
            transaction_frequency: Math.floor(Math.random() * 4 + 1),
            is_new_device: false,
            location_change: false,
            is_new_receiver: Math.random() > 0.75,
            failed_pin_attempts: 0,
            avg_daily_transaction: Math.round((Math.random() * 5000 + 500) * 100) / 100,
            transaction_speed_sec: Math.round((Math.random() * 40 + 8) * 100) / 100,
            device_fingerprint: crypto.randomBytes(8).toString('hex'),
            ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            city: cities[Math.floor(Math.random() * 3)] // Stays in familiar cities
        };
    }
}

module.exports = generateTransaction;