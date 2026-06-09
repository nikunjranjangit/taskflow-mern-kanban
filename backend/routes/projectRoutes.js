const express = require('express');
const { createProject, getUserProjects, inviteMember, deleteProject } = require('../controllers/projectController');
const { protect, isProjectOwner } = require('../middleware/auth');
const router = express.Router();

// Seal all project tracking endpoints behind basic authentication 
router.use(protect);

router.route('/')
  .post(createProject)
  .get(getUserProjects);

// Administrative route patterns strictly requiring owner privileges 
router.post('/:projectId/invite', isProjectOwner, inviteMember);
router.delete('/:projectId', isProjectOwner, deleteProject);

module.exports = router;