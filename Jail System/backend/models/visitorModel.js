const db = require('../config/db');

const Visitor = {
  getAllByPdlId: async (pdlId) => {
    const [results] = await db.query('SELECT * FROM visitors WHERE pdl_id = ?', [pdlId]);
    return results;
  },

  getAllWithPdlNames: async () => {
    const [results] = await db.query(
      `SELECT visitors.*, pdls.last_name AS pdl_last_name, pdls.first_name AS pdl_first_name, pdls.middle_name AS pdl_middle_name
       FROM visitors
       LEFT JOIN pdls ON visitors.pdl_id = pdls.id`
    );
    return results;
  },

  getById: async (id) => {
    const [results] = await db.query('SELECT * FROM visitors WHERE id = ?', [id]);
    return results[0];
  },

  getByVisitorId: async (visitorId) => {
    const [results] = await db.query('SELECT * FROM visitors WHERE visitor_id = ?', [visitorId]);
    return results[0];
  },

  countByPdlId: async (pdlId) => {
    const [results] = await db.query('SELECT COUNT(*) AS count FROM visitors WHERE pdl_id = ?', [pdlId]);
    return results[0].count;
  },

  add: async (data) => {

const {
  pdl_id,
  name,
  relationship,
  age,
  address,
  valid_id,
  date_of_application,
  contact_number
} = data;

const [countResult] = await db.query('SELECT COUNT(*) AS count FROM visitors');
const count = countResult[0].count + 1;
const visitorId = count.toString().padStart(3, '0');

const [result] = await db.query(
  `INSERT INTO visitors (
    pdl_id, visitor_id, name, relationship, age, address, valid_id, date_of_application, contact_number
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,

  [pdl_id, visitorId, name, relationship, age, address, valid_id, date_of_application, contact_number]
);
return result;
  },

  update: async (id, data) => {

const {
  name,
  relationship,
  age,
  address,
  valid_id,
  date_of_application,
  contact_number
} = data;

const [result] = await db.query(
  `UPDATE visitors SET
    name = ?, relationship = ?, age = ?, address = ?, valid_id = ?, date_of_application = ?, contact_number = ?
  WHERE id = ?`,
  [name, relationship, age, address, valid_id, date_of_application, contact_number, id]
);
return result;
  },

  delete: async (id) => {
    const [result] = await db.query('DELETE FROM visitors WHERE id = ?', [id]);
    return result;
  },

  updateTimeInOut: async (visitorId, timeIn, timeOut) => {
    const [result] = await db.query(
      `UPDATE visitors SET time_in = ?, time_out = ? WHERE visitor_id = ?`,
      [timeIn, timeOut, visitorId]
    );
    return result;
  }
};

module.exports = Visitor;
