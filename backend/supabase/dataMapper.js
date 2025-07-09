// Data mapping functions to convert SQLite data to Supabase schema format

// Products mapping: SQLite → Supabase
function mapProducts(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        name: item.name,
        category: 'general', // додаємо дефолтну категорію
        unit: 'pieces', // додаємо дефолтну одиницю
        cost_per_unit: 0, // SQLite не має цього поля
        selling_price: 0, // SQLite не має цього поля
        current_stock: item.stock_pieces || 0, // stock_pieces → current_stock
        min_stock_level: item.min_stock_pieces || 0, // min_stock_pieces → min_stock_level
        max_stock_level: null, // SQLite не має цього поля
        supplier: null, // SQLite не має постачальника
        description: `Product code: ${item.code}, Weight: ${item.weight}`, // додаємо опис з code та weight
        is_active: true,
        created_at: item.created_at,
        updated_at: item.updated_at
    }));
}

// Clients mapping: SQLite → Supabase (структура схожа)
function mapClients(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        name: item.name,
        contact_person: item.contact_person,
        phone: item.phone,
        email: item.email,
        address: item.address,
        notes: item.notes,
        is_active: item.is_active === 1 ? true : false,
        created_at: item.created_at,
        updated_at: item.updated_at
    }));
}

// Orders mapping: SQLite → Supabase
function mapOrders(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        order_number: item.order_number,
        client_id: item.client_id,
        status: mapOrderStatus(item.status),
        total_amount: 0, // SQLite не має цього поля
        notes: item.notes,
        created_by: item.created_by_user_id,
        created_at: item.created_at,
        updated_at: item.updated_at
    }));
}

// Map order status from SQLite to Supabase
function mapOrderStatus(sqliteStatus) {
    const statusMap = {
        'NEW': 'pending',
        'CONFIRMED': 'in_progress',
        'IN_PRODUCTION': 'in_progress',
        'READY': 'completed',
        'SHIPPED': 'completed',
        'COMPLETED': 'completed'
    };
    return statusMap[sqliteStatus] || 'pending';
}

// Order items mapping: SQLite → Supabase
function mapOrderItems(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: 0, // SQLite не має цього поля
        total_price: 0, // SQLite не має цього поля
        notes: item.notes
    }));
}

// Production mapping: SQLite → Supabase
function mapProduction(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity_produced: item.total_quantity || item.pieces_quantity || 0,
        production_cost: 0, // SQLite не має цього поля
        batch_number: `BATCH-${item.id}`, // генеруємо номер партії
        quality_status: 'good', // дефолтний статус
        plan_id: null, // SQLite не має планів виробництва
        produced_by: item.created_by_user_id,
        notes: item.notes,
        production_date: item.production_date,
        created_at: item.created_at
    }));
}

// Production batches mapping: SQLite → Supabase
function mapProductionBatches(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        batch_number: `BATCH-${item.product_id}-${item.batch_date}`,
        product_id: item.product_id,
        quantity: item.total_quantity,
        production_date: item.batch_date,
        expiry_date: item.expiry_date,
        status: item.status === 'ACTIVE' ? 'active' : 'expired',
        notes: item.notes,
        created_at: item.created_at
    }));
}

// Stock movements mapping: SQLite → Supabase
function mapStockMovements(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        product_id: item.product_id,
        movement_type: item.movement_type.toLowerCase(), // IN/OUT → in/out
        quantity: item.pieces,
        reason: item.reason,
        user_id: item.created_by_user_id,
        reference_type: 'manual', // дефолтний тип
        reference_id: null,
        created_at: item.created_at
    }));
}

// Writeoffs mapping: SQLite → Supabase
function mapWriteoffs(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.total_quantity || item.pieces_quantity || 0,
        reason: item.reason,
        cost_impact: 0, // SQLite не має цього поля
        approved_by: item.created_by_user_id,
        notes: item.notes,
        writeoff_date: item.writeoff_date,
        created_at: item.created_at
    }));
}

// Arrivals mapping: SQLite → Supabase
function mapArrivals(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        arrival_number: item.arrival_number,
        supplier: 'Unknown', // SQLite не має постачальника
        arrival_date: item.arrival_date,
        total_cost: 0, // SQLite не має цього поля
        status: 'received', // дефолтний статус
        notes: null,
        received_by: item.created_by_user_id,
        created_at: item.created_at,
        updated_at: item.updated_at
    }));
}

