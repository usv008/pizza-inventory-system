const { supabase } = require('./database-supabase');
require('dotenv').config();

async function cleanupTestSessions() {
    console.log('🧹 Cleaning up test sessions...\n');
    
    try {
        // Delete all test sessions
        const { data, error } = await supabase
            .from('http_sessions')
            .delete()
            .like('session_id', 'test-%')
            .select('session_id');
            
        if (error) {
            throw error;
        }
        
        console.log(`✅ Deleted ${data.length} test sessions`);
        data.forEach(session => {
            console.log(`   - ${session.session_id}`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        return false;
    }
}

if (require.main === module) {
    cleanupTestSessions().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { cleanupTestSessions };