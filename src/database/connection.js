const Database = require('better-sqlite3');
const config = require('../config');
const fs = require('fs');
const path = require('path');

let dbInstance = null;

/**
 * Gets the SQLite database instance, initializing it if it doesn't exist
 * @returns {Database} The SQLite database instance
 */
function getDb() {
  if (!dbInstance) {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize database connection
    dbInstance = new Database(config.DB_PATH, { verbose: console.log });

    // Enable WAL mode for better concurrency and foreign keys for data integrity
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    
    console.log(`Database connected successfully at ${config.DB_PATH}`);
  }
  return dbInstance;
}

module.exports = { getDb };
