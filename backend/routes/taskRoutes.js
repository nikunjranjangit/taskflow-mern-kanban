const express = require('express');
const { createTask, getProjectTasks, updateTask, deleteTask, getPersonalDashboard, addComment, getTaskComments, getProjectActivity } = require('../controllers/taskController');
const { protect, isProjectMember } = require('../middleware/auth');
const router = express.Router();

router.use(protect);
router.get('/dashboard/metrics', getPersonalDashboard);
router.post('/', isProjectMember, createTask);
router.get('/:projectId', isProjectMember, getProjectTasks);
router.get('/:projectId/activity', isProjectMember, getProjectActivity);

router.route('/:id').put(updateTask).delete(deleteTask);

// Comment nested structures
router.post('/:taskId/comments', addComment);
router.get('/:taskId/comments', getTaskComments);

module.exports = router;