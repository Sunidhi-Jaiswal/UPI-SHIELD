const Alert = require('../models/Alert');

exports.getAlerts = async (req, res) => {
    try {
        const { status, severity, limit = 50 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (severity) filter.severity = severity;

        let alerts;
        try {
            alerts = await Alert.find(filter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));
        } catch (dbErr) {
            // If DB is not connected, return empty
            alerts = [];
        }

        res.json({ success: true, count: alerts.length, data: alerts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.acknowledgeAlert = async (req, res) => {
    try {
        const alert = await Alert.findByIdAndUpdate(
            req.params.id,
            {
                status: 'ACKNOWLEDGED',
                acknowledged_by: req.user ? req.user.username : 'admin',
                acknowledged_at: new Date()
            },
            { new: true }
        );

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAlertStats = async (req, res) => {
    try {
        let stats;
        try {
            stats = {
                total: await Alert.countDocuments(),
                active: await Alert.countDocuments({ status: 'ACTIVE' }),
                acknowledged: await Alert.countDocuments({ status: 'ACKNOWLEDGED' }),
                critical: await Alert.countDocuments({ severity: 'CRITICAL' }),
                high: await Alert.countDocuments({ severity: 'HIGH' })
            };
        } catch (dbErr) {
            stats = { total: 0, active: 0, acknowledged: 0, critical: 0, high: 0 };
        }

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};