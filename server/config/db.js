const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 7+ doesn't need these options but keeping for safety
        });
        
        console.log(`✅ MongoDB Connected: Successfully`);
        console.log(`📊 Database: ${conn.connection.name || 'upi-shield'}`);
        
    } catch (error) {
        console.error(`❌ MongoDB Error: ${error.message}`);
        // Don't exit — run without DB in demo mode
        console.log('⚠️  Running in DEMO MODE without database');
    }
};

module.exports = connectDB;