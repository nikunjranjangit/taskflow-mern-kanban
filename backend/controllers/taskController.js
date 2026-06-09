const Task = require('../models/Task');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');
const { getIO } = require('../config/socket');

// Helper to write activity logs easily
const logActivity = async (projectId, userId, action, details) => {
  try {
    await ActivityLog.create({ project: projectId, user: userId, action, details });
    getIO().to(`project_${projectId}`).emit('activity_updated');
  } catch (err) {
    console.error("Activity logging failed", err);
  }
};

exports.createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, assignee, project } = req.body;
    if (!title) return res.status(400).json({ message: 'Task title cannot be empty' });

    if (dueDate && new Date(dueDate) < new Date().setHours(0,0,0,0)) {
      return res.status(400).json({ message: 'Due date cannot be set in the past' });
    }

    const targetProject = await Project.findById(project);
    if (assignee && !targetProject.members.includes(assignee)) {
      return res.status(400).json({ message: 'Assignee must be a project member' });
    }

    const task = await Task.create({
      title, description, priority: priority || 'MEDIUM', dueDate, project, assignee, creator: req.user.id
    });

    await logActivity(project, req.user.id, 'TASK_CREATED', `created task "${title}"`);
    getIO().to(`project_${project}`).emit('board_mutated');
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 6, sort = 'createdAt', priority, assignee, search } = req.query;

    let queryFilter = { project: projectId };
    if (priority) queryFilter.priority = priority;
    if (assignee) queryFilter.assignee = assignee;
    if (search) queryFilter.title = { $regex: search, $options: 'i' };

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);
    let sortOptions = {};
    if (sort === 'dueDate') sortOptions.dueDate = 1;
    else if (sort === 'priority') sortOptions.priority = -1;
    else sortOptions.createdAt = -1;

    const tasks = await Task.find(queryFilter)
      .populate('assignee', 'name email')
      .sort(sortOptions).skip(skipIndex).limit(parseInt(limit));

    const totalCount = await Task.countDocuments(queryFilter);
    res.json({
      tasks,
      pagination: { totalTasks: totalCount, currentPage: parseInt(page), totalPages: Math.ceil(totalCount / limit) }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server pagination error' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // ASSESSMENT RULE 20: Only Owner or Assignee can mark task Done
    if (req.body.status === 'DONE' && task.status !== 'DONE') {
      const isOwner = task.project.owner.toString() === req.user.id;
      const isAssignee = task.assignee && task.assignee.toString() === req.user.id;
      if (!isOwner && !isAssignee) {
        return res.status(403).json({ message: 'Access Denied: Only the task Assignee or Project Owner can complete this task.' });
      }
    }

    const oldStatus = task.status;
    Object.assign(task, req.body);
    await task.save();

    if (req.body.status && oldStatus !== req.body.status) {
      await logActivity(task.project._id, req.user.id, 'TASK_MOVED', `moved "${task.title}" to ${req.body.status}`);
    }

    getIO().to(`project_${task.project._id}`).emit('board_mutated');
    res.json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await logActivity(task.project, req.user.id, 'TASK_MOVED', `deleted task "${task.title}"`);
    await Task.findByIdAndDelete(req.params.id);
    
    getIO().to(`project_${task.project}`).emit('board_mutated');
    res.json({ message: 'Task deleted cleanly' });
  } catch (error) {
    res.status(500).json({ message: 'Task deletion fault' });
  }
};

// ASSESSMENT REQUIREMENT 19: Task Comments Architecture
exports.addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Comment text cannot be empty' });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const comment = await Comment.create({ task: taskId, author: req.user.id, text });
    const populated = await comment.populate('author', 'name email');

    await logActivity(task.project, req.user.id, 'COMMENT_ADDED', `commented on task "${task.title}"`);
    getIO().to(`project_${task.project}`).emit('comment_pushed', { taskId, comment: populated });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTaskComments = async (req, res) => {
  try {
    const comments = await Comment.find({ task: req.params.taskId }).populate('author', 'name email').sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProjectActivity = async (req, res) => {
  try {
    const logs = await ActivityLog.find({ project: req.params.projectId }).populate('user', 'name').sort({ createdAt: -1 }).limit(30);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ASSESSMENT REQUIREMENT 27: Personal Analytical Dashboard Compiler
exports.getPersonalDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Projects counter
    const projectCount = await Project.countDocuments({ members: userId });

    // 2. Assigned tasks broken down by status state
    const myTasks = await Task.find({ assignee: userId });
    const statusMetrics = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    myTasks.forEach(t => { if (statusMetrics[t.status] !== undefined) statusMetrics[t.status]++; });

    // 3. Completed this calendar week (Sunday-Saturday window)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0,0,0,0);
    const completedThisWeek = await Task.countDocuments({ assignee: userId, status: 'DONE', completedAt: { $gte: startOfWeek } });

    // 4. Project with the highest layout density of open tasks
    const activeProjects = await Project.find({ members: userId });
    let maxOpenCount = -1;
    let highRiskProjectName = "None";

    for (let p of activeProjects) {
      const count = await Task.countDocuments({ project: p._id, status: { $ne: 'DONE' } });
      if (count > maxOpenCount) {
        maxOpenCount = count;
        highRiskProjectName = p.title;
      }
    }

    // 5. Cross-workspace real-time activity metrics ticker
    const chronologicalActivity = await ActivityLog.find({ project: { $in: activeProjects.map(p => p._id) } })
      .populate('user', 'name')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      projectCount,
      statusMetrics,
      completedThisWeek,
      highestOpenTasksProject: `${highRiskProjectName} (${maxOpenCount === -1 ? 0 : maxOpenCount} Open)`,
      chronologicalActivity
    });
  } catch (err) {
    res.status(500).json({ message: 'Dashboard pipeline compilation breakdown', error: err.message });
  }
};