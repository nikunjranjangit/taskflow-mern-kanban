const express = require('express');
const { registerUser, loginUser, refreshSessionToken, logoutUser } = require('../controllers/authController');
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshSessionToken);
router.post('/logout', logoutUser);

module.exports = router;