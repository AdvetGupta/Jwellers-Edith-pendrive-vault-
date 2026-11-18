const { getDb } = require('./connection');

class TransactionManager {
  static execute(callback) {
    const db = getDb();

    const rollback = () => {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError.message);
      }
    };

    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION');
      const result = callback(db);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      rollback();
      throw error;
    }
  }

  static executeWithSavepoint(savepointName, callback) {
    const db = getDb();
    const sp = savepointName || `sp_${Date.now()}`;

    try {
      db.exec(`SAVEPOINT ${sp}`);
      const result = callback(db);
      db.exec(`RELEASE ${sp}`);
      return result;
    } catch (error) {
      try {
        db.exec(`ROLLBACK TO ${sp}`);
      } catch (rbError) {
        console.error(`Savepoint rollback failed for ${sp}:`, rbError.message);
      }
      throw error;
    }
  }
}

module.exports = TransactionManager;
