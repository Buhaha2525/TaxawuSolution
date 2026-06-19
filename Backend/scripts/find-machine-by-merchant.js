#!/usr/bin/env node
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI;
(async function(){
  try{
    await mongoose.connect(MONGO);
    console.log('Connected to MongoDB', MONGO);
    const Machine = require('../src/models/machine.model');
    const m = await Machine.findOne({ orangeMerchantCode: '614841' }).lean();
    if(!m){
      console.log('No machine found with orangeMerchantCode 614841');
      const any = await Machine.find({}).limit(5).lean();
      console.log('Sample machines (up to 5):', any.map(x=>({machineId:x.machineId, orangeMerchantCode:x.orangeMerchantCode, name:x.name})));
    } else {
      console.log('Machine found:');
      console.log(JSON.stringify(m, null, 2));
    }
  }catch(err){
    console.error('Error', err.message || err);
  }finally{
    await mongoose.disconnect();
  }
})();

