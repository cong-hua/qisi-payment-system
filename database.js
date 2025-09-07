const mongoose = require('mongoose');

let isConnected = false;

async function connectDB(logger = console) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn?.('MONGODB_URI is not set; database connection is skipped');
    return null;
  }

  if (isConnected) return mongoose.connection;

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    });

    isConnected = true;

    const conn = mongoose.connection;
    conn.on('error', (err) => logger.error?.('MongoDB error:', err));
    conn.on('disconnected', () => {
      isConnected = false;
      logger.warn?.('MongoDB disconnected');
    });
    logger.info?.('✅ MongoDB connected');
    return conn;
  } catch (err) {
    logger.error?.('❌ MongoDB connection failed:', err.message);
    throw err;
  }
}

function dbStatus() {
  const ready = mongoose.connection?.readyState;
  return {
    connected: ready === 1,
    readyState: ready
  };
}

module.exports = { connectDB, dbStatus, mongoose };

