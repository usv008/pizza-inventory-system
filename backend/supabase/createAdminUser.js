#!/usr/bin/env node

/**
 * Create Admin User in Supabase
 * Створює першого admin користувача для тестування Dual Auth
 */

const supabaseClient = require('./supabaseClient');

async function createAdminUser() {
  console.log('🚀 Creating Admin User in Supabase...\n');

  try {
    // Перевірка підключення
    if (!supabaseClient.isAvailable()) {
      throw new Error('Supabase client not available. Check .env configuration.');
    }

    const serviceClient = supabaseClient.getServiceClient();
    if (!serviceClient) {
      throw new Error('Service client not available. Check SUPABASE_SERVICE_ROLE_KEY.');
    }

    // Дані для admin користувача
    const adminData = {
      email: 'admin@pizza-system.com',
      password: 'admin123456', // Змінити після створення!
      username: 'admin',
      full_name: 'System Administrator',
      role: 'admin'
    };

    console.log('📋 Creating admin user with:');
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Role: ${adminData.role}`);
    console.log();

    // 1. Створюємо користувача в Supabase Auth
    console.log('🔐 Step 1: Creating user in Supabase Auth...');
    
    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email: adminData.email,
      password: adminData.password,
      email_confirm: true,
      user_metadata: {
        username: adminData.username,
        full_name: adminData.full_name,
        role: adminData.role
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('⚠️  User already exists in Supabase Auth');
        
        // Спробуємо знайти існуючого користувача
        const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === adminData.email);
        
        if (existingUser) {
          console.log(`✅ Found existing user: ${existingUser.id}`);
          authUser = { user: existingUser };
        } else {
          throw new Error('User exists but cannot be found');
        }
      } else {
        throw authError;
      }
    } else {
      console.log(`✅ User created in Supabase Auth: ${authUser.user.id}`);
    }

    // 2. Створюємо запис в таблиці users
    console.log('📋 Step 2: Creating user record in users table...');
    
    const { data: userRecord, error: userError } = await serviceClient
      .from('users')
      .upsert({
        supabase_id: authUser.user.id,
        username: adminData.username,
        email: adminData.email,
        full_name: adminData.full_name,
        role: adminData.role,
        permissions: {
          // Повні права для admin
          products: { read: true, write: true, delete: true },
          orders: { read: true, write: true, delete: true },
          clients: { read: true, write: true, delete: true },
          production: { read: true, write: true, delete: true },
          users: { read: true, write: true, delete: true },
          reports: { read: true, write: true },
          settings: { read: true, write: true }
        },
        is_active: true
      }, {
        onConflict: 'supabase_id'
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating user record:', userError);
      throw userError;
    }

    console.log(`✅ User record created: ID ${userRecord.id}`);

    // 3. Тестуємо аутентифікацію
    console.log('\n🔍 Step 3: Testing authentication...');
    
    const { data: loginData, error: loginError } = await serviceClient.auth.signInWithPassword({
      email: adminData.email,
      password: adminData.password
    });

    if (loginError) {
      console.warn('⚠️  Login test failed:', loginError.message);
    } else {
      console.log('✅ Login test successful');
      
      // Logout після тесту
      await serviceClient.auth.signOut();
    }

    console.log('\n🎯 Admin User Created Successfully!');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Password: ${adminData.password}`);
    console.log(`   Supabase ID: ${authUser.user.id}`);
    console.log(`   Database ID: ${userRecord.id}`);
    
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    
    return {
      success: true,
      authUser: authUser.user,
      userRecord: userRecord,
      credentials: {
        email: adminData.email,
        password: adminData.password
      }
    };

  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    console.error('🔍 Error details:', error);
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  createAdminUser()
    .then(result => {
      console.log(`\n🏁 Script completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = createAdminUser; 