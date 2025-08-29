import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;

function validateTableName(name) {
  if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Invalid table name");
  }
  return name;
}

function quoteIdent(name) {
  return `"${name}"`;
}

// Simple password encoding (in production, use bcrypt)
function encodePassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Verify encoded password
function verifyPassword(password, encodedPassword) {
  return encodePassword(password) === encodedPassword;
}

class UserStore {
  /**
   * @param {{host:string, port:number, database:string, user:string, password:string, ssl?:boolean}} dbConfig
   * @param {string} tableName
   */
  constructor(dbConfig, tableName) {
    this.pool = new Pool({
      host: dbConfig.host || "localhost",
      port: Number(dbConfig.port || 5432),
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    });
    
    this.table = validateTableName(tableName);
    this.testConnection();
  }

  async testConnection() {
    try {
      await this.pool.query('SELECT NOW()');
    } catch (err) {
      console.error(`❌ UserStore database connection failed:`, err.message);
    }
  }

  async ensureTable() {
    try {
      const client = await this.pool.connect();
      
      // Enable UUID extension if not exists
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      // Create table if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${this.table} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          emp_code TEXT UNIQUE NOT NULL,
          emp_name TEXT,
          password TEXT NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          favorites JSON DEFAULT '[]',
          created TIMESTAMPTZ DEFAULT NOW(),
          updated TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      await client.query(createTableQuery);
      
      // Check if id column is UUID, if not alter it
      const checkIdColumnQuery = `
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'id';
      `;
      
      const idColumnCheck = await client.query(checkIdColumnQuery, [this.table]);
      
      if (idColumnCheck.rows.length > 0 && idColumnCheck.rows[0].data_type !== 'uuid') {
        // Backup existing data
        const backupQuery = `CREATE TABLE ${this.table}_backup AS SELECT * FROM ${this.table}`;
        await client.query(backupQuery);
        
        // Drop and recreate table with UUID
        await client.query(`DROP TABLE ${this.table}`);
        await client.query(createTableQuery);
        
        // Restore data with new UUIDs
        const restoreQuery = `
          INSERT INTO ${this.table} (emp_code, emp_name, password, verified, favorites, created, updated)
          SELECT emp_code, emp_name, password, verified, COALESCE(favorites, '[]'), created, updated FROM ${this.table}_backup
        `;
        await client.query(restoreQuery);
        
        // Drop backup table
        await client.query(`DROP TABLE ${this.table}_backup`);
        
        console.log(`✅ Converted ${this.table} to use UUID primary keys`);
      }
      
      // Check if emp_name column exists, if not add it
      const checkColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'emp_name';
      `;
      
      const columnCheck = await client.query(checkColumnQuery, [this.table]);
      
      if (columnCheck.rows.length === 0) {
        const addColumnQuery = `ALTER TABLE ${this.table} ADD COLUMN emp_name TEXT;`;
        await client.query(addColumnQuery);
        console.log(`✅ Added emp_name column to ${this.table}`);
      }
      
      // Check if favorites column exists, if not add it
      const checkFavoritesQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'favorites';
      `;
      
      const favoritesCheck = await client.query(checkFavoritesQuery, [this.table]);
      
      if (favoritesCheck.rows.length === 0) {
        const addFavoritesQuery = `ALTER TABLE ${this.table} ADD COLUMN favorites JSON DEFAULT '[]';`;
        await client.query(addFavoritesQuery);
        
        // Note: JSON columns work fine without indexes for basic operations
        console.log(`✅ Favorites column added - no index needed for basic JSON operations`);
        
        console.log(`✅ Added favorites column to ${this.table}`);
      }
      
      // Create indexes
      const createIndexesQuery = `
        CREATE INDEX IF NOT EXISTS idx_${this.table}_emp_code ON ${this.table}(emp_code);
        CREATE INDEX IF NOT EXISTS idx_${this.table}_verified ON ${this.table}(verified);
      `;
      
      await client.query(createIndexesQuery);
      
      client.release();
      return { success: true, message: 'Table ready' };
    } catch (error) {
      console.error('Error ensuring table:', error);
      return { success: false, error: error.message };
    }
  }

