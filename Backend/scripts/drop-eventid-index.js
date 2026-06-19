#!/usr/bin/env node
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI;

async function run() {
    try {
        await mongoose.connect(MONGO);
        console.log('Connected to MongoDB', MONGO);
        const db = mongoose.connection.db;
        const collection = db.collection('transactions');
        const indexes = await collection.indexes();
        console.log('Existing indexes:', indexes.map(i=>i.name));
        const target = indexes.find(i => i.name === 'eventId_1');
        if (target) {
            console.log('Dropping index eventId_1');
            await collection.dropIndex('eventId_1');
            console.log('Dropped index eventId_1');
        } else {
            console.log('Index eventId_1 not found, nothing to drop');
        }
    } catch (err) {
        console.error('Error', err.message || err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

run();

