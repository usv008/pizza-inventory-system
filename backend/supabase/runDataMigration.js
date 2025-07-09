const { exportAllData } = require('./exportData');
const { importAllData } = require('./importData');
const { validateAllData } = require('./validateData');
const fs = require('fs');
const path = require('path');

// Configuration
const PHASE3_LOG_FILE = path.join(__dirname, 'phase3_migration_log.json');

// Migration statistics
let migrationStats = {
    phase: 'Phase 3: Data Migration',
    start_time: new Date().toISOString(),
    steps: {
        export: { status: 'pending', start_time: null, end_time: null, results: null },
        import: { status: 'pending', start_time: null, end_time: null, results: null },
        validation: { status: 'pending', start_time: null, end_time: null, results: null }
    },
    overall_status: 'in_progress',
    error: null
};

// Log function
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    console.log(logMessage);
}

// Save migration progress
function saveMigrationLog() {
    fs.writeFileSync(PHASE3_LOG_FILE, JSON.stringify(migrationStats, null, 2));
}

// Step 1: Export data from SQLite
async function runExportStep() {
    log('🚀 Step 1: Exporting data from SQLite...');
    migrationStats.steps.export.status = 'running';
    migrationStats.steps.export.start_time = new Date().toISOString();
    saveMigrationLog();
    
    try {
        const exportResults = await exportAllData();
        
        migrationStats.steps.export.status = 'completed';
        migrationStats.steps.export.end_time = new Date().toISOString();
        migrationStats.steps.export.results = exportResults;
        
        log(`✅ Step 1 completed: Exported ${exportResults.total_records} records from ${exportResults.total_tables} tables`);
        return exportResults;
        
    } catch (error) {
        migrationStats.steps.export.status = 'failed';
        migrationStats.steps.export.end_time = new Date().toISOString();
        migrationStats.steps.export.error = error.message;
        
        log(`❌ Step 1 failed: ${error.message}`, 'error');
        throw error;
    } finally {
        saveMigrationLog();
    }
}

// Step 2: Import data to Supabase
async function runImportStep() {
    log('🚀 Step 2: Importing data to Supabase...');
    migrationStats.steps.import.status = 'running';
    migrationStats.steps.import.start_time = new Date().toISOString();
    saveMigrationLog();
    
    try {
        const importResults = await importAllData();
        
        migrationStats.steps.import.status = 'completed';
        migrationStats.steps.import.end_time = new Date().toISOString();
        migrationStats.steps.import.results = importResults;
        
        const successRate = Math.round((importResults.total_success / importResults.total_records) * 100);
        log(`✅ Step 2 completed: Imported ${importResults.total_success}/${importResults.total_records} records (${successRate}% success rate)`);
        
        if (importResults.total_errors > 0) {
            log(`⚠️ ${importResults.total_errors} import errors occurred. Check import_log.json for details.`, 'warn');
        }
        
        return importResults;
        
    } catch (error) {
        migrationStats.steps.import.status = 'failed';
        migrationStats.steps.import.end_time = new Date().toISOString();
        migrationStats.steps.import.error = error.message;
        
        log(`❌ Step 2 failed: ${error.message}`, 'error');
        throw error;
    } finally {
        saveMigrationLog();
    }
}

// Step 3: Validate data integrity
async function runValidationStep() {
    log('🚀 Step 3: Validating data integrity...');
    migrationStats.steps.validation.status = 'running';
    migrationStats.steps.validation.start_time = new Date().toISOString();
    saveMigrationLog();
    
    try {
        const validationResults = await validateAllData();
        
        migrationStats.steps.validation.status = 'completed';
        migrationStats.steps.validation.end_time = new Date().toISOString();
        migrationStats.steps.validation.results = validationResults;
        
        const successRate = Math.round((validationResults.summary.perfect_matches / validationResults.summary.total_tables) * 100);
        log(`✅ Step 3 completed: ${validationResults.summary.perfect_matches}/${validationResults.summary.total_tables} tables validated perfectly (${successRate}% success rate)`);
        
        if (validationResults.summary.count_mismatches > 0 || validationResults.summary.data_discrepancies > 0) {
            log(`⚠️ Some validation issues found. Check validation_log.json for details.`, 'warn');
        }
        
        return validationResults;
        
    } catch (error) {
        migrationStats.steps.validation.status = 'failed';
        migrationStats.steps.validation.end_time = new Date().toISOString();
        migrationStats.steps.validation.error = error.message;
        
        log(`❌ Step 3 failed: ${error.message}`, 'error');
        throw error;
    } finally {
        saveMigrationLog();
    }
}

