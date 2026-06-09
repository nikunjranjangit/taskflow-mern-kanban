const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Task title cannot be empty'], 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  status: { 
    type: String, 
    enum: ['TODO', 'IN_PROGRESS', 'DONE'], 
    default: 'TODO' 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH'], 
    default: 'MEDIUM' 
  },
  dueDate: { 
    type: Date,
    validate: {
      validator: function(value) {
        // Only enforce future dates during initial creation
        if (this.isNew && value && value < new Date().setHours(0,0,0,0)) {
          return false;
        }
        return true;
      },
      message: 'Due date cannot be set in the past'
    }
  },
  completedAt: { 
    type: Date // Field tracks completion timestamps automatically
  },
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Optional project member assigned to the task
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Middleware hook: Automatically manage completion timestamp attributes
TaskSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'DONE') {
      this.completedAt = new Date();
    } else {
      this.completedAt = undefined; // Clears timestamp if pushed back
    }
  }
  next();
});

module.exports = mongoose.model('Task', TaskSchema);