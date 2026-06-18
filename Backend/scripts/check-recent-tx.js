#!/usr/bin/env node
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/monnayeur';

async function run() {
    try {
        await mongoose.connect(MONGO);
        console.log('Connected to MongoDB', MONGO);
        const Transaction = require('../src/models/transaction.model');
        const docs = await Transaction.find({}).sort({ createdAt: -1 }).limit(5).lean();
        console.log('Last 5 transactions in database:');
        docs.forEach(d => {
            console.log('---');
            console.log('transactionId:', d.transactionId);
            console.log('machineId:', d.machineId);
            console.log('status:', d.status);
            console.log('amountFcfa:', d.amountFcfa);
            console.log('orangeMerchantCode:', d.orangeMerchantCode);
            console.log('failureReason:', d.failureReason);
            console.log('createdAt:', d.createdAt);
        });
    } catch (err) {
        console.error('Error:', err.message || err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
