const { supabase } = require('../../database-supabase');
require('dotenv').config();

/**
 * Test suite for http_sessions table
 * Tests the express-session storage functionality
 */
async function testHttpSessionsTable() {
    console.log('🧪 Testing http_sessions table...\n');
    
    const testSessionId = 'test-session-' + Date.now();
    const testSessionData = {
        user: { id: 1, username: 'test', role: 'admin' },
        isAuthenticated: true,
        loginTime: new Date().toISOString(),
        cookie: { maxAge: 3600000 }
    };
    
    let testsPassed = 0;
    let totalTests = 0;
    
    try {
        // Test 1: Table existence and structure
        totalTests++;
        console.log('📋 Test 1: Table structure verification...');
        
        const { data: structureTest, error: structureError } = await supabase
            .from('http_sessions')
            .select('*')
            .limit(0);
            
        if (structureError) {
            throw new Error(`Table structure test failed: ${structureError.message}`);
        }
        
        console.log('✅ Table exists and is accessible');
        testsPassed++;
        
        // Test 2: Insert session
        totalTests++;
        console.log('\n📝 Test 2: Insert session...');
        
        const { data: insertData, error: insertError } = await supabase
            .from('http_sessions')
            .insert({
                session_id: testSessionId,
                session_data: JSON.stringify(testSessionData),
                expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
            })
            .select()
            .single();
            
        if (insertError) {
            throw new Error(`Session insert failed: ${insertError.message}`);
        }
        
        console.log('✅ Session inserted successfully');
        console.log(`   Session ID: ${insertData.session_id}`);
        console.log(`   Created at: ${insertData.created_at}`);
        testsPassed++;
        
        // Test 3: Select session by ID
        totalTests++;
        console.log('\n📖 Test 3: Select session by ID...');
        
        const { data: selectData, error: selectError } = await supabase
            .from('http_sessions')
            .select('*')
            .eq('session_id', testSessionId)
            .single();
            
        if (selectError) {
            throw new Error(`Session select failed: ${selectError.message}`);
        }
        
        const parsedSessionData = JSON.parse(selectData.session_data);
        if (parsedSessionData.user.username !== testSessionData.user.username) {
            throw new Error('Session data integrity check failed');
        }
        
        console.log('✅ Session retrieved successfully');
        console.log(`   User: ${parsedSessionData.user.username}`);
        console.log(`   Authenticated: ${parsedSessionData.isAuthenticated}`);
        testsPassed++;
        
        // Test 4: Update session
        totalTests++;
        console.log('\n🔄 Test 4: Update session...');
        
        const updatedSessionData = {
            ...testSessionData,
            lastActivity: new Date().toISOString(),
            visits: 2
        };
        
        const { data: updateData, error: updateError } = await supabase
            .from('http_sessions')
            .update({
                session_data: JSON.stringify(updatedSessionData),
                expires_at: new Date(Date.now() + 7200000).toISOString() // 2 hours
            })
            .eq('session_id', testSessionId)
            .select()
            .single();
            
        if (updateError) {
            throw new Error(`Session update failed: ${updateError.message}`);
        }
        
        const updatedParsedData = JSON.parse(updateData.session_data);
        if (!updatedParsedData.lastActivity || updatedParsedData.visits !== 2) {
            throw new Error('Session update integrity check failed');
        }
        
        console.log('✅ Session updated successfully');
        console.log(`   Last activity: ${updatedParsedData.lastActivity}`);
        console.log(`   Visits: ${updatedParsedData.visits}`);
        testsPassed++;
        
        // Test 5: Upsert (insert or update)
        totalTests++;
        console.log('\n🔀 Test 5: Upsert session...');
        
        const upsertSessionId = 'upsert-test-' + Date.now();
        const upsertSessionData = {
            user: { id: 2, username: 'upsert-user' },
            isAuthenticated: false
        };
        
        const { data: upsertData, error: upsertError } = await supabase
            .from('http_sessions')
            .upsert({
                session_id: upsertSessionId,
                session_data: JSON.stringify(upsertSessionData),
                expires_at: new Date(Date.now() + 3600000).toISOString()
            })
            .select()
            .single();
            
        if (upsertError) {
            throw new Error(`Session upsert failed: ${upsertError.message}`);
        }
        
        console.log('✅ Session upserted successfully');
        console.log(`   Upsert session ID: ${upsertData.session_id}`);
        testsPassed++;
        
        // Test 6: Query by expiration (cleanup test)
        totalTests++;
        console.log('\n🧹 Test 6: Query expired sessions...');
        
        // Create an expired session
        const expiredSessionId = 'expired-test-' + Date.now();
        await supabase
            .from('http_sessions')
            .insert({
                session_id: expiredSessionId,
                session_data: JSON.stringify({ test: 'expired' }),
                expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            });
        
        // Query expired sessions
        const { data: expiredSessions, error: expiredError } = await supabase
            .from('http_sessions')
            .select('session_id')
            .lt('expires_at', new Date().toISOString());
            
        if (expiredError) {
            throw new Error(`Expired sessions query failed: ${expiredError.message}`);
        }
        
        const hasExpiredSession = expiredSessions.some(s => s.session_id === expiredSessionId);
        if (!hasExpiredSession) {
            throw new Error('Expired session not found in query results');
        }
        
        console.log('✅ Expired sessions query successful');
        console.log(`   Found ${expiredSessions.length} expired sessions`);
        testsPassed++;
        
        // Test 7: Bulk delete expired sessions
        totalTests++;
        console.log('\n🗑️ Test 7: Delete expired sessions...');
        
        const { data: deleteData, error: deleteError } = await supabase
            .from('http_sessions')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .select('session_id');
            
        if (deleteError) {
            throw new Error(`Expired sessions delete failed: ${deleteError.message}`);
        }
        
        console.log('✅ Expired sessions deleted successfully');
        console.log(`   Deleted ${deleteData.length} expired sessions`);
        testsPassed++;
        
        // Test 8: Index performance test
        totalTests++;
        console.log('\n⚡ Test 8: Index performance test...');
        
        const start = performance.now();
        
        // Multiple queries to test index performance
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(
                supabase
                    .from('http_sessions')
                    .select('session_id')
                    .eq('session_id', testSessionId)
            );
        }
        
        await Promise.all(promises);
        const end = performance.now();
        const duration = Math.round(end - start);
        
        if (duration > 1000) { // 1 second threshold
            console.log(`⚠️ Index performance test completed but slow: ${duration}ms`);
        } else {
            console.log(`✅ Index performance test successful: ${duration}ms`);
        }
        testsPassed++;
        
        // Cleanup: Delete test sessions
        console.log('\n🧹 Cleaning up test data...');
        await supabase
            .from('http_sessions')
            .delete()
            .in('session_id', [testSessionId, upsertSessionId]);
        
        console.log('✅ Test data cleaned up');
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    }
    
    // Results summary
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('=' * 40);
    console.log(`Tests passed: ${testsPassed}/${totalTests}`);
    console.log(`Success rate: ${Math.round(testsPassed/totalTests*100)}%`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 All http_sessions table tests passed!');
        console.log('\n✅ Table is ready for production use');
        return true;
    } else {
        console.log('❌ Some tests failed - review table setup');
        return false;
    }
}

// Run tests if called directly
if (require.main === module) {
    testHttpSessionsTable().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testHttpSessionsTable };