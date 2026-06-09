const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');

// Guardrail 1: Validates that the request has a valid, non-expired access token 
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Inject the authenticated user profile into the request lifecycle object
      req.user = await User.findById(decoded.id).select('-password');
      return next();
    } catch (error) {
      // Catch expired or tampered signatures cleanly [cite: 15, 28]
      return res.status(401).json({ message: 'Access token expired or invalid' });
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, access token missing' });
  }
};

// Guardrail 2: Validates that the authenticated user is a verified member of the target project 
const isProjectMember = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.project;
    if (!projectId) {
      return res.status(400).json({ message: 'Project identifier mapping missing' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project board workspace not found' });
    }

    // Verify if user's ID exists inside the project's native members array 
    const isMember = project.members.includes(req.user.id);
    const isOwner = project.owner.toString() === req.user.id;

    if (!isMember && !isOwner) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
    }

    // Append project metadata to request for optimization downstream
    req.project = project;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Project membership validation fault', error: error.message });
  }
};

// Guardrail 3: Verifies that the user holds administrative Owner privileges 
const isProjectOwner = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project workspace not found' });
    }

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Action unauthorized. Only the project owner can perform this operation.' });
    }

    req.project = project;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Role authorization evaluation error' });
  }
};

module.exports = { protect, isProjectMember, isProjectOwner };