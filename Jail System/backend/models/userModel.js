const db = require('../config/db');

const findUserByUsername = async (username) => {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0];
};

const createUser = async (username, password) => {
  const [result] = await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
  return result.insertId;
};

const findUserById = async (id) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
};

module.exports = {
  findUserByUsername,
  createUser,
  findUserById,
};
