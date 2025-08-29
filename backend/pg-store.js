import pg from "pg";
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

class PgStore {
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
      console.error(`❌ Database connection failed:`, err.message);
    }
  }

  async ensureTable() {
    try {
      const client = await this.pool.connect();
      
      // Enable UUID extension if not exists
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      // Check if table exists and get its current structure
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    
      const tableExistsResult = await client.query(tableExistsQuery, [this.table]);
      const tableExists = tableExistsResult.rows[0].exists;
      
      if (!tableExists) {
        // Create new table with UUID and basic structure
        const createTableQuery = `
          CREATE TABLE ${this.table} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_no TEXT NOT NULL,
            job_name TEXT NOT NULL,
            employee_code TEXT NOT NULL,
            employee_name TEXT,
            account_no TEXT,
            account_name TEXT,
            start_time TIMESTAMPTZ DEFAULT NOW(),
            end_time TIMESTAMPTZ,
            total_seconds INTEGER,
            comment TEXT,
            status TEXT DEFAULT 'active',
            spire_status TEXT DEFAULT 'new',
            start_location JSON DEFAULT '[]',
            end_location JSON DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        
        await client.query(createTableQuery);
        console.log(`✅ Created new table ${this.table} with UUID primary key`);
      } else {
        // Table exists, check if it needs UUID conversion
        const checkIdColumnQuery = `
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'id';
        `;
        
        const idColumnCheck = await client.query(checkIdColumnQuery, [this.table]);
        
        if (idColumnCheck.rows.length > 0 && idColumnCheck.rows[0].data_type !== 'uuid') {
          // Get all existing columns
          const getColumnsQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `;
          
          const columnsResult = await client.query(getColumnsQuery, [this.table]);
          const existingColumns = columnsResult.rows;
          
          // Create backup table with exact same structure
          const backupColumns = existingColumns.map(col => col.column_name).join(', ');
          const backupQuery = `CREATE TABLE ${this.table}_backup AS SELECT ${backupColumns} FROM ${this.table}`;
          await client.query(backupQuery);
          
          // Drop existing table
          await client.query(`DROP TABLE ${this.table}`);
          
          // Create new table with UUID and all existing columns
          const columnDefinitions = existingColumns.map(col => {
            if (col.column_name === 'id') {
              return 'id UUID PRIMARY KEY DEFAULT gen_random_uuid()';
            }
            return `${col.column_name} ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`;
          }).join(', ');
          
          const createNewTableQuery = `
            CREATE TABLE ${this.table} (
              ${columnDefinitions}
            );
          `;
          
          await client.query(createNewTableQuery);
          
          // Restore data (excluding id column since it will be auto-generated)
          const restoreColumns = existingColumns.filter(col => col.column_name !== 'id').map(col => col.column_name).join(', ');
          const restoreQuery = `
            INSERT INTO ${this.table} (${restoreColumns})
            SELECT ${restoreColumns} FROM ${this.table}_backup
          `;
          
          await client.query(restoreQuery);
          
          // Drop backup table
          await client.query(`DROP TABLE ${this.table}_backup`);
          
          console.log(`✅ Converted ${this.table} to use UUID primary keys`);
        }
        
        // Check if spire_status column exists, if not add it
        const checkSpireStatusQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'spire_status';
        `;
        
        const spireStatusCheck = await client.query(checkSpireStatusQuery, [this.table]);
        if (spireStatusCheck.rows.length === 0) {
          const addSpireStatusQuery = `ALTER TABLE ${this.table} ADD COLUMN spire_status TEXT DEFAULT 'new';`;
          await client.query(addSpireStatusQuery);
          console.log(`✅ Added spire_status column to ${this.table}`);
        }
        
        // Check if employee_code column exists, if not add it
        const checkEmployeeCodeQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'employee_code';
        `;
        
        const employeeCodeCheck = await client.query(checkEmployeeCodeQuery, [this.table]);
        if (employeeCodeCheck.rows.length === 0) {
          const addEmployeeCodeQuery = `ALTER TABLE ${this.table} ADD COLUMN employee_code TEXT;`;
          await client.query(addEmployeeCodeQuery);
          console.log(`✅ Added employee_code column to ${this.table}`);
        }
        
        // Check if employee_name column exists, if not add it
        const checkEmployeeNameQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'employee_name';
        `;
        
        const employeeNameCheck = await client.query(checkEmployeeNameQuery, [this.table]);
        if (employeeNameCheck.rows.length === 0) {
          const addEmployeeNameQuery = `ALTER TABLE ${this.table} ADD COLUMN employee_name TEXT;`;
          await client.query(addEmployeeNameQuery);
          console.log(`✅ Added employee_name column to ${this.table}`);
        }
        
        // Check if start_location column exists, if not add it
        const checkStartLocationQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'start_location';
        `;
        
        const startLocationCheck = await client.query(checkStartLocationQuery, [this.table]);
        if (startLocationCheck.rows.length === 0) {
          const addStartLocationQuery = `ALTER TABLE ${this.table} ADD COLUMN start_location JSON DEFAULT '[]';`;
          await client.query(addStartLocationQuery);
          
          // Note: JSON columns work fine without indexes for basic operations
          console.log(`✅ Start location column added - no index needed for basic JSON operations`);
          
          console.log(`✅ Added start_location column to ${this.table}`);
        }
        
        // Check if end_location column exists, if not add it
        const checkEndLocationQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'end_location';
        `;
        
        const endLocationCheck = await client.query(checkEndLocationQuery, [this.table]);
        if (endLocationCheck.rows.length === 0) {
          const addEndLocationQuery = `ALTER TABLE ${this.table} ADD COLUMN end_location JSON DEFAULT '[]';`;
          await client.query(addEndLocationQuery);
          
          // Note: JSON columns work fine without indexes for basic operations
          console.log(`✅ End location column added - no index needed for basic JSON operations`);
          
          console.log(`✅ Added end_location column to ${this.table}`);
        }
        
        // Check if total_seconds column exists, if not add it
        const checkTotalSecondsQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'total_seconds';
        `;
        
        const totalSecondsCheck = await client.query(checkTotalSecondsQuery, [this.table]);
        if (totalSecondsCheck.rows.length === 0) {
          const addTotalSecondsQuery = `ALTER TABLE ${this.table} ADD COLUMN total_seconds INTEGER;`;
          await client.query(addTotalSecondsQuery);
          console.log(`✅ Added total_seconds column to ${this.table}`);
        }
        
        // Check if comment column exists, if not add it
        const checkCommentQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'comment';
        `;
        
        const commentCheck = await client.query(checkCommentQuery, [this.table]);
        if (commentCheck.rows.length === 0) {
          const addCommentQuery = `ALTER TABLE ${this.table} ADD COLUMN comment TEXT;`;
          await client.query(addCommentQuery);
          console.log(`✅ Added comment column to ${this.table}`);
        }
        
        // Check if account_no column exists, if not add it
        const checkAccountNoQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'account_no';
        `;
        
        const accountNoCheck = await client.query(checkAccountNoQuery, [this.table]);
        if (accountNoCheck.rows.length === 0) {
          const addAccountNoQuery = `ALTER TABLE ${this.table} ADD COLUMN account_no TEXT;`;
          await client.query(addAccountNoQuery);
          console.log(`✅ Added account_no column to ${this.table}`);
        }
        
        // Check if account_name column exists, if not add it
        const checkAccountNameQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'account_name';
        `;
        
        const accountNameCheck = await client.query(checkAccountNameQuery, [this.table]);
        if (accountNameCheck.rows.length === 0) {
          const addAccountNameQuery = `ALTER TABLE ${this.table} ADD COLUMN account_name TEXT;`;
          await client.query(addAccountNameQuery);
          console.log(`✅ Added account_name column to ${this.table}`);
        }
      }
      
      // Create indexes only for columns that exist
      const createIndexesQuery = `
        CREATE INDEX IF NOT EXISTS idx_${this.table}_job_no ON ${this.table}(job_no);
        CREATE INDEX IF NOT EXISTS idx_${this.table}_status ON ${this.table}(status);
        CREATE INDEX IF NOT EXISTS idx_${this.table}_start_time ON ${this.table}(start_time);
        CREATE INDEX IF NOT EXISTS idx_${this.table}_spire_status ON ${this.table}(spire_status);
      `;
      
      await client.query(createIndexesQuery);
      
      // Check if employee_code column exists and create index if it does
      const checkEmployeeCodeQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'employee_code';
      `;
      
      const employeeCodeCheck = await client.query(checkEmployeeCodeQuery, [this.table]);
      if (employeeCodeCheck.rows.length > 0) {
        await client.query(`CREATE INDEX IF NOT EXISTS idx_${this.table}_employee_code ON ${this.table}(employee_code)`);
      }
      
      client.release();
      return { success: true, message: 'Table ready' };
    } catch (error) {
      console.error('Error ensuring table:', error);
      return { success: false, error: error.message };
    }
  }

  async createEntry(entry) {
    const qtn = quoteIdent(this.table);
    
    // Get existing columns to know what we can insert into
    const getColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;
    
    try {
      const columnsResult = await this.pool.query(getColumnsQuery, [this.table]);
      const existingColumns = columnsResult.rows.map(col => col.column_name);
      
      // Prevent duplicate active timers for same (job_no, employee_code) if employee_code exists
      // But allow manual time entries (completed entries) even if there's an active timer
      if (existingColumns.includes('employee_code')) {
        // Only check for duplicates if this is an active timer (status = 'active' or no status specified)
        const isActiveTimer = !entry.status || entry.status === 'active';
        
        if (isActiveTimer) {
          const dupCheck = await this.pool.query(
            `SELECT 1 FROM ${qtn} WHERE job_no=$1 AND employee_code=$2 AND end_time IS NULL LIMIT 1`,
            [entry.job_no?.trim() || '', entry.employee_code?.trim() || '']
          );
          if (dupCheck.rowCount > 0) {
            return { success: false, error: "An active timer already exists for this job and employee combination" };
          }
        }
      }
      
      // Build dynamic INSERT query based on existing columns
      const insertColumns = [];
      const insertValues = [];
      let paramCount = 1;
      
      // Map entry fields to existing columns
      const fieldMappings = {
        'job_no': entry.job_no,
        'job_name': entry.job_name,
        'employee_code': entry.employee_code,
        'employee_name': entry.employee_name,
        'account_no': entry.account_no,
        'account_name': entry.account_name,
        'start_time': entry.start_time || new Date(),
        'end_time': entry.end_time,
        'total_seconds': entry.total_seconds,
        'comment': entry.comment,
        'status': entry.status || 'active',
        'spire_status': entry.spire_status,
        'start_location': entry.start_location, // Add start location support
        'end_location': entry.end_location,     // Add end location support
        'created_at': entry.created_at || new Date(),
        'updated_at': entry.updated_at || new Date()
      };
      
            // Only include columns that exist in the table
      for (const [column, value] of Object.entries(fieldMappings)) {
        if (existingColumns.includes(column) && value !== undefined) {
          insertColumns.push(column);
          insertValues.push(value);
          paramCount++;
        }
      }
      
      if (insertColumns.length === 0) {
        return { success: false, error: 'No valid columns to insert into' };
      }

    const sql = `
        INSERT INTO ${qtn} (${insertColumns.join(', ')})
        VALUES (${insertColumns.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING id
    `;
    
      const result = await this.pool.query(sql, insertValues);
      return { success: true, id: result.rows[0].id };
    } catch (err) {
      console.error('❌ Error creating entry:', err.message);
      return { success: false, error: err.message };
    }
  }

  async stopEntry(entryId, employeeCode = null) {
    const qtn = quoteIdent(this.table);
    
    // Get existing columns to know what we can update
    const getColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;
    
    try {
      const columnsResult = await this.pool.query(getColumnsQuery, [this.table]);
      const existingColumns = columnsResult.rows.map(col => col.column_name);
      
      // Build dynamic UPDATE query based on existing columns
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      // Always update these fields if they exist
      if (existingColumns.includes('end_time')) {
        updateFields.push('end_time = NOW()');
      }
      
      if (existingColumns.includes('total_seconds')) {
        updateFields.push('total_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER)');
      }
      
      if (existingColumns.includes('status')) {
        updateFields.push('status = $' + (++paramCount));
        values.push('Completed');
      }
      
      if (existingColumns.includes('updated_at')) {
        updateFields.push('updated_at = NOW()');
      }
      
      if (updateFields.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }
      
      values.unshift(entryId); // Add entryId as first parameter
      
      let sql = `
        UPDATE ${qtn}
          SET ${updateFields.join(', ')}
        WHERE id = $1 AND end_time IS NULL
      `;
      
      // Also verify ownership if employee_code provided
      if (employeeCode) {
        sql += ` AND employee_code = $${paramCount + 1}`;
        values.push(employeeCode);
      }
      
      sql += ` RETURNING *`;
      
      const result = await this.pool.query(sql, values);
      if (result.rowCount === 0) {
        return { success: false, error: 'Entry not found or already stopped' };
      }
      return { success: true, entry: result.rows[0] };
    } catch (err) {
      console.error('Error stopping entry:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getActiveEntries(employeeCode = null) {
    const qtn = quoteIdent(this.table);
    
    let sql = `
      SELECT * FROM ${qtn}
      WHERE end_time IS NULL
    `;
    
    const params = [];
    
    // Filter by employee_code if provided
    if (employeeCode) {
      sql += ` AND employee_code = $1`;
      params.push(employeeCode);
    }
    
    sql += ` ORDER BY start_time DESC`;
    
    try {
      const result = await this.pool.query(sql, params);

      return { success: true, entries: result.rows };
    } catch (err) {
      console.error('Error getting active entries:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getAllEntries(limit = 100, employeeCode = null) {
    const qtn = quoteIdent(this.table);
    
    let sql = `SELECT * FROM ${qtn}`;
    const params = [];
    
    // Filter by employee_code if provided
    if (employeeCode) {
      sql += ` WHERE employee_code = $1`;
      params.push(employeeCode);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    try {
      const result = await this.pool.query(sql, params);
      return { success: true, entries: result.rows };
    } catch (err) {
      console.error('Error getting all entries:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getEntryById(entryId, employeeCode = null) {
    const qtn = quoteIdent(this.table);
    
    let sql = `SELECT * FROM ${qtn} WHERE id = $1`;
    const params = [entryId];
    
    // Also verify ownership if employee_code provided
    if (employeeCode) {
      sql += ` AND employee_code = $2`;
      params.push(employeeCode);
    }
    
    try {
      const result = await this.pool.query(sql, params);
      if (result.rowCount === 0) {
        return { success: false, error: 'Entry not found' };
      }
      return { success: true, entry: result.rows[0] };
    } catch (err) {
      console.error('Error getting entry by ID:', err.message);
      return { success: false, error: err.message };
    }
  }

  async updateEntry(entryId, updates, employeeCode = null) {
    const qtn = quoteIdent(this.table);
    
    // Get existing columns to know what we can update
    const getColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;
    
    try {
      const columnsResult = await this.pool.query(getColumnsQuery, [this.table]);
      const existingColumns = columnsResult.rows.map(col => col.column_name);
      

      
      const allowedFields = ['job_no', 'job_name', 'employee_code', 'employee_name', 'account_no', 'account_name', 'comment', 'spire_status', 'status', 'total_seconds', 'start_time', 'start_location', 'end_location'];
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && existingColumns.includes(key) && value !== undefined) {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }



      if (updateFields.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }

      // Only add updated_at if the column exists
      if (existingColumns.includes('updated_at')) {
        updateFields.push('updated_at = NOW()');
      }
      
      values.push(entryId);

      let sql = `
        UPDATE ${qtn}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `;
      
      // Also verify ownership if employee_code provided
      if (employeeCode) {
        sql += ` AND employee_code = $${paramCount + 1}`;
        values.push(employeeCode);
      }
      
      sql += ` RETURNING *`;
      

      
      const result = await this.pool.query(sql, values);
      if (result.rowCount === 0) {
        return { success: false, error: 'Entry not found' };
      }
      return { success: true, entry: result.rows[0] };
    } catch (err) {
      console.error('Error updating entry:', err.message);
      return { success: false, error: err.message };
    }
  }

  async deleteEntry(entryId, employeeCode = null) {
    const qtn = quoteIdent(this.table);
    
    let sql = `DELETE FROM ${qtn} WHERE id = $1`;
    const params = [entryId];
    
    // Also verify ownership if employee_code provided
    if (employeeCode) {
      sql += ` AND employee_code = $2`;
      params.push(employeeCode);
    }
    
    sql += ` RETURNING *`;
    
    try {
      const result = await this.pool.query(sql, params);
      if (result.rowCount === 0) {
        return { success: false, error: 'Entry not found' };
      }
      return { success: true, entry: result.rows[0] };
    } catch (err) {
      console.error('Error deleting entry:', err.message);
      return { success: false, error: err.message };
    }
  }

  async fixInvalidDurations() {
    const qtn = quoteIdent(this.table);
    
    // Check if total_seconds column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'total_seconds';
    `;
    
    try {
      const columnCheck = await this.pool.query(checkColumnQuery, [this.table]);
      if (columnCheck.rows.length === 0) {
        return { success: true, fixedCount: 0, message: 'total_seconds column does not exist' };
      }
      
    const sql = `
      UPDATE ${qtn}
      SET total_seconds = GREATEST(0, EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER)
      WHERE end_time IS NOT NULL 
        AND (total_seconds < 0 OR total_seconds > 86400 * 365)
    `;
    
      const result = await this.pool.query(sql);
      return { success: true, fixedCount: result.rowCount };
    } catch (err) {
      console.error('Error fixing invalid durations:', err.message);
      return { success: false, error: err.message };
    }
  }

  async close() {
    await this.pool.end();
  }

  // Location Management Methods for Jobs Table
  async ensureJobLocationColumns() {
    try {
      const client = await this.pool.connect();
      
      // Check if start_location column exists in jobs table
      const checkStartLocationQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'start_location';
      `;
      
      const startLocationExists = await client.query(checkStartLocationQuery);
      
      if (startLocationExists.rows.length === 0) {
        // Add start_location column to jobs table
        const addStartLocationQuery = `
          ALTER TABLE jobs 
          ADD COLUMN start_location JSON DEFAULT '[]';
        `;
        
        await client.query(addStartLocationQuery);
        
        // Note: JSON columns work fine without indexes for basic operations
        console.log(`✅ Start location column added to jobs - no index needed for basic JSON operations`);
        console.log(`✅ Added start_location column to jobs table`);
      }
      
      // Check if end_location column exists in jobs table
      const checkEndLocationQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'end_location';
      `;
      
      const endLocationExists = await client.query(checkEndLocationQuery);
      
      if (endLocationExists.rows.length === 0) {
        // Add end_location column to jobs table
        const addEndLocationQuery = `
          ALTER TABLE jobs 
          ADD COLUMN end_location JSON DEFAULT '[]';
        `;
        
        await client.query(addEndLocationQuery);
        
        // Note: JSON columns work fine without indexes for basic operations
        console.log(`✅ End location column added to jobs - no index needed for basic JSON operations`);
        console.log(`✅ Added end_location column to jobs table`);
      }
      
      client.release();
    } catch (err) {
      console.error('Error ensuring job location columns:', err.message);
    }
  }

  async addJobStartLocation(jobId, locationData) {
    try {
      await this.ensureJobLocationColumns();
      
      const client = await this.pool.connect();
      
      // Get current start locations for the job
      const getLocationsQuery = `
        SELECT start_location 
        FROM jobs
        WHERE id = $1
      `;
      
      const currentResult = await client.query(getLocationsQuery, [jobId]);
      
      if (currentResult.rows.length === 0) {
        client.release();
        return { success: false, error: 'Job not found' };
      }
      
      let currentLocations = currentResult.rows[0].start_location || [];
      
      // Add new location with timestamp
      const newLocation = {
        ...locationData,
        timestamp: new Date().toISOString()
      };
      
      currentLocations.push(newLocation);
      
      // Update start_location in jobs table
      const updateQuery = `
        UPDATE jobs
        SET start_location = $2
        WHERE id = $1
        RETURNING start_location
      `;
      
      const updateResult = await client.query(updateQuery, [jobId, JSON.stringify(currentLocations)]);
      
      client.release();
      
      return { success: true, start_location: updateResult.rows[0].start_location };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addJobEndLocation(jobId, locationData) {
    try {
      await this.ensureJobLocationColumns();
      
      const client = await this.pool.connect();
      
      // Get current end locations for the job
      const getLocationsQuery = `
        SELECT end_location 
        FROM jobs
        WHERE id = $1
      `;
      
      const currentResult = await client.query(getLocationsQuery, [jobId]);
      
      if (currentResult.rows.length === 0) {
        client.release();
        return { success: false, error: 'Job not found' };
      }
      
      let currentLocations = currentResult.rows[0].end_location || [];
      
      // Add new location with timestamp
      const newLocation = {
        ...locationData,
        timestamp: new Date().toISOString()
      };
      
      currentLocations.push(newLocation);
      
      // Update end_location in jobs table
      const updateQuery = `
        UPDATE jobs
        SET end_location = $2
        WHERE id = $1
        RETURNING end_location
      `;
      
      const updateResult = await client.query(updateQuery, [jobId, JSON.stringify(currentLocations)]);
      
      client.release();
      
      return { success: true, end_location: updateResult.rows[0].end_location };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getJobLocations(jobId) {
    try {
      await this.ensureJobLocationColumns();
      
      const query = `
        SELECT start_location, end_location
        FROM jobs
        WHERE id = $1
      `;
      
      const result = await this.pool.query(query, [jobId]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Job not found' };
      }
      
      const locations = {
        start_location: result.rows[0].start_location || [],
        end_location: result.rows[0].end_location || []
      };
      
      return { success: true, locations };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export { PgStore };