// Generate final migration report
function generateMigrationReport() {
    migrationStats.end_time = new Date().toISOString();
    migrationStats.duration_minutes = Math.round(
        (new Date(migrationStats.end_time) - new Date(migrationStats.start_time)) / 1000 / 60 * 100
    ) / 100;
    
    // Determine overall status
    const completedSteps = Object.values(migrationStats.steps).filter(step => step.status === 'completed').length;
    const failedSteps = Object.values(migrationStats.steps).filter(step => step.status === 'failed').length;
    
    if (failedSteps > 0) {
        migrationStats.overall_status = 'failed';
    } else if (completedSteps === 3) {
        migrationStats.overall_status = 'completed';
    } else {
        migrationStats.overall_status = 'partial';
    }
    
    saveMigrationLog();
    
    // Display final report
    log('\n' + '='.repeat(60));
    log('📊 PHASE 3 DATA MIGRATION FINAL REPORT');
    log('='.repeat(60));
    log(`⏱️  Duration: ${migrationStats.duration_minutes} minutes`);
    log(`📈 Overall Status: ${migrationStats.overall_status.toUpperCase()}`);
    log('');
    
    // Export step summary
    const exportStep = migrationStats.steps.export;
    if (exportStep.results) {
        log(`📤 EXPORT: ✅ ${exportStep.results.total_records} records from ${exportStep.results.total_tables} tables`);
    } else if (exportStep.status === 'failed') {
        log(`📤 EXPORT: ❌ Failed - ${exportStep.error}`);
    }
    
    // Import step summary
    const importStep = migrationStats.steps.import;
    if (importStep.results) {
        const importSuccessRate = Math.round((importStep.results.total_success / importStep.results.total_records) * 100);
        log(`📥 IMPORT: ${importStep.results.total_errors > 0 ? '⚠️' : '✅'} ${importStep.results.total_success}/${importStep.results.total_records} records (${importSuccessRate}%)`);
    } else if (importStep.status === 'failed') {
        log(`📥 IMPORT: ❌ Failed - ${importStep.error}`);
    }
    
    // Validation step summary
    const validationStep = migrationStats.steps.validation;
    if (validationStep.results) {
        const validationSuccessRate = Math.round((validationStep.results.summary.perfect_matches / validationStep.results.summary.total_tables) * 100);
        const hasIssues = validationStep.results.summary.count_mismatches > 0 || validationStep.results.summary.data_discrepancies > 0;
        log(`🔍 VALIDATION: ${hasIssues ? '⚠️' : '✅'} ${validationStep.results.summary.perfect_matches}/${validationStep.results.summary.total_tables} tables (${validationSuccessRate}%)`);
    } else if (validationStep.status === 'failed') {
        log(`🔍 VALIDATION: ❌ Failed - ${validationStep.error}`);
    }
    
    log('');
    log('📄 Detailed logs available:');
    log(`   - Phase 3 summary: ${PHASE3_LOG_FILE}`);
    log(`   - Export details: backend/supabase/exports/export_summary.json`);
    log(`   - Import details: backend/supabase/import_log.json`);
    log(`   - Validation details: backend/supabase/validation_log.json`);
    log('='.repeat(60));
    
    return migrationStats;
}

// Main migration function
async function runPhase3Migration() {
    log('🚀 Starting Phase 3: Data Migration');
    log('This process will export SQLite data, import to Supabase, and validate integrity');
    log('');
    
    try {
        // Step 1: Export data from SQLite
        await runExportStep();
        
        // Step 2: Import data to Supabase
        await runImportStep();
        
        // Step 3: Validate data integrity
        await runValidationStep();
        
        // Generate final report
        const finalReport = generateMigrationReport();
        
        log('\n🎉 Phase 3 Data Migration completed successfully!');
        
        return finalReport;
        
    } catch (error) {
        migrationStats.overall_status = 'failed';
        migrationStats.error = error.message;
        migrationStats.end_time = new Date().toISOString();
        
        log(`❌ Phase 3 Migration failed: ${error.message}`, 'error');
        
        generateMigrationReport();
        throw error;
    }
}

// Run migration if script is executed directly
if (require.main === module) {
    runPhase3Migration()
        .then(report => {
            if (report.overall_status === 'completed') {
                log(`\n✅ Phase 3 completed successfully in ${report.duration_minutes} minutes`);
                process.exit(0);
            } else {
                log(`\n⚠️ Phase 3 completed with issues. Check logs for details.`);
                process.exit(1);
            }
        })
        .catch(err => {
            log(`❌ Phase 3 failed: ${err.message}`, 'error');
            process.exit(1);
        });
}

module.exports = { runPhase3Migration, migrationStats }; 