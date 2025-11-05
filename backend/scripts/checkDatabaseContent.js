const db = require('../config/db');

async function checkDatabaseContent() {
    try {
        const tables = ['visitors', 'pdls', 'denied_visitors', 'scanned_visitors', 'users', 'cells'];
        
        for (const table of tables) {
            const [rows] = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`${table}: ${rows[0].count} records`);
        }
    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        db._raw.close();
    }
}

checkDatabaseContent();