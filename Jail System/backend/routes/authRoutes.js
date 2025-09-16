const express = require('express');
const router = express.Router();
const { login, signUp, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/signup', signUp);
router.get('/me', authMiddleware, getProfile);

module.exports = router;
