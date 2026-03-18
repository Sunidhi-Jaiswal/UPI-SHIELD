/**
 * RULE ENGINE — Layer 1 of UPI Shield
 * Instant fraud detection based on predefined rules
 * Runs BEFORE ML model for immediate blocking
 */

class RuleEngine {
    constructor() {
        this.rules = [
            {
                id: 'RULE_001',
                name: 'High Amount Odd Hour',
                description: 'Transaction > ₹25,000 between 12AM-5AM',
                check: (txn) => txn.amount > 25000 && (txn.hour >= 0 && txn.hour <= 5),
                severity: 'CRITICAL',
                action: 'BLOCKED'
            },
            {
                id: 'RULE_002',
                name: 'Multiple Failed PINs',
                description: 'More than 3 failed PIN attempts',
                check: (txn) => txn.failed_pin_attempts > 3,
                severity: 'CRITICAL',
                action: 'BLOCKED'
            },
            {
                id: 'RULE_003',
                name: 'Rapid Fire Transactions',
                description: 'Transaction speed under 2 seconds with high frequency',
                check: (txn) => txn.transaction_speed_sec < 2 && txn.transaction_frequency > 10,
                severity: 'HIGH',
                action: 'FLAGGED'
            },
            {
                id: 'RULE_004',
                name: 'New Device + New Location + High Amount',
                description: 'Triple threat: new device, changed location, amount > ₹15,000',
                check: (txn) => txn.is_new_device && txn.location_change && txn.amount > 15000,
                severity: 'HIGH',
                action: 'FLAGGED'
            },
            {
                id: 'RULE_005',
                name: 'Extreme Amount',
                description: 'Transaction amount exceeds ₹80,000',
                check: (txn) => txn.amount > 80000,
                severity: 'HIGH',
                action: 'FLAGGED'
            },
            {
                id: 'RULE_006',
                name: 'Velocity Check',
                description: 'Daily transaction amount exceeds ₹50,000 with high frequency',
                check: (txn) => txn.avg_daily_transaction > 50000 && txn.transaction_frequency > 8,
                severity: 'MEDIUM',
                action: 'REVIEW'
            },
            {
                id: 'RULE_007',
                name: 'New Receiver High Amount',
                description: 'Sending > ₹20,000 to new receiver',
                check: (txn) => txn.is_new_receiver && txn.amount > 20000,
                severity: 'MEDIUM',
                action: 'REVIEW'
            }
        ];
    }

    evaluate(transaction) {
        const triggeredRules = [];

        for (const rule of this.rules) {
            try {
                if (rule.check(transaction)) {
                    triggeredRules.push({
                        rule_id: rule.id,
                        name: rule.name,
                        description: rule.description,
                        severity: rule.severity,
                        action: rule.action
                    });
                }
            } catch (err) {
                console.error(`Rule ${rule.id} error:`, err.message);
            }
        }

        // Get highest severity action
        let finalAction = 'APPROVED';
        let finalSeverity = 'LOW';
        let primaryRule = null;

        const actionPriority = { 'BLOCKED': 4, 'FLAGGED': 3, 'REVIEW': 2, 'APPROVED': 1 };
        const severityPriority = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };

        for (const rule of triggeredRules) {
            if (actionPriority[rule.action] > actionPriority[finalAction]) {
                finalAction = rule.action;
                finalSeverity = rule.severity;
                primaryRule = rule;
            }
        }

        return {
            triggered: triggeredRules.length > 0,
            rules_triggered: triggeredRules,
            rules_count: triggeredRules.length,
            action: finalAction,
            severity: finalSeverity,
            primary_rule: primaryRule,
            should_block: finalAction === 'BLOCKED',
            skip_ml: finalAction === 'BLOCKED' // No need for ML if rule already blocks
        };
    }
}

module.exports = new RuleEngine();