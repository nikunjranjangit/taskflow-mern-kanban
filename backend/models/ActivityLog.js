const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { 
    type: String, 
    enum: ['TASK_CREATED', 'TASK_MOVED', 'TASK_ASSIGNED', 'MEMBER_INVITED', 'MEMBER_REMOVED', 'COMMENT_ADDED'], 
    required: true 
  },
  details: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);