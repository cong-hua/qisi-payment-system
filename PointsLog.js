const mongoose = require('mongoose');

const pointsLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['recharge', 'deduct'], 
    required: true 
  },
  delta: { 
    type: Number, 
    required: true 
  },
  orderId: String,
  description: String
}, {
  timestamps: true
});

// 创建索引
pointsLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PointsLog', pointsLogSchema);

