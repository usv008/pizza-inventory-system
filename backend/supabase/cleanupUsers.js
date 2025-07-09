#!/usr/bin/env node

/**
 * Cleanup orphaned Supabase Auth users
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function cleanupOrphanedUsers() {
  console.log('🧹 Cleaning up orphaned Supabase Auth users...');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: authUsers, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error listing users:', error);
      return;
    }

    console.log(`📋 Found ${authUsers.users.length} auth users`);

    for (const user of authUsers.users) {
      if (user.email !== 'admin@pizza-system.com') {
        console.log(`🗑️  Deleting: ${user.email} (${user.id})`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`❌ Failed to delete ${user.email}:`, deleteError.message);
        } else {
          console.log(`✅ Deleted: ${user.email}`);
        }
      } else {
        console.log(`⏭️  Keeping admin: ${user.email}`);
      }
    }

    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('💥 Cleanup failed:', error.message);
  }
}

if (require.main === module) {
  cleanupOrphanedUsers();
}

module.exports = { cleanupOrphanedUsers }; 