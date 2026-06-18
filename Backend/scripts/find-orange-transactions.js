#!/usr/bin/env node
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/monnayeur';

async function run() {
    try {
        await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB', MONGO);
        const Transaction = require('../src/models/transaction.model');
        const docs = await Transaction.find({ orangeMerchantCode: '614841' }).sort({ createdAt: -1 }).limit(10).lean();
        console.log('Found', docs.length, 'transactions for merchant 614841');
        docs.forEach(d => {
            console.log('---');
            console.log('transactionId:', d.transactionId);
            console.log('status:', d.status);
            console.log('amountFcfa:', d.amountFcfa);
            console.log('orangeTransactionId:', d.orangeTransactionId);
            console.log('paidAt:', d.paidAt);
            console.log('createdAt:', d.createdAt);
            console.log('orangeCallbackPayload:', JSON.stringify(d.orangeCallbackPayload));
        });
    } catch (err) {
        console.error('Error', err.message || err);
    } finally {
        await mongoose.disconnect();
    }
}

run();

