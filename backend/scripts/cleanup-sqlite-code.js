const fs = require('fs');
const path = require('path');

/**
 * Script to identify and optionally remove SQLite-related code and files
 * after successful migration to Supabase
 */
class SQLiteCleanupManager {
    constructor() {
        this.backendPath = path.join(__dirname, '..');
        this.sqliteFiles = [];
        this.sqliteReferences = [];
        this.obsoleteFiles = [];
        
        // Files that should be reviewed/removed after migration
        this.targetPatterns = [
            /sqlite/i,
            /\.db$/,
            /database\.js$/,
            /sessions\.db/,
            /connect-sqlite3/,
            /SQLiteStore/
        ];
    }
    
    /**
     * Scan directory for SQLite-related files and references
     */
    scanDirectory(dirPath, relativePath = '') {
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const relativeItemPath = path.join(relativePath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Skip node_modules and .git
                    if (item === 'node_modules' || item === '.git' || item === 'fonts') {
                        continue;
                    }
                    this.scanDirectory(fullPath, relativeItemPath);
                } else if (stat.isFile()) {
                    this.analyzeFile(fullPath, relativeItemPath);
                }
            }
        } catch (error) {
            console.error(`Error scanning ${dirPath}:`, error.message);
        }
    }
    
    /**
     * Analyze individual file for SQLite references
     */
    analyzeFile(filePath, relativePath) {
        try {
            // Check filename patterns
            const fileName = path.basename(filePath);
            
            if (this.targetPatterns.some(pattern => pattern.test(fileName))) {
                this.sqliteFiles.push({
                    path: relativePath,
                    fullPath: filePath,
                    type: 'filename',
                    reason: 'Filename matches SQLite pattern'
                });
            }
            
            // Analyze file content for JavaScript/text files
            if (this.isTextFile(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                this.analyzeFileContent(content, relativePath, filePath);
            }
            
        } catch (error) {
            // Skip files that can't be read
        }
    }
    
    /**
     * Analyze file content for SQLite references
     */
    analyzeFileContent(content, relativePath, fullPath) {
        const lines = content.split('\n');
        
        const sqliteKeywords = [
            'sqlite3',
            'SQLiteStore',
            'connect-sqlite3',
            'pizza_inventory.db',
            'sessions.db',
            'new sqlite3.Database',
            'require(\'sqlite3\')',
            '.db',
            'PRAGMA',
            'sqlite_',
            'database.js'
        ];
        
        const references = [];
        
        lines.forEach((line, index) => {
            sqliteKeywords.forEach(keyword => {
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    references.push({
                        line: index + 1,
                        content: line.trim(),
                        keyword
                    });
                }
            });
        });
        
        if (references.length > 0) {
            this.sqliteReferences.push({
                path: relativePath,
                fullPath,
                references
            });
        }
    }
    
    /**
     * Check if file is a text file that should be analyzed
     */
    isTextFile(filePath) {
        const textExtensions = ['.js', '.json', '.md', '.txt', '.sql', '.env', '.log'];
        const ext = path.extname(filePath).toLowerCase();
        return textExtensions.includes(ext);
    }
    
    /**
     * Categorize files by cleanup priority
     */
    categorizeFiles() {
        const categories = {
            'High Priority - Safe to Remove': [],
            'Medium Priority - Review Required': [],
            'Low Priority - Keep for Reference': [],
            'Database Files': [],
            'Migration Scripts': []
        };
        
        // Categorize SQLite files
        this.sqliteFiles.forEach(file => {
            const fileName = path.basename(file.path);
            
            if (fileName.endsWith('.db') || fileName.endsWith('.db.backup')) {
                categories['Database Files'].push(file);
            } else if (fileName.includes('migration') || fileName.includes('test')) {
                categories['Migration Scripts'].push(file);
            } else if (fileName === 'database.js' || fileName.includes('sqlite')) {
                categories['Medium Priority - Review Required'].push(file);
            } else {
                categories['Low Priority - Keep for Reference'].push(file);
            }
        });
        
        // Categorize files with SQLite references
        this.sqliteReferences.forEach(file => {
            const fileName = path.basename(file.path);
            const hasImportantReferences = file.references.some(ref => 
                ref.keyword.includes('require') || ref.keyword.includes('import')
            );
            
            if (hasImportantReferences && !fileName.includes('test')) {
                categories['Medium Priority - Review Required'].push({
                    ...file,
                    type: 'reference',
                    reason: 'Contains SQLite code references'
                });
            } else {
                categories['Low Priority - Keep for Reference'].push({
                    ...file,
                    type: 'reference', 
                    reason: 'Contains SQLite references in comments/tests'
                });
            }
        });
        
        return categories;
    }
    
    /**
     * Generate cleanup report
     */
    generateReport() {
        console.log('🧹 SQLITE CLEANUP ANALYSIS REPORT');
        console.log('=' * 60);
        console.log(`Analysis Date: ${new Date().toISOString()}`);
        console.log(`Migration Status: Supabase Active (USE_SUPABASE=true)`);
        console.log('');
        
        const categories = this.categorizeFiles();
        
        Object.entries(categories).forEach(([category, files]) => {
            if (files.length === 0) return;
            
            console.log(`📋 ${category} (${files.length} items):`);
            console.log('-'.repeat(50));
            
            files.forEach(file => {
                console.log(`📄 ${file.path}`);
                console.log(`   Type: ${file.type || 'file'}`);
                console.log(`   Reason: ${file.reason || 'SQLite pattern match'}`);
                
                if (file.references) {
                    console.log(`   References (${file.references.length}):`);
                    file.references.slice(0, 3).forEach(ref => {
                        console.log(`     Line ${ref.line}: ${ref.content.substring(0, 60)}...`);
                    });
                    if (file.references.length > 3) {
                        console.log(`     ... and ${file.references.length - 3} more`);
                    }
                }
                console.log('');
            });
        });
        
        // Summary statistics
        const totalFiles = this.sqliteFiles.length;
        const totalReferences = this.sqliteReferences.length;
        const highPriority = categories['High Priority - Safe to Remove'].length;
        const mediumPriority = categories['Medium Priority - Review Required'].length;
        
        console.log('📊 CLEANUP SUMMARY:');
        console.log('-'.repeat(50));
        console.log(`Total SQLite files found: ${totalFiles}`);
        console.log(`Files with SQLite references: ${totalReferences}`);
        console.log(`Safe to remove: ${highPriority}`);
        console.log(`Require review: ${mediumPriority}`);
        
        // Recommendations
        console.log('\n💡 CLEANUP RECOMMENDATIONS:');
        console.log('-'.repeat(50));
        
        if (categories['Database Files'].length > 0) {
            console.log('📦 Database Files:');
            console.log('   ✅ Create backup of .db files before removal');
            console.log('   ✅ Move to /backup/ directory instead of deletion');
            categories['Database Files'].forEach(file => {
                console.log(`   • ${file.path}`);
            });
            console.log('');
        }
        
        if (categories['Medium Priority - Review Required'].length > 0) {
            console.log('⚠️ Files requiring manual review:');
            console.log('   📋 Review each file before modification');
            console.log('   🔧 Update imports and references to Supabase');
            console.log('   🧪 Test after changes');
            categories['Medium Priority - Review Required'].forEach(file => {
                console.log(`   • ${file.path}`);
            });
            console.log('');
        }
        
        if (categories['Migration Scripts'].length > 0) {
            console.log('📚 Migration Scripts:');
            console.log('   📁 Keep for historical reference');
            console.log('   📦 Move to /archive/ directory');
            console.log('');
        }
        
        console.log('🎯 NEXT STEPS:');
        console.log('-'.repeat(50));
        console.log('1. ✅ Backup important .db files');
        console.log('2. 🔧 Review and update medium priority files');
        console.log('3. 📁 Move migration scripts to archive');
        console.log('4. 🧪 Test system after cleanup');
        console.log('5. 📦 Remove or archive remaining SQLite files');
        
        console.log('\n✅ SQLite cleanup analysis completed!');
        
        return categories;
    }
    
    /**
     * Execute the cleanup analysis
     */
    run() {
        console.log('🔍 Scanning for SQLite-related code and files...\n');
        
        this.scanDirectory(this.backendPath);
        
        console.log(`📊 Scan completed:`);
        console.log(`   Files with SQLite patterns: ${this.sqliteFiles.length}`);
        console.log(`   Files with SQLite references: ${this.sqliteReferences.length}\n`);
        
        return this.generateReport();
    }
}

// Run cleanup analysis if called directly
if (require.main === module) {
    const cleanup = new SQLiteCleanupManager();
    cleanup.run();
}

module.exports = { SQLiteCleanupManager };