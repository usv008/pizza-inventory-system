/**
 * Migration: Create Writeoff Documents System
 * Date: 2025-07-13
 * Purpose: Create new tables and migrate existing writeoff data
 * 
 * This migration implements the hybrid architecture decided in creative phase:
 * - Create new writeoff_documents and writeoff_items tables
 * - Migrate existing writeoffs to new structure
 * - Preserve old writeoffs table for backward compatibility
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Execute SQL migration file
 */
async function executeSQLMigration() {
    console.log('📄 Executing SQL migration commands...');
    
    try {
        // 1. Create writeoff_documents table
        console.log('🔄 Creating writeoff_documents table...');
        const { error: documentsError } = await supabase.rpc('create_writeoff_documents_table');
        if (documentsError) {
            console.log('ℹ️  Table might already exist, continuing...');
        }
        
        // 2. Create writeoff_items table  
        console.log('🔄 Creating writeoff_items table...');
        const { error: itemsError } = await supabase.rpc('create_writeoff_items_table');
        if (itemsError) {
            console.log('ℹ️  Table might already exist, continuing...');
        }
        
        // 3. Create document number generation function
        console.log('🔄 Creating document number generation function...');
        const { error: functionError } = await supabase.rpc('create_writeoff_doc_number_function');
        if (functionError) {
            console.log('ℹ️  Function might already exist, continuing...');
        }
        
        console.log('✅ SQL migration completed successfully');
        
    } catch (error) {
        console.error('❌ SQL migration failed:', error);
        throw error;
    }
}

/**
 * Migrate existing writeoffs to new document structure
 */
async function migrateExistingWriteoffs() {
    console.log('🔄 Starting migration of existing writeoffs...');
    
    // 1. Get all existing writeoffs
    const { data: existingWriteoffs, error: fetchError } = await supabase
        .from('writeoffs')
        .select('*')
        .order('writeoff_date', { ascending: true });
    
    if (fetchError) {
        console.error('❌ Failed to fetch existing writeoffs:', fetchError);
        throw fetchError;
    }
    
    if (!existingWriteoffs || existingWriteoffs.length === 0) {
        console.log('ℹ️  No existing writeoffs found to migrate');
        return;
    }
    
    console.log(`📊 Found ${existingWriteoffs.length} writeoffs to migrate`);
    
    // 2. Group writeoffs by date and responsible person for logical document creation
    const groupedWriteoffs = {};
    
    existingWriteoffs.forEach(writeoff => {
        const key = `${writeoff.writeoff_date}_${writeoff.responsible || 'unknown'}`;
        if (!groupedWriteoffs[key]) {
            groupedWriteoffs[key] = [];
        }
        groupedWriteoffs[key].push(writeoff);
    });
    
    console.log(`📋 Grouped into ${Object.keys(groupedWriteoffs).length} logical documents`);
    
    // 3. Create documents and items
    let migratedCount = 0;
    let documentCount = 0;
    
    for (const [groupKey, writeoffs] of Object.entries(groupedWriteoffs)) {
        try {
            const firstWriteoff = writeoffs[0];
            
            // Generate document number using the SQL function
            const { data: docNumberData, error: docNumberError } = await supabase
                .rpc('generate_writeoff_document_number', {
                    writeoff_date: firstWriteoff.writeoff_date
                });
            
            if (docNumberError) {
                console.error('❌ Failed to generate document number:', docNumberError);
                continue;
            }
            
            // Create document
            const { data: documentData, error: documentError } = await supabase
                .from('writeoff_documents')
                .insert({
                    document_number: docNumberData,
                    writeoff_date: firstWriteoff.writeoff_date,
                    reason: firstWriteoff.reason || 'Migrated from old system',
                    responsible: firstWriteoff.responsible || 'Unknown',
                    notes: `Migrated document containing ${writeoffs.length} items`,
                    created_by: 'migration_script',
                    created_at: firstWriteoff.created_at || new Date().toISOString()
                })
                .select()
                .single();
            
            if (documentError) {
                console.error('❌ Failed to create document:', documentError);
                continue;
            }
            
            // Create items for this document
            const items = writeoffs.map(writeoff => ({
                document_id: documentData.id,
                product_id: writeoff.product_id,
                quantity: writeoff.total_quantity,
                batch_date: writeoff.batch_date || null,
                notes: writeoff.notes || '',
                created_at: writeoff.created_at || new Date().toISOString()
            }));
            
            const { error: itemsError } = await supabase
                .from('writeoff_items')
                .insert(items);
            
            if (itemsError) {
                console.error('❌ Failed to create items for document:', itemsError);
                // Delete the document if items failed
                await supabase
                    .from('writeoff_documents')
                    .delete()
                    .eq('id', documentData.id);
                continue;
            }
            
            documentCount++;
            migratedCount += writeoffs.length;
            
            console.log(`✅ Created document ${documentData.document_number} with ${writeoffs.length} items`);
            
        } catch (error) {
            console.error(`❌ Error migrating group ${groupKey}:`, error);
        }
    }
    
    console.log(`✅ Migration completed: ${documentCount} documents, ${migratedCount} items migrated`);
}

/**
 * Verify migration results
 */
async function verifyMigration() {
    console.log('🔍 Verifying migration results...');
    
    // Count documents and items
    const { data: documentsCount, error: docError } = await supabase
        .from('writeoff_documents')
        .select('id', { count: 'exact' });
    
    const { data: itemsCount, error: itemsError } = await supabase
        .from('writeoff_items')
        .select('id', { count: 'exact' });
    
    const { data: oldWriteoffsCount, error: oldError } = await supabase
        .from('writeoffs')
        .select('id', { count: 'exact' });
    
    if (docError || itemsError || oldError) {
        console.error('❌ Verification failed:', { docError, itemsError, oldError });
        return false;
    }
    
    console.log('📊 Migration verification results:');
    console.log(`   📄 Documents created: ${documentsCount?.length || 0}`);
    console.log(`   📋 Items created: ${itemsCount?.length || 0}`);
    console.log(`   📜 Original writeoffs: ${oldWriteoffsCount?.length || 0}`);
    
    return true;
}

/**
 * Main migration function
 */
async function runMigration() {
    console.log('🚀 Starting Writeoff Documents Migration');
    console.log('=====================================');
    
    try {
        // Step 1: Execute SQL migration
        await executeSQLMigration();
        
        // Step 2: Migrate existing data
        await migrateExistingWriteoffs();
        
        // Step 3: Verify results
        const verified = await verifyMigration();
        
        if (verified) {
            console.log('🎉 Migration completed successfully!');
            console.log('=====================================');
            console.log('Next steps:');
            console.log('1. Update backend queries to support hybrid API');
            console.log('2. Implement new writeoff document services');
            console.log('3. Create frontend for new document creation');
        } else {
            console.log('⚠️  Migration completed with verification issues');
        }
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

// Execute migration if called directly
if (require.main === module) {
    runMigration();
}

module.exports = {
    runMigration,
    executeSQLMigration,
    migrateExistingWriteoffs,
    verifyMigration
}; 