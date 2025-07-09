#!/usr/bin/env node

/**
 * Supabase Migration Runner
 * Виконує PostgreSQL migration scripts в Supabase
 */

const fs = require('fs').promises;
const path = require('path');
const supabaseClient = require('../supabase/supabaseClient');

class MigrationRunner {
  constructor() {
    this.migrationsDir = __dirname;
    this.executedMigrations = [];
  }

  /**
   * Виконати всі міграції
   */
  async runMigrations() {
    console.log('🚀 Starting Supabase Migration Runner...\n');

    try {
      // Перевірка підключення до Supabase
      if (!supabaseClient.isAvailable()) {
        throw new Error('Supabase client not available. Please configure .env file with Supabase credentials.');
      }

      const serviceClient = supabaseClient.getServiceClient();
      if (!serviceClient) {
        throw new Error('Supabase service client not available. Please set SUPABASE_SERVICE_ROLE_KEY in .env');
      }

      console.log('✅ Supabase connection verified\n');

      // Отримати список migration files
      const migrationFiles = await this.getMigrationFiles();
      console.log(`📁 Found ${migrationFiles.length} migration files:`);
      migrationFiles.forEach(file => console.log(`   - ${file}`));
      console.log();

      // Створити таблицю для tracking migrations (якщо не існує)
      await this.createMigrationsTable(serviceClient);

      // Отримати вже виконані міграції
      const executedMigrations = await this.getExecutedMigrations(serviceClient);
      console.log(`📋 Already executed migrations: ${executedMigrations.length}`);

      // Виконати нові міграції
      let migrationCount = 0;
      for (const migrationFile of migrationFiles) {
        if (!executedMigrations.includes(migrationFile)) {
          await this.executeMigration(serviceClient, migrationFile);
          migrationCount++;
        } else {
          console.log(`⏭️  Skipping ${migrationFile} (already executed)`);
        }
      }

      console.log(`\n🎯 Migration completed successfully!`);
      console.log(`📊 Executed ${migrationCount} new migrations`);
      console.log(`📋 Total migrations: ${migrationFiles.length}`);

      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('🔍 Error details:', error);
      return false;
    }
  }

  /**
   * Отримати список migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Сортуємо для правильного порядку виконання
    } catch (error) {
      throw new Error(`Failed to read migrations directory: ${error.message}`);
    }
  }

  /**
   * Створити таблицю для tracking migrations
   */
  async createMigrationsTable(client) {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT now(),
        execution_time_ms INTEGER,
        checksum VARCHAR(64)
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at);
    `;

    try {
      const { error } = await client.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        throw error;
      }
      console.log('✅ Schema migrations table ready');
    } catch (error) {
      // Try alternative approach using direct SQL execution
      console.log('ℹ️  Using direct table creation approach...');
      
      const { error: createError } = await client
        .from('schema_migrations')
        .select('id')
        .limit(1);
        
      if (createError && createError.code === 'PGRST116') {
        // Table doesn't exist, we'll handle this in migration file
        console.log('ℹ️  Schema migrations tracking will be set up during migration');
      }
    }
  }

  /**
   * Отримати список вже виконаних міграцій
   */
  async getExecutedMigrations(client) {
    try {
      const { data, error } = await client
        .from('schema_migrations')
        .select('migration_name')
        .order('executed_at', { ascending: true });

      if (error) {
        console.log('ℹ️  No previous migrations found (table may not exist yet)');
        return [];
      }

      return data.map(row => row.migration_name);
    } catch (error) {
      console.log('ℹ️  Unable to check previous migrations, starting fresh');
      return [];
    }
  }

  /**
   * Виконати одну міграцію
   */
  async executeMigration(client, migrationFile) {
    const startTime = Date.now();
    
    try {
      console.log(`\n📋 Executing migration: ${migrationFile}`);
      
      // Читаємо SQL file
      const migrationPath = path.join(this.migrationsDir, migrationFile);
      const sqlContent = await fs.readFile(migrationPath, 'utf8');
      
      console.log(`📄 Migration file size: ${sqlContent.length} bytes`);

      // Розділяємо SQL на окремі statements
      const statements = this.splitSQLStatements(sqlContent);
      console.log(`🔧 Executing ${statements.length} SQL statements...`);

      // Виконуємо кожен statement окремо
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement) {
          console.log(`   Statement ${i + 1}/${statements.length}...`);
          
          try {
            // Try using rpc function first
            const { error } = await client.rpc('exec_sql', { sql: statement });
            if (error) {
              throw error;
            }
          } catch (rpcError) {
            // If rpc doesn't work, we'll need to use alternative approach
            console.warn(`   ⚠️  Direct SQL execution not available, migration needs manual setup`);
            throw new Error(`SQL execution not available via RPC: ${rpcError.message}`);
          }
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(`✅ Migration completed in ${executionTime}ms`);

      // Записуємо в таблицю migrations
      await this.recordMigration(client, migrationFile, executionTime, sqlContent);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Migration failed after ${executionTime}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Розділити SQL на окремі statements
   */
  splitSQLStatements(sql) {
    // Простий розділ по ';' з урахуванням коментарів
    return sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .filter(statement => statement.trim() !== '');
  }

  /**
   * Записати виконану міграцію
   */
  async recordMigration(client, migrationName, executionTime, sqlContent) {
    try {
      const checksum = require('crypto')
        .createHash('sha256')
        .update(sqlContent)
        .digest('hex')
        .substring(0, 16);

      const { error } = await client
        .from('schema_migrations')
        .insert({
          migration_name: migrationName,
          execution_time_ms: executionTime,
          checksum: checksum
        });

      if (error) {
        console.warn(`⚠️  Could not record migration: ${error.message}`);
      } else {
        console.log(`📝 Migration recorded in schema_migrations table`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not record migration: ${error.message}`);
    }
  }

  /**
   * Показати статус міграцій
   */
  async showMigrationStatus() {
    console.log('📊 Migration Status Check...\n');

    try {
      if (!supabaseClient.isAvailable()) {
        console.log('❌ Supabase not available (check .env configuration)');
        return false;
      }

      const serviceClient = supabaseClient.getServiceClient();
      const migrationFiles = await this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations(serviceClient);

      console.log('📁 Migration Files:');
      migrationFiles.forEach(file => {
        const status = executedMigrations.includes(file) ? '✅' : '⏳';
        console.log(`   ${status} ${file}`);
      });

      console.log(`\n📊 Summary:`);
      console.log(`   Total migrations: ${migrationFiles.length}`);
      console.log(`   Executed: ${executedMigrations.length}`);
      console.log(`   Pending: ${migrationFiles.length - executedMigrations.length}`);

      return true;
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'migrate';
  const runner = new MigrationRunner();

  switch (command) {
    case 'migrate':
      runner.runMigrations()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
          console.error('💥 Unexpected error:', error);
          process.exit(1);
        });
      break;

    case 'status':
      runner.showMigrationStatus()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
          console.error('💥 Unexpected error:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('📋 Usage:');
      console.log('   node migrationRunner.js migrate  - Run all pending migrations');
      console.log('   node migrationRunner.js status   - Show migration status');
      process.exit(1);
  }
}

module.exports = MigrationRunner; 