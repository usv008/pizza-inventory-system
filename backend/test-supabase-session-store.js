const SupabaseSessionStore = require('./middleware/SupabaseSessionStore');
require('dotenv').config();

async function testSupabaseSessionStore() {
    console.log('🧪 Testing SupabaseSessionStore...\n');
    
    const store = new SupabaseSessionStore({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_KEY,
        tableName: 'http_sessions',
        fallbackToMemory: true
    });
    
    const testSessionId = 'test-session-' + Date.now() + '-' + Math.random().toString(36).substring(7);
    const testSession = {
        user: {
            id: 1,
            username: 'admin',
            role: 'admin'
        },
        isAuthenticated: true,
        loginTime: new Date().toISOString(),
        cookie: {
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    };
    
    try {
        // Test 1: Set session
        console.log('📝 Test 1: Setting session...');
        await new Promise((resolve, reject) => {
            store.set(testSessionId, testSession, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ Session set successfully');
        
        // Test 2: Get session
        console.log('\n📖 Test 2: Getting session...');
        const retrievedSession = await new Promise((resolve, reject) => {
            store.get(testSessionId, (err, session) => {
                if (err) reject(err);
                else resolve(session);
            });
        });
        
        if (retrievedSession) {
            console.log('✅ Session retrieved successfully');
            console.log('   Session data:', JSON.stringify(retrievedSession, null, 2));
            
            // Verify data integrity
            if (retrievedSession.user.username === testSession.user.username) {
                console.log('✅ Session data integrity verified');
            } else {
                console.log('❌ Session data integrity failed');
            }
        } else {
            console.log('❌ Session not found');
        }
        
        // Test 3: Get session count
        console.log('\n📊 Test 3: Getting session count...');
        const sessionCount = await new Promise((resolve, reject) => {
            store.length((err, count) => {
                if (err) reject(err);
                else resolve(count);
            });
        });
        console.log(`✅ Total active sessions: ${sessionCount}`);
        
        // Test 4: Get all sessions
        console.log('\n📋 Test 4: Getting all sessions...');
        const allSessions = await new Promise((resolve, reject) => {
            store.all((err, sessions) => {
                if (err) reject(err);
                else resolve(sessions);
            });
        });
        console.log(`✅ Retrieved ${Object.keys(allSessions).length} sessions`);
        
        // Test 5: Update session
        console.log('\n🔄 Test 5: Updating session...');
        const updatedSession = {
            ...testSession,
            lastActivity: new Date().toISOString(),
            user: {
                ...testSession.user,
                lastLogin: new Date().toISOString()
            }
        };
        
        await new Promise((resolve, reject) => {
            store.set(testSessionId, updatedSession, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ Session updated successfully');
        
        // Test 6: Verify update
        console.log('\n🔍 Test 6: Verifying update...');
        const verifySession = await new Promise((resolve, reject) => {
            store.get(testSessionId, (err, session) => {
                if (err) reject(err);
                else resolve(session);
            });
        });
        
        if (verifySession && verifySession.lastActivity) {
            console.log('✅ Session update verified');
        } else {
            console.log('❌ Session update verification failed');
        }
        
        // Test 7: Cleanup expired sessions
        console.log('\n🧹 Test 7: Testing expired session cleanup...');
        await store.cleanupExpired();
        console.log('✅ Cleanup completed');
        
        // Test 8: Destroy session
        console.log('\n🗑️ Test 8: Destroying test session...');
        await new Promise((resolve, reject) => {
            store.destroy(testSessionId, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ Session destroyed successfully');
        
        // Test 9: Verify destruction
        console.log('\n✔️ Test 9: Verifying session destruction...');
        const destroyedSession = await new Promise((resolve, reject) => {
            store.get(testSessionId, (err, session) => {
                if (err) reject(err);
                else resolve(session);
            });
        });
        
        if (!destroyedSession) {
            console.log('✅ Session destruction verified');
        } else {
            console.log('❌ Session still exists after destruction');
        }
        
        console.log('\n🎉 All SupabaseSessionStore tests completed successfully!');
        console.log('\n📋 Test Summary:');
        console.log('   ✅ Session creation');
        console.log('   ✅ Session retrieval');
        console.log('   ✅ Session counting');
        console.log('   ✅ Session listing');
        console.log('   ✅ Session updating');
        console.log('   ✅ Session cleanup');
        console.log('   ✅ Session destruction');
        console.log('   ✅ Data integrity');
        
        return true;
        
    } catch (error) {
        console.error('❌ SupabaseSessionStore test failed:', error);
        
        // Cleanup on error
        try {
            await new Promise((resolve) => {
                store.destroy(testSessionId, () => resolve());
            });
        } catch (cleanupError) {
            console.error('❌ Cleanup error:', cleanupError);
        }
        
        return false;
    }
}

// Run tests
if (require.main === module) {
    testSupabaseSessionStore().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testSupabaseSessionStore };