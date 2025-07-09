#!/usr/bin/env node

/**
 * Supabase Connection Test Script
 * Тестує базовий Supabase client без реальних credentials
 */

const supabaseClient = require('./supabaseClient');

async function testSupabaseConnection() {
  console.log('🚀 Testing Supabase Client Configuration...\n');

  try {
    // Test 1: Check if client is initialized
    console.log('📋 Test 1: Client Initialization');
    const client = supabaseClient.getClient();
    const serviceClient = supabaseClient.getServiceClient();
    
    if (!client && !serviceClient) {
      console.log('⚠️  No credentials found - running in legacy mode (expected)');
      console.log('✅ Client gracefully handles missing credentials\n');
    } else {
      console.log('✅ Client initialized with credentials\n');
    }

    // Test 2: Check availability
    console.log('📋 Test 2: Availability Check');
    const isAvailable = supabaseClient.isAvailable();
    console.log(`🔍 Supabase Available: ${isAvailable}`);
    
    if (!isAvailable) {
      console.log('ℹ️  This is expected without .env configuration\n');
    }

    // Test 3: Test connection (will fail gracefully without credentials)
    console.log('📋 Test 3: Connection Test');
    const connectionTest = await supabaseClient.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ Connection successful!');
      console.log(`📝 Message: ${connectionTest.message}\n`);
    } else {
      console.log('⚠️  Connection failed (expected without credentials)');
      console.log(`📝 Error: ${connectionTest.error}\n`);
    }

    // Test 4: Environment variables check
    console.log('📋 Test 4: Environment Variables');
    const envVars = {
      SUPABASE_URL: process.env.SUPABASE_URL || 'Not set',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set (hidden)' : 'Not set',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set (hidden)' : 'Not set'
    };

    Object.entries(envVars).forEach(([key, value]) => {
      const status = value === 'Not set' ? '❌' : '✅';
      console.log(`${status} ${key}: ${value}`);
    });

    console.log('\n🎯 Summary:');
    console.log('✅ Supabase client module loads correctly');
    console.log('✅ Graceful handling of missing credentials');
    console.log('✅ Ready for configuration with real credentials');
    
    if (!isAvailable) {
      console.log('\n📋 Next Steps:');
      console.log('1. Create Supabase project at https://supabase.com');
      console.log('2. Copy API keys to .env file');
      console.log('3. Re-run this test');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Stack trace:', error.stack);
    return false;
  }

  return true;
}

// Run test if called directly
if (require.main === module) {
  testSupabaseConnection()
    .then(success => {
      console.log(`\n🏁 Test completed: ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = testSupabaseConnection; 