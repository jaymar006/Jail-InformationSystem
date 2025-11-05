const db = require('../config/db');

async function clearDatabase() {
    try {
        // Delete data from all tables
        await db.query('DELETE FROM visitors');
        await db.query('DELETE FROM pdls');
        await db.query('DELETE FROM denied_visitors');
        await db.query('DELETE FROM scanned_visitors');
        await db.query('DELETE FROM users');
        await db.query('DELETE FROM cells');
        
        console.log('✅ All data has been cleared from the database successfully');
    } catch (error) {
        console.error('Error clearing database:', error);
    } finally {
        // Close the database connection
        db._raw.close();
    }
}

clearDatabase();