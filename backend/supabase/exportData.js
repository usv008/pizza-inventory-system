const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '..', 'pizza_inventory.db');
const EXPORT_DIR = path.join(__dirname, 'exports');

// Tables to export in dependency order (tables without FK first)
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

// Data type conversions from SQLite to PostgreSQL
function convertValue(value, columnName) {
    if (value === null || value === undefined) {
        return null;
    }
    
    // Convert boolean fields
    if (columnName === 'is_active' || columnName === 'active') {
        return value === 1 ? true : false;
    }
    
    // Convert datetime fields to ISO format
    if (columnName.includes('_at') || columnName.includes('_date') || 
        columnName === 'expires' || columnName === 'timestamp') {
        if (typeof value === 'string' && value.trim() !== '') {
            // Handle various date formats
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        }
        return null;
    }
    
    return value;
}

// Create export directory
function ensureExportDir() {
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
        console.log(`✅ Created export directory: ${EXPORT_DIR}`);
    }
}

// Export single table
function exportTable(db, tableName) {
    return new Promise((resolve, reject) => {
        console.log(`📤 Exporting table: ${tableName}...`);
        
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
            if (err) {
                console.error(`❌ Error exporting ${tableName}:`, err.message);
                reject(err);
                return;
            }
            
            // Convert data for PostgreSQL compatibility
            const convertedRows = rows.map(row => {
                const converted = {};
                for (const [key, value] of Object.entries(row)) {
                    converted[key] = convertValue(value, key);
                }
                return converted;
            });
            
            // Write to JSON file
            const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(convertedRows, null, 2));
            
            console.log(`✅ ${tableName}: ${rows.length} records exported to ${filePath}`);
            resolve(rows.length);
        });
    });
}

// Get table schema
function getTableSchema(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(columns);
        });
    });
}

// Export table schemas
async function exportSchemas(db) {
    console.log(`📋 Exporting table schemas...`);
    const schemas = {};
    
    for (const tableName of TABLES_ORDER) {
        try {
            const schema = await getTableSchema(db, tableName);
            schemas[tableName] = schema;
        } catch (err) {
            console.error(`❌ Error getting schema for ${tableName}:`, err.message);
        }
    }
    
    const schemaFile = path.join(EXPORT_DIR, 'schemas.json');
    fs.writeFileSync(schemaFile, JSON.stringify(schemas, null, 2));
    console.log(`✅ Schemas exported to ${schemaFile}`);
}

// Generate export summary
function generateSummary(counts) {
    const summary = {
        export_date: new Date().toISOString(),
        total_tables: Object.keys(counts).length,
        total_records: Object.values(counts).reduce((sum, count) => sum + count, 0),
        tables: counts,
        sqlite_database: SQLITE_DB_PATH,
        export_directory: EXPORT_DIR
    };
    
    const summaryFile = path.join(EXPORT_DIR, 'export_summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    console.log(`\n📊 EXPORT SUMMARY:`);
    console.log(`- Total tables: ${summary.total_tables}`);
    console.log(`- Total records: ${summary.total_records}`);
    console.log(`- Export location: ${EXPORT_DIR}`);
    
    return summary;
}

// Main export function
async function exportAllData() {
    console.log(`🚀 Starting data export from SQLite...`);
    console.log(`📁 Source: ${SQLITE_DB_PATH}`);
    
    // Ensure export directory exists
    ensureExportDir();
    
    const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Error connecting to SQLite database:', err.message);
            process.exit(1);
        }
        console.log('✅ Connected to SQLite database');
    });
    
    const exportCounts = {};
    
    try {
        // Export table schemas first
        await exportSchemas(db);
        
        // Export data from each table
        for (const tableName of TABLES_ORDER) {
            try {
                const count = await exportTable(db, tableName);
                exportCounts[tableName] = count;
            } catch (err) {
                console.error(`❌ Failed to export ${tableName}:`, err.message);
                exportCounts[tableName] = 0;
            }
        }
        
        // Generate summary
        const summary = generateSummary(exportCounts);
        
        console.log(`\n🎉 Data export completed successfully!`);
        console.log(`📄 Check export_summary.json for details`);
        
        return summary;
        
    } catch (err) {
        console.error('❌ Export failed:', err.message);
        throw err;
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('✅ SQLite database connection closed');
            }
        });
    }
}

// Run export if script is executed directly
if (require.main === module) {
    exportAllData()
        .then(summary => {
            console.log(`\n✅ Export completed with ${summary.total_records} records`);
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Export failed:', err);
            process.exit(1);
        });
}

module.exports = { exportAllData, EXPORT_DIR }; 