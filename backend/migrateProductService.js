/**
 * Migration Script: Product Service to Hybrid
 * Цей скрипт оновлює app-new.js для використання Hybrid Product Service
 */

const fs = require('fs').promises;
const path = require('path');

async function migrateToHybridProductService() {
    console.log('🚀 Розпочинаю міграцію Product Service до Hybrid режиму...');

    try {
        // 1. Читаємо поточний app-new.js
        const appPath = path.join(__dirname, 'app-new.js');
        let appContent = await fs.readFile(appPath, 'utf8');

        // 2. Додаємо імпорти для hybrid service
        const hybridImports = `
// Hybrid Product Service Migration - Phase 4
const legacyProductService = require('./services/productService');
const supabaseProductService = require('./services/supabaseProductService');
const hybridProductService = require('./services/hybridProductService');`;

        // Знаходимо секцію з імпортами сервісів і додаємо hybrid імпорти
        const serviceImportPattern = /(const productService = require\('\.\/services\/productService'\);)/;
        if (serviceImportPattern.test(appContent)) {
            appContent = appContent.replace(serviceImportPattern, `$1${hybridImports}`);
        } else {
            // Якщо не знайшли існуючий імпорт, додаємо після секції з сервісами
            const servicesSection = /\/\/ .*SERVICES.*\n/;
            appContent = appContent.replace(servicesSection, `$&${hybridImports}\n`);
        }

        // 3. Оновлюємо ініціалізацію сервісів
        const originalInitialization = `        // Ініціалізуємо сервіси з залежностями
        productService.initialize({
            productQueries,
            OperationsLogController
        });`;

        const hybridInitialization = `        // Ініціалізуємо сервіси з залежностями
        // Phase 4 Migration: Hybrid Product Service
        hybridProductService.initialize({
            legacyProductService,
            supabaseProductService,
            productQueries,
            OperationsLogController
        });
        
        // Legacy initialization (kept for fallback)
        productService.initialize({
            productQueries,
            OperationsLogController
        });`;

        appContent = appContent.replace(originalInitialization, hybridInitialization);

        // 4. Створюємо backup
        const backupPath = path.join(__dirname, 'app-new.js.backup');
        await fs.writeFile(backupPath, appContent);
        console.log(`✅ Backup створено: ${backupPath}`);

        // 5. Записуємо оновлений файл
        await fs.writeFile(appPath, appContent);
        console.log('✅ app-new.js оновлено для Hybrid Product Service');

        // 6. Створюємо migration config файл
        await createMigrationConfig();

        console.log('🎉 Міграція завершена успішно!');
        console.log('\n📋 Наступні кроки:');
        console.log('1. Перезапустити backend сервер');
        console.log('2. Протестувати роботу через API');
        console.log('3. Налаштувати змінні середовища для поступової міграції');
        console.log('4. Моніторити логи hybrid операцій');

    } catch (error) {
        console.error('❌ Помилка під час міграції:', error);
        throw error;
    }
}

async function createMigrationConfig() {
    const configPath = path.join(__dirname, '.env.migration');
    const configContent = `# Phase 4 Migration Configuration
# Hybrid Product Service Settings

# Read operations from Supabase (false = use SQLite)
USE_SUPABASE_READ=false

# Write operations to Supabase (false = use SQLite)  
USE_SUPABASE_WRITE=false

# Fallback to legacy SQLite if Supabase fails (true = enable fallback)
FALLBACK_TO_LEGACY=true

# Log hybrid operations for monitoring (true = enable logging)
LOG_HYBRID_OPERATIONS=true

# Supabase connection (required for hybrid mode)
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Migration phases:
# Phase 1: USE_SUPABASE_READ=false, USE_SUPABASE_WRITE=false (SQLite only)
# Phase 2: USE_SUPABASE_READ=true, USE_SUPABASE_WRITE=false (Read from Supabase, Write to SQLite)
# Phase 3: USE_SUPABASE_READ=true, USE_SUPABASE_WRITE=true (Full Supabase with fallback)
# Phase 4: FALLBACK_TO_LEGACY=false (Supabase only)
`;

    await fs.writeFile(configPath, configContent);
    console.log(`✅ Migration config створено: ${configPath}`);
}

async function createTestScript() {
    const testPath = path.join(__dirname, 'testHybridService.js');
    const testContent = `/**
 * Test Script for Hybrid Product Service
 * Тестування hybrid сервісу і migration фаз
 */

const hybridProductService = require('./services/hybridProductService');
const legacyProductService = require('./services/productService');
const supabaseProductService = require('./services/supabaseProductService');

async function runHybridTests() {
    console.log('🧪 Запуск тестів Hybrid Product Service...');
    
    try {
        // Initialize services
        hybridProductService.initialize({
            legacyProductService,
            supabaseProductService
        });
        
        // Test connectivity
        console.log('\\n1. Testing connectivity...');
        const connectivity = await hybridProductService.testConnectivity();
        console.log('Connectivity results:', connectivity);
        
        // Test migration status
        console.log('\\n2. Migration status...');
        const status = hybridProductService.getMigrationStatus();
        console.log('Migration status:', status);
        
        // Test basic operations
        console.log('\\n3. Testing getAllProducts...');
        const products = await hybridProductService.getAllProducts();
        console.log(\`Found \${products.length} products\`);
        
        if (products.length > 0) {
            console.log('\\n4. Testing getProductById...');
            const product = await hybridProductService.getProductById(products[0].id);
            console.log('Product details:', product?.name);
        }
        
        console.log('\\n✅ Всі тести пройшли успішно!');
        
    } catch (error) {
        console.error('❌ Помилка в тестах:', error);
    }
}

// Run tests if called directly
if (require.main === module) {
    runHybridTests();
}

module.exports = { runHybridTests };
`;

    await fs.writeFile(testPath, testContent);
    console.log(`✅ Test script створено: ${testPath}`);
}

async function rollbackMigration() {
    console.log('🔄 Відкочую міграцію...');
    
    try {
        const appPath = path.join(__dirname, 'app-new.js');
        const backupPath = path.join(__dirname, 'app-new.js.backup');
        
        // Перевіряємо чи є backup
        try {
            await fs.access(backupPath);
            const backupContent = await fs.readFile(backupPath, 'utf8');
            await fs.writeFile(appPath, backupContent);
            console.log('✅ Міграцію успішно відкочено');
        } catch (error) {
            console.error('❌ Backup файл не знайдено:', error);
        }
        
    } catch (error) {
        console.error('❌ Помилка під час rollback:', error);
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'migrate':
            migrateToHybridProductService();
            break;
        case 'rollback':
            rollbackMigration();
            break;
        case 'test':
            createTestScript().then(() => {
                require('./testHybridService').runHybridTests();
            });
            break;
        case 'config':
            createMigrationConfig();
            break;
        default:
            console.log('Usage: node migrateProductService.js [migrate|rollback|test|config]');
    }
}

module.exports = {
    migrateToHybridProductService,
    rollbackMigration,
    createMigrationConfig,
    createTestScript
}; 