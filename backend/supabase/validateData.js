const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '..', 'pizza_inventory.db');
const VALIDATION_LOG_FILE = path.join(__dirname, 'validation_log.json');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tables to validate
const TABLES_TO_VALIDATE = [
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
    'api_audit_log',
    'security_events'
];

// Validation results
let validationResults = {
    start_time: new Date().toISOString(),
    tables: {},
    summary: {
        total_tables: 0,
        perfect_matches: 0,
        count_mismatches: 0,
        data_discrepancies: 0,
        validation_errors: 0
    },
    errors: []
};

// Log function
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    console.log(logMessage);
}

// Get SQLite table count
function getSQLiteCount(db, tableName) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count);
            }
        });
    });
}

// Get SQLite table data
function getSQLiteData(db, tableName, limit = null) {
    return new Promise((resolve, reject) => {
        const query = limit ? `SELECT * FROM ${tableName} LIMIT ${limit}` : `SELECT * FROM ${tableName}`;
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Get Supabase table count
async function getSupabaseCount(tableName) {
    const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        throw new Error(`Supabase count error for ${tableName}: ${error.message}`);
    }
    
    return count;
}

// Get Supabase table data
async function getSupabaseData(tableName, limit = null) {
    let query = supabase.from(tableName).select('*');
    
    if (limit) {
        query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
        throw new Error(`Supabase data error for ${tableName}: ${error.message}`);
    }
    
    return data || [];
}

// Normalize data for comparison
function normalizeData(data, source) {
    return data.map(row => {
        const normalized = { ...row };
        
        // Convert SQLite booleans to proper boolean values
        if (source === 'sqlite') {
            Object.keys(normalized).forEach(key => {
                if (key === 'is_active' || key === 'active') {
                    normalized[key] = normalized[key] === 1;
                }
            });
        }
        
        // Normalize dates to consistent format
        Object.keys(normalized).forEach(key => {
            if (key.includes('_at') || key.includes('_date') || 
                key === 'expires' || key === 'timestamp') {
                if (normalized[key]) {
                    try {
                        normalized[key] = new Date(normalized[key]).toISOString();
                    } catch (err) {
                        // Keep original value if date parsing fails
                    }
                }
            }
        });
        
        return normalized;
    });
}

// Compare record fields
function compareRecords(sqliteRecord, supabaseRecord, tableName) {
    const differences = [];
    
    // Check all SQLite fields exist in Supabase record
    Object.keys(sqliteRecord).forEach(key => {
        const sqliteValue = sqliteRecord[key];
        const supabaseValue = supabaseRecord[key];
        
        // Handle null/undefined comparison
        if ((sqliteValue === null || sqliteValue === undefined) && 
            (supabaseValue === null || supabaseValue === undefined)) {
            return; // Both null/undefined, consider equal
        }
        
        // Convert values for comparison
        let normalizedSqlite = sqliteValue;
        let normalizedSupabase = supabaseValue;
        
        // Handle boolean conversion
        if (key === 'is_active' || key === 'active') {
            normalizedSqlite = Boolean(sqliteValue);
            normalizedSupabase = Boolean(supabaseValue);
        }
        
        // Handle date comparison
        if (key.includes('_at') || key.includes('_date')) {
            if (sqliteValue && supabaseValue) {
                try {
                    normalizedSqlite = new Date(sqliteValue).toISOString();
                    normalizedSupabase = new Date(supabaseValue).toISOString();
                } catch (err) {
                    // Keep original values if parsing fails
                }
            }
        }
        
        if (normalizedSqlite !== normalizedSupabase) {
            differences.push({
                field: key,
                sqlite_value: normalizedSqlite,
                supabase_value: normalizedSupabase
            });
        }
    });
    
    return differences;
}

// Validate single table
async function validateTable(db, tableName) {
    log(`🔍 Validating table: ${tableName}...`);
    
    const tableResult = {
        sqlite_count: 0,
        supabase_count: 0,
        count_match: false,
        sample_data_validation: {
            samples_checked: 0,
            perfect_matches: 0,
            records_with_differences: 0,
            differences: []
        },
        status: 'unknown',
        error: null
    };
    
    try {
        // Get record counts
        tableResult.sqlite_count = await getSQLiteCount(db, tableName);
        tableResult.supabase_count = await getSupabaseCount(tableName);
        tableResult.count_match = tableResult.sqlite_count === tableResult.supabase_count;
        
        log(`   SQLite: ${tableResult.sqlite_count} records, Supabase: ${tableResult.supabase_count} records`);
        
        if (!tableResult.count_match) {
            log(`   ⚠️ Count mismatch for ${tableName}`, 'warn');
        }
        
        // Sample data validation (check first 10 records)
        if (tableResult.sqlite_count > 0 && tableResult.supabase_count > 0) {
            const sampleSize = Math.min(10, tableResult.sqlite_count, tableResult.supabase_count);
            
            const sqliteData = await getSQLiteData(db, tableName, sampleSize);
            const supabaseData = await getSupabaseData(tableName, sampleSize);
            
            const normalizedSqlite = normalizeData(sqliteData, 'sqlite');
            const normalizedSupabase = normalizeData(supabaseData, 'supabase');
            
            tableResult.sample_data_validation.samples_checked = sampleSize;
            
            for (let i = 0; i < sampleSize; i++) {
                const sqliteRecord = normalizedSqlite[i];
                const supabaseRecord = normalizedSupabase.find(r => r.id === sqliteRecord.id);
                
                if (!supabaseRecord) {
                    tableResult.sample_data_validation.records_with_differences++;
                    tableResult.sample_data_validation.differences.push({
                        record_id: sqliteRecord.id,
                        issue: 'Record not found in Supabase',
                        sqlite_record: sqliteRecord
                    });
                    continue;
                }
                
                const differences = compareRecords(sqliteRecord, supabaseRecord, tableName);
                
                if (differences.length === 0) {
                    tableResult.sample_data_validation.perfect_matches++;
                } else {
                    tableResult.sample_data_validation.records_with_differences++;
                    tableResult.sample_data_validation.differences.push({
                        record_id: sqliteRecord.id,
                        differences: differences
                    });
                }
            }
        }
        
        // Determine status
        if (tableResult.count_match && 
            tableResult.sample_data_validation.records_with_differences === 0) {
            tableResult.status = 'perfect';
        } else if (tableResult.count_match) {
            tableResult.status = 'count_match_data_issues';
        } else if (tableResult.sample_data_validation.records_with_differences === 0) {
            tableResult.status = 'data_match_count_mismatch';
        } else {
            tableResult.status = 'multiple_issues';
        }
        
        log(`   ✅ Validation completed: ${tableResult.status}`);
        
    } catch (err) {
        log(`   ❌ Validation error: ${err.message}`, 'error');
        tableResult.error = err.message;
        tableResult.status = 'error';
        
        validationResults.errors.push({
            table: tableName,
            error: err.message
        });
    }
    
    validationResults.tables[tableName] = tableResult;
    return tableResult;
}

// Generate validation summary
function generateValidationSummary() {
    validationResults.end_time = new Date().toISOString();
    validationResults.duration_minutes = Math.round(
        (new Date(validationResults.end_time) - new Date(validationResults.start_time)) / 1000 / 60 * 100
    ) / 100;
    
    // Calculate summary statistics
    const tables = Object.values(validationResults.tables);
    validationResults.summary.total_tables = tables.length;
    validationResults.summary.perfect_matches = tables.filter(t => t.status === 'perfect').length;
    validationResults.summary.count_mismatches = tables.filter(t => !t.count_match).length;
    validationResults.summary.data_discrepancies = tables.filter(t => 
        t.sample_data_validation.records_with_differences > 0).length;
    validationResults.summary.validation_errors = tables.filter(t => t.status === 'error').length;
    
    // Save detailed log
    fs.writeFileSync(VALIDATION_LOG_FILE, JSON.stringify(validationResults, null, 2));
    
    // Display summary
    log('\n📊 VALIDATION SUMMARY:');
    log(`- Duration: ${validationResults.duration_minutes} minutes`);
    log(`- Tables validated: ${validationResults.summary.total_tables}`);
    log(`- Perfect matches: ${validationResults.summary.perfect_matches}`);
    log(`- Count mismatches: ${validationResults.summary.count_mismatches}`);
    log(`- Data discrepancies: ${validationResults.summary.data_discrepancies}`);
    log(`- Validation errors: ${validationResults.summary.validation_errors}`);
    
    const successRate = Math.round((validationResults.summary.perfect_matches / validationResults.summary.total_tables) * 100);
    log(`- Overall success rate: ${successRate}%`);
    
    if (validationResults.summary.validation_errors > 0 || 
        validationResults.summary.count_mismatches > 0 ||
        validationResults.summary.data_discrepancies > 0) {
        log(`- Detailed report saved to: ${VALIDATION_LOG_FILE}`);
    }
    
    return validationResults;
}

// Main validation function
async function validateAllData() {
    log('🚀 Starting data validation (SQLite vs Supabase)...');
    
    // Test Supabase connection
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            throw new Error(`Supabase connection failed: ${error.message}`);
        }
        log('✅ Supabase connection verified');
    } catch (err) {
        throw new Error(`Supabase connection test failed: ${err.message}`);
    }
    
    // Connect to SQLite
    const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            throw new Error(`SQLite connection failed: ${err.message}`);
        }
        log('✅ SQLite connection verified');
    });
    
    try {
        // Validate each table
        for (const tableName of TABLES_TO_VALIDATE) {
            await validateTable(db, tableName);
        }
        
        // Generate final summary
        const summary = generateValidationSummary();
        
        log('\n🎉 Data validation completed!');
        
        return summary;
        
    } catch (err) {
        log(`❌ Validation failed: ${err.message}`, 'error');
        throw err;
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing SQLite database:', err.message);
            } else {
                log('✅ SQLite database connection closed');
            }
        });
    }
}

// Run validation if script is executed directly
if (require.main === module) {
    validateAllData()
        .then(summary => {
            const successRate = Math.round((summary.summary.perfect_matches / summary.summary.total_tables) * 100);
            log(`\n✅ Validation completed with ${successRate}% perfect matches`);
            process.exit(summary.summary.validation_errors > 0 ? 1 : 0);
        })
        .catch(err => {
            log(`❌ Validation failed: ${err.message}`, 'error');
            process.exit(1);
        });
}

module.exports = { validateAllData, validationResults }; 