  async createUser(userData) {
    try {
      const { emp_code, emp_name, password } = userData;
      
      if (!emp_code || !password) {
        return { success: false, error: 'Employee code and password are required' };
      }
      
      const insertQuery = `
        INSERT INTO ${this.table} (emp_code, emp_name, password, verified, created, updated)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, emp_code, emp_name, verified, created, updated
      `;
      
      const result = await this.pool.query(insertQuery, [emp_code, emp_name || null, encodePassword(password), false]);
      
      if (result.rows.length > 0) {
        return { success: true, user: result.rows[0] };
      } else {
        return { success: false, error: 'Failed to create user' };
      }
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return { success: false, error: 'Account already exists. Please go to login page.' };
      }
      return { success: false, error: error.message };
    }
  }

  async getUserByEmpcode(emp_code) {
    try {
      const query = `
        SELECT id, emp_code, emp_name, verified, created, updated
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const result = await this.pool.query(query, [emp_code]);
      
      if (result.rows.length > 0) {
        return { success: true, user: result.rows[0] };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async verifyUser(emp_code) {
    const qtn = quoteIdent(this.table);
    const sql = `
      UPDATE ${qtn}
      SET verified = TRUE, updated = NOW()
      WHERE emp_code = $1
      RETURNING *
    `;
    
    try {
      const result = await this.pool.query(sql, [emp_code]);
      if (result.rowCount === 0) {
        return { success: false, error: 'User not found' };
      }
      return { success: true, user: result.rows[0] };
    } catch (err) {
      console.error('Error verifying user:', err.message);
      return { success: false, error: err.message };
    }
  }

  async updatePassword(emp_code, newPassword) {
    const qtn = quoteIdent(this.table);
    const sql = `
      UPDATE ${qtn}
      SET password = $2, updated = NOW()
      WHERE emp_code = $1
      RETURNING id, emp_code, verified, updated
    `;
    
    try {
      const result = await this.pool.query(sql, [emp_code, encodePassword(newPassword)]);
      if (result.rowCount === 0) {
        return { success: false, error: 'User not found' };
      }
      return { success: true, user: result.rows[0] };
    } catch (err) {
      console.error('Error updating password:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getAllUsers(limit = 100) {
    try {
      const query = `
        SELECT id, emp_code, emp_name, verified, created, updated
        FROM ${this.table}
        ORDER BY created DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      
      return { success: true, users: result.rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteUser(emp_code) {
    const qtn = quoteIdent(this.table);
    const sql = `DELETE FROM ${qtn} WHERE emp_code = $1 RETURNING *`;
    
    try {
      const result = await this.pool.query(sql, [emp_code]);
      if (result.rowCount === 0) {
        return { success: false, error: 'User not found' };
      }
      return { success: true, user: result.rows[0] };
    } catch (err) {
      console.error('Error deleting user:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Check if user exists (without password verification)
  async checkUserExists(emp_code) {
    try {
      const query = `
        SELECT id, emp_code, emp_name, verified, created, updated
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const result = await this.pool.query(query, [emp_code]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        return { success: true, user: user };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify password for existing user
  async verifyPassword(emp_code, password) {
    try {
      const query = `
        SELECT id, emp_code, emp_name, password, verified, created, updated
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const result = await this.pool.query(query, [emp_code]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        if (verifyPassword(password, user.password)) {
          // Don't return password in response
          const { password: _, ...userWithoutPassword } = user;
          return { success: true, user: userWithoutPassword };
        } else {
          return { success: false, error: 'Invalid password' };
        }
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Keep the old method for backward compatibility
  async verifyUserCredentials(emp_code, password) {
    try {
      const query = `
        SELECT id, emp_code, emp_name, password, verified, created, updated
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const result = await this.pool.query(query, [emp_code]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        if (verifyPassword(password, user.password)) {
          // Don't return password in response
          const { password: _, ...userWithoutPassword } = user;
          return { success: true, user: userWithoutPassword };
        } else {
          return { success: false, error: 'Invalid password' };
        }
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async close() {
    await this.pool.end();
  }

  // Favorites Management Methods
  async ensureFavoritesColumn() {
    try {
      const client = await this.pool.connect();
      
      // Check if favorites column exists
      const checkColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'favorites';
      `;
      
      const columnExists = await client.query(checkColumnQuery, [this.table]);
      
      if (columnExists.rows.length === 0) {
        // Add favorites column
        const addColumnQuery = `
          ALTER TABLE ${this.table} 
          ADD COLUMN favorites JSON DEFAULT '[]';
        `;
        
        await client.query(addColumnQuery);
        
        // Create index for better performance
        const createIndexQuery = `
          CREATE INDEX idx_${this.table}_favorites 
          ON ${this.table} USING GIN (favorites);
        `;
        
        await client.query(createIndexQuery);
        console.log(`✅ Added favorites column to ${this.table}`);
      }
      
      client.release();
    } catch (err) {
      console.error('Error ensuring favorites column:', err.message);
    }
  }

  async getUserFavorites(emp_code) {
    try {
      await this.ensureFavoritesColumn();
      
      const query = `
        SELECT favorites 
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const result = await this.pool.query(query, [emp_code]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      const favorites = result.rows[0].favorites || [];
      return { success: true, favorites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addJobToFavorites(emp_code, jobData) {
    try {
      await this.ensureFavoritesColumn();
      
      const client = await this.pool.connect();
      
      // Get current favorites
      const getFavoritesQuery = `
        SELECT favorites 
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const currentResult = await client.query(getFavoritesQuery, [emp_code]);
      
      if (currentResult.rows.length === 0) {
        client.release();
        return { success: false, error: 'User not found' };
      }
      
      let currentFavorites = currentResult.rows[0].favorites || [];
      
      // Check if job already exists in favorites (by job_no)
      const existingIndex = currentFavorites.findIndex(fav => fav.job_no === jobData.job_no);
      
      if (existingIndex !== -1) {
        // Update existing favorite with new account info
        currentFavorites[existingIndex] = {
          ...currentFavorites[existingIndex],
          acc_no: jobData.acc_no,
          acc_name: jobData.acc_name,
          updated_at: new Date().toISOString()
        };
        console.log('✅ Updated existing favorite for job:', jobData.job_no);
      } else {
        // Add new favorite with timestamp
        const newFavorite = {
          ...jobData,
          added_at: new Date().toISOString()
        };
        currentFavorites.push(newFavorite);
        console.log('✅ Added new favorite for job:', jobData.job_no);
      }
      
      // Update favorites in database
      const updateQuery = `
        UPDATE ${this.table}
        SET favorites = $2, updated = NOW()
        WHERE emp_code = $1
        RETURNING favorites
      `;
      
      const updateResult = await client.query(updateQuery, [emp_code, JSON.stringify(currentFavorites)]);
      
      client.release();
      
      return { success: true, favorites: updateResult.rows[0].favorites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async removeJobFromFavorites(emp_code, job_no) {
    try {
      await this.ensureFavoritesColumn();
      
      const client = await this.pool.connect();
      
      // Get current favorites
      const getFavoritesQuery = `
        SELECT favorites 
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const currentResult = await client.query(getFavoritesQuery, [emp_code]);
      
      if (currentResult.rows.length === 0) {
        client.release();
        return { success: false, error: 'User not found' };
      }
      
      let currentFavorites = currentResult.rows[0].favorites || [];
      
      // Remove job from favorites (by job_no)
      const updatedFavorites = currentFavorites.filter(fav => fav.job_no !== job_no);
      
      // Update favorites in database
      const updateQuery = `
        UPDATE ${this.table}
        SET favorites = $2, updated = NOW()
        WHERE emp_code = $1
        RETURNING favorites
      `;
      
      const updateResult = await client.query(updateQuery, [emp_code, JSON.stringify(updatedFavorites)]);
      
      client.release();
      
      return { success: true, favorites: updateResult.rows[0].favorites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if a specific job is favorited by a user
  async isJobFavorited(emp_code, job_no) {
    try {
      await this.ensureFavoritesColumn();
      
      const query = `
        SELECT favorites 
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const result = await this.pool.query(query, [emp_code]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      const favorites = result.rows[0].favorites || [];
      const isFavorited = favorites.some(fav => fav.job_no === job_no);
      
      return { success: true, isFavorited, favorites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async toggleJobFavorite(emp_code, jobData) {
    try {
      await this.ensureFavoritesColumn();
      
      const client = await this.pool.connect();
      
      // Get current favorites
      const getFavoritesQuery = `
        SELECT favorites 
        FROM ${this.table}
        WHERE emp_code = $1
      `;
      
      const currentResult = await client.query(getFavoritesQuery, [emp_code]);
      
      if (currentResult.rows.length === 0) {
        client.release();
        return { success: false, error: 'User not found' };
      }
      
      let currentFavorites = currentResult.rows[0].favorites || [];
      
      // Check if job already exists in favorites
      const existingIndex = currentFavorites.findIndex(fav => fav.job_no === jobData.job_no);
      
      if (existingIndex !== -1) {
        // Remove from favorites
        currentFavorites.splice(existingIndex, 1);
      } else {
        // Add to favorites
        const newFavorite = {
          ...jobData,
          added_at: new Date().toISOString()
        };
        currentFavorites.push(newFavorite);
      }
      
      // Update favorites in database
      const updateQuery = `
        UPDATE ${this.table}
        SET favorites = $2, updated = NOW()
        WHERE emp_code = $1
        RETURNING favorites
      `;
      
      const updateResult = await client.query(updateQuery, [emp_code, JSON.stringify(currentFavorites)]);
      
      client.release();
      
      return { 
        success: true, 
        favorites: updateResult.rows[0].favorites,
        action: existingIndex !== -1 ? 'removed' : 'added'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export { UserStore };
