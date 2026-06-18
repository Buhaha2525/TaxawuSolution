#!/usr/bin/env node
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/monnayeur';
const TARGET_MACHINE_ID = process.argv[2] || 'MACHINE_001';
const MERCHANT_CODE = process.argv[3] || process.env.ORANGE_MERCHANT_CODE || '614841';
const MERCHANT_NAME = process.argv[4] || process.env.ORANGE_MERCHANT_NAME || 'Machine 1';
const CALLBACK_URL = process.argv[5] || process.env.ORANGE_CALLBACK_URL || null;

(async function(){
  try{
    await mongoose.connect(MONGO);
    console.log('Connected to MongoDB', MONGO);
    const Machine = require('../src/models/machine.model');
    const machine = await Machine.findOne({ machineId: TARGET_MACHINE_ID });
    if(!machine){
      console.log('Machine', TARGET_MACHINE_ID, 'not found. Aborting.');
      return;
    }
    machine.orangeMerchantCode = String(MERCHANT_CODE).trim();
    machine.orangeMerchantName = MERCHANT_NAME;
    if(CALLBACK_URL) machine.orangeCallbackUrl = CALLBACK_URL;
    await machine.save();
    console.log('Updated machine:', { machineId: machine.machineId, orangeMerchantCode: machine.orangeMerchantCode, orangeCallbackUrl: machine.orangeCallbackUrl });
  }catch(err){
    console.error('Error', err.message || err);
  }finally{
    await mongoose.disconnect();
  }
})();