// Arrival items mapping: arrivals_items → arrival_items
function mapArrivalItems(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        arrival_id: item.arrival_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: 0, // SQLite не має цього поля
        total_cost: 0, // SQLite не має цього поля
        notes: item.notes
    }));
}

// Production plans mapping (SQLite має мало даних)
function mapProductionPlans(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        plan_name: `Plan ${item.plan_date}`,
        status: item.status === 'DRAFT' ? 'draft' : 'active',
        start_date: item.plan_date,
        end_date: item.plan_date, // той же день
        notes: item.notes,
        created_by: item.created_by_user_id,
        created_at: item.created_at,
        updated_at: item.updated_at
    }));
}

// Production plan items mapping
function mapProductionPlanItems(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        plan_id: item.plan_id,
        product_id: item.product_id,
        planned_quantity: item.quantity_planned,
        produced_quantity: item.quantity_produced || 0,
        notes: item.notes
    }));
}

// Operations log mapping
function mapOperationsLog(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        operation_type: item.operation_type,
        operation_description: item.description || 'No description',
        user_id: item.user_id,
        affected_table: item.entity_type,
        affected_record_id: item.entity_id,
        status: 'success', // дефолтний статус
        details: item.new_data ? JSON.parse(item.new_data) : null,
        ip_address: item.ip_address,
        created_at: item.created_at
    }));
}

// User audit mapping
function mapUserAudit(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        user_id: item.user_id,
        action: item.action,
        table_name: item.table_name,
        record_id: item.record_id,
        old_values: item.old_values ? JSON.parse(item.old_values) : null,
        new_values: item.new_values ? JSON.parse(item.new_values) : null,
        ip_address: item.ip_address,
        user_agent: item.user_agent,
        created_at: item.created_at
    }));
}

// Security events mapping
function mapSecurityEvents(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        event_type: item.event_type,
        user_id: item.user_id,
        ip_address: item.ip_address,
        user_agent: item.user_agent,
        details: item.details ? JSON.parse(item.details) : null,
        severity: item.severity || 'info',
        created_at: item.timestamp || item.created_at
    }));
}

// Production settings mapping
function mapProductionSettings(sqliteData) {
    return sqliteData.map(item => ({
        id: item.id,
        setting_name: 'default_settings',
        setting_value: JSON.stringify({
            daily_capacity: item.daily_capacity,
            working_hours: item.working_hours,
            min_batch_size: item.min_batch_size,
            cost_per_unit: item.cost_per_unit
        }),
        description: 'Migrated from SQLite',
        created_at: item.updated_at,
        updated_at: item.updated_at
    }));
}

// Main mapping function
function mapTableData(tableName, sqliteData) {
    switch (tableName) {
        case 'products':
            return mapProducts(sqliteData);
        case 'clients':
            return mapClients(sqliteData);
        case 'orders':
            return mapOrders(sqliteData);
        case 'order_items':
            return mapOrderItems(sqliteData);
        case 'production':
            return mapProduction(sqliteData);
        case 'production_batches':
            return mapProductionBatches(sqliteData);
        case 'stock_movements':
            return mapStockMovements(sqliteData);
        case 'writeoffs':
            return mapWriteoffs(sqliteData);
        case 'arrivals':
            return mapArrivals(sqliteData);
        case 'arrivals_items':
            return mapArrivalItems(sqliteData);
        case 'production_plans':
            return mapProductionPlans(sqliteData);
        case 'production_plan_items':
            return mapProductionPlanItems(sqliteData);
        case 'operations_log':
            return mapOperationsLog(sqliteData);
        case 'user_audit':
            return mapUserAudit(sqliteData);
        case 'security_events':
            return mapSecurityEvents(sqliteData);
        case 'production_settings':
            return mapProductionSettings(sqliteData);
        default:
            console.warn(`No mapping function for table: ${tableName}`);
            return sqliteData; // повертаємо без змін
    }
}

module.exports = {
    mapTableData,
    mapProducts,
    mapClients,
    mapOrders,
    mapOrderItems,
    mapProduction,
    mapProductionBatches,
    mapStockMovements,
    mapWriteoffs,
    mapArrivals,
    mapArrivalItems,
    mapProductionPlans,
    mapProductionPlanItems,
    mapOperationsLog,
    mapUserAudit,
    mapSecurityEvents,
    mapProductionSettings
}; 