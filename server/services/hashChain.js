/**
 * BLOCKCHAIN AUDIT TRAIL
 * Simple hash-chain for tamper-proof transaction logging
 * Each block contains txn data + hash of previous block
 */

const crypto = require('crypto');

class HashChain {
    constructor() {
        this.chain = [];
        // Genesis block
        this.addBlock({
            transaction_id: 'GENESIS',
            action: 'SYSTEM_INITIALIZED',
            message: 'UPI Shield Blockchain Audit Trail Started'
        });
    }

    calculateHash(block) {
        const data = JSON.stringify({
            index: block.index,
            timestamp: block.timestamp,
            data: block.data,
            previousHash: block.previousHash,
            nonce: block.nonce
        });
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    addBlock(transactionData) {
        const previousBlock = this.chain.length > 0
            ? this.chain[this.chain.length - 1]
            : null;

        const block = {
            index: this.chain.length,
            timestamp: new Date().toISOString(),
            data: {
                transaction_id: transactionData.transaction_id,
                action: transactionData.action,
                amount: transactionData.amount,
                risk_level: transactionData.risk_level,
                fraud_probability: transactionData.fraud_probability,
                is_fraud: transactionData.is_fraud
            },
            previousHash: previousBlock ? previousBlock.hash : '0'.repeat(64),
            nonce: Math.floor(Math.random() * 100000),
            hash: ''
        };

        block.hash = this.calculateHash(block);
        this.chain.push(block);

        return block;
    }

    verifyChain() {
        for (let i = 1; i < this.chain.length; i++) {
            const current = this.chain[i];
            const previous = this.chain[i - 1];

            // Check hash integrity
            if (current.previousHash !== previous.hash) {
                return {
                    valid: false,
                    broken_at: i,
                    message: `Chain broken at block ${i}`
                };
            }

            // Recalculate hash
            const recalculated = this.calculateHash(current);
            if (current.hash !== recalculated) {
                return {
                    valid: false,
                    tampered_at: i,
                    message: `Block ${i} has been tampered`
                };
            }
        }

        return {
            valid: true,
            blocks: this.chain.length,
            message: 'Blockchain integrity verified ✅'
        };
    }

    getChain() {
        return this.chain;
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    getStats() {
        return {
            total_blocks: this.chain.length,
            latest_hash: this.getLatestBlock().hash.substring(0, 16) + '...',
            chain_valid: this.verifyChain().valid,
            genesis_time: this.chain[0].timestamp
        };
    }
}

module.exports = new HashChain();