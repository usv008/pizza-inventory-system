const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { mapTableData } = require('./dataMapper');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const EXPORT_DIR = path.join(__dirname, 'exports');
const IMPORT_LOG_FILE = path.join(__dirname, 'import_log.json');

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tables to import in dependency order (same as export)
const TABLES_ORDER = [
    'users',
    'products', 
    'clients',
    'production_settings',
    'orders',
    'order_items',
    'production',
    'production_batches',
    'stock_movements',
    'writeoffs',
    'arrivals',
    'arrivals_items',
    'production_plans',
    'production_plan_items',
    'operations_log',
    'user_sessions',
    'user_audit',
    'api_audit_log',
    'security_events'
];

// Map table names from SQLite to Supabase (if different)
const TABLE_NAME_MAP = {
    'arrivals_items': 'arrival_items'  // SQLite: arrivals_items → Supabase: arrival_items
};

// Tables to skip during import (already migrated or system tables)
const SKIP_TABLES = [
    'user_sessions', // Supabase handles sessions differently
    'users', // Already migrated in Phase 2
    'clients' // Already imported in previous run, has foreign key constraints
];

// Batch size for bulk inserts
const BATCH_SIZE = 100;

// Import statistics
let importStats = {
    start_time: new Date().toISOString(),
    tables: {},
    total_records: 0,
    total_success: 0,
    total_errors: 0,
    errors: []
};

// Log function
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    console.log(logMessage);
}

// Process data for PostgreSQL compatibility
function processDataForImport(data, tableName) {
    return data.map(row => {
        const processed = { ...row };
        
        // Skip SQLite sequence fields
        if ('sqlite_sequence' in processed) {
            delete processed.sqlite_sequence;
        }
        
        // Handle special cases for specific tables
        if (tableName === 'users') {
            // Users already migrated, skip this data
            return null;
        }
        
        // Convert boolean values to proper PostgreSQL format
        Object.keys(processed).forEach(key => {
            if (processed[key] === 1 || processed[key] === 0) {
                if (key === 'is_active' || key === 'active') {
                    processed[key] = processed[key] === 1;
                }
            }
        });
        
        return processed;
    }).filter(row => row !== null);
}

// Import single table
async function importTable(tableName, data) {
    log(`📥 Importing table: ${tableName} (${data.length} records)...`);
    
    if (SKIP_TABLES.includes(tableName)) {
        log(`⏭️ Skipping ${tableName} (already migrated or not needed)`);
        importStats.tables[tableName] = {
            total: data.length,
            success: 0,
            errors: 0,
            skipped: data.length,
            status: 'skipped'
        };
        return { success: 0, errors: 0 };
    }
    
    if (data.length === 0) {
        log(`📭 ${tableName} is empty, skipping`);
        importStats.tables[tableName] = {
            total: 0,
            success: 0,
            errors: 0,
            skipped: 0,
            status: 'empty'
        };
        return { success: 0, errors: 0 };
    }
    
    // Process data for PostgreSQL
    const processedData = processDataForImport(data, tableName);
    
    if (processedData.length === 0) {
        log(`📭 ${tableName} has no data to import after processing`);
        importStats.tables[tableName] = {
            total: data.length,
            success: 0,
            errors: 0,
            skipped: data.length,
            status: 'no_data_after_processing'
        };
        return { success: 0, errors: 0 };
    }

    // Apply data mapping from SQLite to Supabase format
    const mappedData = mapTableData(tableName, processedData);
    
    // Get target table name (some tables have different names in Supabase)
    const targetTableName = TABLE_NAME_MAP[tableName] || tableName;
    
    let successCount = 0;
    let errorCount = 0;
    
    // Import in batches
    for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
        const batch = mappedData.slice(i, i + BATCH_SIZE);
        
        try {
            const { data: result, error } = await supabase
                .from(targetTableName)
                .insert(batch);
            
            if (error) {
                log(`❌ Error importing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${tableName}:`, 'error');
                log(`   ${error.message}`, 'error');
                
                // Try inserting records individually to identify problematic ones
                for (const record of batch) {
                    try {
                        const { error: singleError } = await supabase
                            .from(targetTableName)
                            .insert([record]);
                        
                        if (singleError) {
                            errorCount++;
                            importStats.errors.push({
                                table: tableName,
                                record_id: record.id || 'unknown',
                                error: singleError.message,
                                data: record
                            });
                        } else {
                            successCount++;
                        }
                    } catch (singleErr) {
                        errorCount++;
                        importStats.errors.push({
                            table: tableName,
                            record_id: record.id || 'unknown',
                            error: singleErr.message,
                            data: record
                        });
                    }
                }
            } else {
                successCount += batch.length;
                log(`✅ Imported batch ${Math.floor(i/BATCH_SIZE) + 1} of ${tableName}: ${batch.length} records`);
            }
        } catch (err) {
            log(`❌ Critical error importing ${tableName} batch ${Math.floor(i/BATCH_SIZE) + 1}:`, 'error');
            log(`   ${err.message}`, 'error');
            errorCount += batch.length;
            
            importStats.errors.push({
                table: tableName,
                batch: Math.floor(i/BATCH_SIZE) + 1,
                error: err.message,
                records_affected: batch.length
            });
        }
    }
    
    // Record table statistics
    importStats.tables[tableName] = {
        total: mappedData.length,
        success: successCount,
        errors: errorCount,
        skipped: 0,
        status: errorCount > 0 ? 'partial' : 'success'
    };
    
    log(`📊 ${tableName} import completed: ${successCount} success, ${errorCount} errors`);
    
    return { success: successCount, errors: errorCount };
}

