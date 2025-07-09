#!/usr/bin/env node

/**
 * User Migration Script
 * Міграція користувачів з SQLite до Supabase
 */

const authRouter = require('./authRouter');
const database = require('../database');

async function migrateUsers() {
  console.log('🚀 Starting User Migration from SQLite to Supabase...\n');

  try {
    // Отримуємо статистику до міграції
    const beforeStats = await authRouter.getAuthStats();
    console.log('📊 Before Migration:');
    console.log(`   Legacy users: ${beforeStats.legacy}`);
    console.log(`   Supabase users: ${beforeStats.supabase}`);
    console.log(`   Migration progress: ${beforeStats.migrationProgress}%\n`);

    // Отримуємо всіх користувачів з SQLite
    const legacyUsers = await database.userQueries.getAll();
    console.log(`📋 Found ${legacyUsers.length} users in SQLite database\n`);

    const results = {
      total: legacyUsers.length,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    for (const user of legacyUsers) {
      console.log(`🔄 Migrating user: ${user.username} (ID: ${user.id})...`);

      try {
        // Перевіряємо чи користувач вже мігрований
        const existingUser = await checkUserExists(user);
        
        if (existingUser) {
          console.log(`   ⏭️  User already exists in Supabase (${existingUser.supabase_id})`);
          results.skipped++;
          results.details.push({
            username: user.username,
            status: 'skipped',
            reason: 'Already exists in Supabase'
          });
          continue;
        }

        // Створюємо користувача в Supabase Auth
        const supabaseUser = await createSupabaseUser(user);
        
        if (!supabaseUser) {
          console.log(`   ❌ Failed to create user in Supabase Auth`);
          results.errors++;
          results.details.push({
            username: user.username,
            status: 'error',
            reason: 'Supabase Auth creation failed'
          });
          continue;
        }

        // Оновлюємо SQLite запис з Supabase ID
        await updateLegacyUserWithSupabaseId(user.id, supabaseUser.id);

        console.log(`   ✅ Successfully migrated to Supabase (${supabaseUser.id})`);
        results.migrated++;
        results.details.push({
          username: user.username,
          status: 'migrated',
          supabase_id: supabaseUser.id,
          email: supabaseUser.email
        });

      } catch (error) {
        console.error(`   ❌ Migration failed:`, error.message);
        results.errors++;
        results.details.push({
          username: user.username,
          status: 'error',
          reason: error.message
        });
      }

      // Невелика пауза між користувачами
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Статистика після міграції
    console.log('\n🎯 Migration Summary:');
    console.log(`   Total users: ${results.total}`);
    console.log(`   Migrated: ${results.migrated}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Errors: ${results.errors}`);

    // Перевіряємо статистику після міграції
    const afterStats = await authRouter.getAuthStats();
    console.log('\n📊 After Migration:');
    console.log(`   Legacy users: ${afterStats.legacy}`);
    console.log(`   Supabase users: ${afterStats.supabase}`);
    console.log(`   Migration progress: ${afterStats.migrationProgress}%`);

    // Детальний звіт
    if (results.details.length > 0) {
      console.log('\n📝 Detailed Report:');
      results.details.forEach(detail => {
        const status = detail.status === 'migrated' ? '✅' : 
                      detail.status === 'skipped' ? '⏭️' : '❌';
        console.log(`   ${status} ${detail.username}: ${detail.reason || detail.supabase_id || 'migrated'}`);
      });
    }

    console.log('\n🏁 User migration completed!');
    return results;

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error('🔍 Error details:', error);
    throw error;
  }
}

/**
 * Перевіряє чи користувач вже існує в Supabase
 */
async function checkUserExists(user) {
  try {
    // Перевіряємо по email в Supabase
    if (user.email) {
      const supabaseClient = authRouter.supabaseAuth.getServiceClient();
      const { data: users, error } = await supabaseClient
        .from('users')
        .select('supabase_id, username, email')
        .eq('email', user.email)
        .limit(1);

      if (error) {
        console.log(`   🔍 Supabase check error: ${error.message}`);
        return null;
      }

      if (users && users.length > 0) {
        return users[0];
      }
    }

    // Перевіряємо по username
    const supabaseClient = authRouter.supabaseAuth.getServiceClient();
    const { data: users, error } = await supabaseClient
      .from('users')
      .select('supabase_id, username, email')
      .eq('username', user.username)
      .limit(1);

    if (error) {
      console.log(`   🔍 Supabase username check error: ${error.message}`);
      return null;
    }

    return users && users.length > 0 ? users[0] : null;

  } catch (error) {
    console.log(`   🔍 User existence check failed: ${error.message}`);
    return null;
  }
}

/**
 * Створює користувача в Supabase Auth та в таблиці users
 */
async function createSupabaseUser(user) {
  try {
    // Створюємо email якщо його немає, з очищенням username від спецсимволів
    const cleanUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const email = user.email || `${cleanUsername}@pizza-system.local`;
    
    // Тимчасовий пароль для міграції
    const tempPassword = `temp_${cleanUsername}_${Date.now()}`;

    // Створюємо користувача в Supabase Auth
    const supabaseAuth = authRouter.supabaseAuth.getServiceClient().auth.admin;
    const { data: authUser, error: authError } = await supabaseAuth.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        username: user.username,
        migrated_from_legacy: true,
        legacy_id: user.id,
        migration_date: new Date().toISOString()
      }
    });

    if (authError) {
      throw new Error(`Supabase Auth error: ${authError.message}`);
    }

    console.log(`   🔐 Supabase Auth user created: ${authUser.user.id}`);

    // Створюємо запис в таблиці users
    const supabaseClient = authRouter.supabaseAuth.getServiceClient();
    const { data: dbUser, error: dbError } = await supabaseClient
      .from('users')
      .insert({
        supabase_id: authUser.user.id,
        username: user.username,
        email: email,
        full_name: user.username, // Використовуємо username як full_name
        role: user.role,
        permissions: user.permissions,
        is_active: user.active === 1,
        created_at: user.created_at || new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      // Якщо помилка в створенні DB record, видаляємо Auth user
      await supabaseAuth.deleteUser(authUser.user.id);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log(`   📝 Database record created: ID ${dbUser.id}`);

    return {
      id: authUser.user.id,
      email: authUser.user.email,
      database_id: dbUser.id
    };

  } catch (error) {
    console.error(`   🚨 Create Supabase user failed: ${error.message}`);
    throw error;
  }
}

/**
 * Оновлює legacy user з Supabase ID
 */
async function updateLegacyUserWithSupabaseId(legacyId, supabaseId) {
  try {
    // Додаємо Supabase ID до legacy запису для зв'язку
    const db = database.db;
    
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE users 
        SET supabase_id = ?, 
            auth_type = 'dual',
            updated_at = datetime('now')
        WHERE id = ?
      `, [supabaseId, legacyId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    console.log(`   🔗 Legacy record updated with Supabase ID`);
    return true;

  } catch (error) {
    console.error(`   🚨 Legacy update failed: ${error.message}`);
    throw error;
  }
}

/**
 * Batch migration з можливістю вибору користувачів
 */
async function migrateBatch(usernames = null, excludeUsernames = null) {
  console.log('🚀 Starting Batch User Migration...\n');

  try {
    let legacyUsers = await database.userQueries.getAll();
    
    // Фільтруємо по іменах якщо вказано
    if (usernames && usernames.length > 0) {
      legacyUsers = legacyUsers.filter(user => usernames.includes(user.username));
      console.log(`📋 Filtered to ${legacyUsers.length} specified users`);
    }
    
    // Виключаємо користувачів якщо вказано
    if (excludeUsernames && excludeUsernames.length > 0) {
      legacyUsers = legacyUsers.filter(user => !excludeUsernames.includes(user.username));
      console.log(`📋 Excluded ${excludeUsernames.length} users, ${legacyUsers.length} remaining`);
    }

    if (legacyUsers.length === 0) {
      console.log('ℹ️  No users to migrate');
      return { total: 0, migrated: 0, skipped: 0, errors: 0 };
    }

    // Використовуємо основну функцію міграції, але з фільтрованим списком
    // Тимчасово замінюємо метод getAll
    const originalGetAll = database.userQueries.getAll;
    database.userQueries.getAll = async () => legacyUsers;
    
    const result = await migrateUsers();
    
    // Відновлюємо оригінальний метод
    database.userQueries.getAll = originalGetAll;
    
    return result;

  } catch (error) {
    console.error('💥 Batch migration failed:', error.message);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
User Migration Script Help:

Basic migration:
  node migrateUsers.js

Migrate specific users:
  node migrateUsers.js --users user1,user2,user3

Exclude specific users:
  node migrateUsers.js --exclude admin,test

Examples:
  node migrateUsers.js --users "john,jane"
  node migrateUsers.js --exclude "admin"
    `);
    process.exit(0);
  }

  const usersIndex = args.indexOf('--users');
  const excludeIndex = args.indexOf('--exclude');
  
  const usernames = usersIndex !== -1 && args[usersIndex + 1] ? 
    args[usersIndex + 1].split(',').map(u => u.trim()) : null;
  const excludeUsernames = excludeIndex !== -1 && args[excludeIndex + 1] ? 
    args[excludeIndex + 1].split(',').map(u => u.trim()) : null;

  (async () => {
    try {
      const result = usernames || excludeUsernames ? 
        await migrateBatch(usernames, excludeUsernames) :
        await migrateUsers();
      
      const success = result.errors === 0;
      console.log(`\n🏁 Migration ${success ? 'COMPLETED' : 'COMPLETED WITH ERRORS'}`);
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { 
  migrateUsers, 
  migrateBatch, 
  checkUserExists, 
  createSupabaseUser,
  updateLegacyUserWithSupabaseId 
}; 