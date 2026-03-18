const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
require('dotenv').config();

const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
let mlServiceStatus = 'checking';

// Socket.IO Setup
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.set('io', io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========================
// HEALTH CHECK
// ========================
app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        status: 'online',
        service: 'UPI Shield Backend',
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        mlService: mlServiceStatus,
        endpoints: {
            auth: '/api/auth',
            predict: '/api/predict',
            stats: '/api/stats',
            simulate: '/api/simulate',
            alerts: '/api/alerts'
        }
    });
});

// ========================
// SAFE ROUTE LOADING
// ========================
const loadRoute = (path, routeName) => {
    try {
        return require(path);
    } catch (err) {
        console.log(`⚠️  Route not loaded: ${routeName}`);
        const router = express.Router();
        router.all('*', (req, res) => {
            res.status(503).json({ error: `${routeName} service not available` });
        });
        return router;
    }
};

app.use('/api/auth', loadRoute('./routes/authRoutes', 'Auth'));
app.use('/api/predict', loadRoute('./routes/predictionRoutes', 'Prediction'));
app.use('/api/stats', loadRoute('./routes/statsRoutes', 'Stats'));
app.use('/api/simulate', loadRoute('./routes/simulationRoutes', 'Simulation'));
app.use('/api/alerts', loadRoute('./routes/alertRoutes', 'Alerts'));
app.use('/api/seed', loadRoute('./routes/seedRoutes', 'Seed'));

// 404
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

app.use(errorHandler);
initSocket(io);

// ========================
// START SERVER (Everything prints ONCE here)
// ========================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // 1. Connect DB
    await connectDB();

    // 2. Check ML
    try {
        const res = await axios.get(`${ML_URL}/health`, { timeout: 3000 });
        if (res.data.status === 'online') {
            mlServiceStatus = 'online';
        }
    } catch (err) {
        mlServiceStatus = 'offline';
    }

    // 3. Start listening
    server.listen(PORT, () => {
        console.log(`
    ╔══════════════════════════════════════════╗
    ║   🛡️  UPI SHIELD BACKEND SERVER          ║
    ║   🚀 Running on port ${PORT}                ║
    ║   📡 Socket.IO Ready                     ║
    ║   🔗 http://localhost:${PORT}               ║
    ╠══════════════════════════════════════════╣
    ║   🤖 ML Service: ${mlServiceStatus === 'online' ? '✅ Connected' : '❌ Offline (fallback)'}${mlServiceStatus === 'online' ? '          ' : ''}  ║
    ╚══════════════════════════════════════════╝
        `);
    });
};

startServer();

module.exports = { app, server, io };