// Validate export files exist
function validateExportFiles() {
    log('🔍 Validating export files...');
    
    if (!fs.existsSync(EXPORT_DIR)) {
        throw new Error(`Export directory not found: ${EXPORT_DIR}`);
    }
    
    const summaryFile = path.join(EXPORT_DIR, 'export_summary.json');
    if (!fs.existsSync(summaryFile)) {
        throw new Error(`Export summary not found: ${summaryFile}`);
    }
    
    const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    log(`✅ Found export from ${summary.export_date} with ${summary.total_records} records`);
    
    return summary;
}

// Test Supabase connection
async function testSupabaseConnection() {
    log('🔗 Testing Supabase connection...');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            throw new Error(`Supabase connection failed: ${error.message}`);
        }
        
        log(`✅ Supabase connected successfully`);
        return true;
    } catch (err) {
        throw new Error(`Supabase connection test failed: ${err.message}`);
    }
}

// Load table data from JSON file
function loadTableData(tableName) {
    const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
    
    if (!fs.existsSync(filePath)) {
        log(`⚠️ File not found: ${filePath}`, 'warn');
        return [];
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (err) {
        log(`❌ Error reading ${filePath}: ${err.message}`, 'error');
        return [];
    }
}

// Generate import summary
function generateImportSummary() {
    importStats.end_time = new Date().toISOString();
    importStats.duration_minutes = Math.round(
        (new Date(importStats.end_time) - new Date(importStats.start_time)) / 1000 / 60 * 100
    ) / 100;
    
    // Calculate totals
    importStats.total_records = Object.values(importStats.tables)
        .reduce((sum, table) => sum + table.total, 0);
    importStats.total_success = Object.values(importStats.tables)
        .reduce((sum, table) => sum + table.success, 0);
    importStats.total_errors = Object.values(importStats.tables)
        .reduce((sum, table) => sum + table.errors, 0);
    
    // Save log file
    fs.writeFileSync(IMPORT_LOG_FILE, JSON.stringify(importStats, null, 2));
    
    // Display summary
    log('\n📊 IMPORT SUMMARY:');
    log(`- Duration: ${importStats.duration_minutes} minutes`);
    log(`- Total records processed: ${importStats.total_records}`);
    log(`- Successfully imported: ${importStats.total_success}`);
    log(`- Errors: ${importStats.total_errors}`);
    log(`- Success rate: ${Math.round((importStats.total_success / importStats.total_records) * 100)}%`);
    
    if (importStats.total_errors > 0) {
        log(`- Error details saved to: ${IMPORT_LOG_FILE}`);
    }
    
    return importStats;
}

// Main import function
async function importAllData() {
    log('🚀 Starting data import to Supabase...');
    
    try {
        // Validate prerequisites
        const exportSummary = validateExportFiles();
        await testSupabaseConnection();
        
        // Import each table
        for (const tableName of TABLES_ORDER) {
            try {
                const tableData = loadTableData(tableName);
                const result = await importTable(tableName, tableData);
                
                importStats.total_success += result.success;
                importStats.total_errors += result.errors;
                
            } catch (err) {
                log(`❌ Critical error importing ${tableName}: ${err.message}`, 'error');
                importStats.errors.push({
                    table: tableName,
                    error: err.message,
                    critical: true
                });
            }
        }
        
        // Generate final summary
        const summary = generateImportSummary();
        
        log('\n🎉 Data import completed!');
        
        if (summary.total_errors > 0) {
            log('⚠️ Some errors occurred during import. Check import_log.json for details.');
        }
        
        return summary;
        
    } catch (err) {
        log(`❌ Import failed: ${err.message}`, 'error');
        throw err;
    }
}

// Run import if script is executed directly
if (require.main === module) {
    importAllData()
        .then(summary => {
            const successRate = Math.round((summary.total_success / summary.total_records) * 100);
            log(`\n✅ Import completed with ${successRate}% success rate`);
            process.exit(summary.total_errors > 0 ? 1 : 0);
        })
        .catch(err => {
            log(`❌ Import failed: ${err.message}`, 'error');
            process.exit(1);
        });
}

module.exports = { importAllData, importStats }; 