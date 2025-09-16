const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await userModel.findUserByUsername(username);

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ message: 'Login successful', token });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.signUp = async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await userModel.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await userModel.createUser(username, hashedPassword);
    res.json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getUsernameFromDb = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ usernameFromDb: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
