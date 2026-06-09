const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Falls back to a local fallback string if your .env variable layer is clearing out
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow_mern');
    console.log(`🚀 MongoDB Connected Cleanly: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;