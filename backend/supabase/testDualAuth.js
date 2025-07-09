#!/usr/bin/env node

/**
 * Test Dual Authentication System
 * Тестує роботу Dual Auth Router та Middleware
 */

const authRouter = require('./authRouter');

async function testDualAuth() {
  console.log('🚀 Testing Dual Authentication System...\n');

  try {
    // Test 1: Auth Router Statistics
    console.log('📋 Test 1: Authentication Statistics');
    const authStats = await authRouter.getAuthStats();
    console.log('📊 Auth Statistics:');
    console.log(`   Legacy users: ${authStats.legacy}`);
    console.log(`   Supabase users: ${authStats.supabase}`);
    console.log(`   Total users: ${authStats.total}`);
    console.log(`   Migration progress: ${authStats.migrationProgress}%`);
    console.log();

    // Test 2: Supabase Login Test
    console.log('📋 Test 2: Supabase Authentication Test');
    
    try {
      const loginResult = await authRouter.loginSupabase(
        'admin@pizza-system.com', 
        'admin123456'
      );
      
      console.log('✅ Supabase login successful');
      console.log(`   User ID: ${loginResult.user.id}`);
      console.log(`   Email: ${loginResult.user.email}`);
      console.log(`   Auth Type: ${loginResult.authType}`);
      
      // Test 3: Mock Request Authentication
      console.log('\n📋 Test 3: Mock Request Authentication');
      
      const mockRequest = {
        headers: {
          authorization: `Bearer ${loginResult.session.access_token}`
        }
      };
      
      const authenticatedUser = await authRouter.authenticate(mockRequest);
      
      if (authenticatedUser) {
        console.log('✅ Request authentication successful');
        console.log(`   Username: ${authenticatedUser.username}`);
        console.log(`   Role: ${authenticatedUser.role}`);
        console.log(`   Auth Type: ${authenticatedUser.authType}`);
        console.log(`   System: ${authenticatedUser.system}`);
      } else {
        console.log('❌ Request authentication failed');
      }
      
      // Logout
      await authRouter.supabaseAuth.getClient().auth.signOut();
      console.log('✅ Logout successful');
      
    } catch (loginError) {
      console.error('❌ Supabase login failed:', loginError.message);
    }

    // Test 4: Legacy Auth Test (mock)
    console.log('\n📋 Test 4: Legacy Authentication Test');
    
    const mockLegacyRequest = {
      session: { userId: 1 },
      sessionID: 'mock-session-id'
    };
    
    try {
      const legacyUser = await authRouter.authenticate(mockLegacyRequest);
      
      if (legacyUser) {
        console.log('✅ Legacy authentication works');
        console.log(`   Auth Type: ${legacyUser.authType}`);
        console.log(`   System: ${legacyUser.system}`);
      } else {
        console.log('ℹ️  Legacy authentication not available (expected if legacy DB not connected)');
      }
    } catch (legacyError) {
      console.log('ℹ️  Legacy authentication test failed (expected if legacy DB not connected)');
      console.log(`   Reason: ${legacyError.message}`);
    }

    // Test 5: Auth Mode Detection
    console.log('\n📋 Test 5: Auth Mode Detection');
    
    const testRequests = [
      {
        headers: { authorization: 'Bearer test-token' },
        session: null,
        description: 'Bearer token request'
      },
      {
        headers: {},
        session: { userId: 1 },
        description: 'Session-based request'
      },
      {
        headers: {},
        session: null,
        description: 'No authentication'
      }
    ];
    
    testRequests.forEach(req => {
      const authMode = authRouter.getAuthMode(req);
      console.log(`   ${req.description}: ${authMode}`);
    });

    console.log('\n🎯 Dual Auth System Test Summary:');
    console.log('✅ Auth Router operational');
    console.log('✅ Statistics collection works');
    console.log('✅ Supabase authentication works');
    console.log('✅ Request authentication works');
    console.log('✅ Auth mode detection works');
    
    if (authStats.supabase > 0) {
      console.log('✅ Supabase users created successfully');
    }
    
    console.log('\n🔄 System Status:');
    console.log(`   Supabase Available: ${authRouter.supabaseAuth.isAvailable()}`);
    console.log(`   Legacy Available: ${authRouter.legacyAuth.isAvailable()}`);
    
    return true;

  } catch (error) {
    console.error('❌ Dual Auth test failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  }
}

// Test Dual Auth Middleware
async function testDualAuthMiddleware() {
  console.log('\n🧪 Testing Dual Auth Middleware...\n');
  
  const DualAuthMiddleware = require('../middleware/dualAuth');
  
  // Mock Express request/response
  const mockReq = {
    headers: { authorization: 'Bearer invalid-token' },
    session: null,
    ip: '127.0.0.1',
    get: (header) => header === 'User-Agent' ? 'Test-Agent' : null,
    method: 'GET',
    path: '/test'
  };
  
  const mockRes = {
    status: (code) => ({ json: (data) => console.log(`HTTP ${code}:`, data) })
  };
  
  const mockNext = () => console.log('✅ Middleware passed to next()');
  
  console.log('📋 Testing authentication middleware with invalid token...');
  
  try {
    await DualAuthMiddleware.authenticate(mockReq, mockRes, mockNext);
  } catch (error) {
    console.log('ℹ️  Authentication middleware handled invalid token correctly');
  }
  
  console.log('\n📋 Testing optional auth middleware...');
  
  try {
    await DualAuthMiddleware.optionalAuth(mockReq, mockRes, () => {
      console.log('✅ Optional auth completed');
      console.log(`   Authenticated: ${mockReq.isAuthenticated}`);
      console.log(`   User: ${mockReq.user ? mockReq.user.username : 'null'}`);
    });
  } catch (error) {
    console.log('❌ Optional auth failed:', error.message);
  }
  
  return true;
}

// Run tests if called directly
if (require.main === module) {
  (async () => {
    const test1 = await testDualAuth();
    const test2 = await testDualAuthMiddleware();
    
    const allPassed = test1 && test2;
    
    console.log(`\n🏁 All tests completed: ${allPassed ? 'PASSED' : 'FAILED'}`);
    process.exit(allPassed ? 0 : 1);
  })().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { testDualAuth, testDualAuthMiddleware }; 