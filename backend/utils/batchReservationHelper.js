// utils/batchReservationHelper.js - Helper for batch reservation in orders

/**
 * Helper utility for managing batch reservations in orders
 * Provides FIFO (First In, First Out) batch allocation logic
 */
class BatchReservationHelper {
    
    /**
     * Reserve batches for order items using FIFO logic
     * @param {Array} orderItems - Array of order items {product_id, quantity}
     * @param {Object} batchQueries - Batch queries interface
     * @returns {Object} Reservation result with details
     */
    static async reserveBatchesForOrder(orderItems, batchQueries) {
        try {
            const reservations = [];
            const warnings = [];
            let totalReserved = 0;
            let totalRequested = 0;
            
            for (const item of orderItems) {
                const { product_id, quantity, pieces } = item;
                const requestedQuantity = pieces || quantity || 0;
                totalRequested += requestedQuantity;
                
                if (requestedQuantity <= 0) {
                    warnings.push(`Товар ${product_id}: кількість 0, пропущено`);
                    continue;
                }
                
                // Отримуємо доступні партії для товару (сортовані по даті виробництва)
                const availableBatches = await batchQueries.getByProductId(product_id);
                const validBatches = availableBatches
                    .filter(batch => batch.available_quantity > 0 && batch.status === 'ACTIVE')
                    .sort((a, b) => new Date(a.production_date) - new Date(b.production_date)); // FIFO
                
                if (validBatches.length === 0) {
                    warnings.push(`Товар ${product_id}: немає доступних партій`);
                    continue;
                }
                
                // Резервуємо по FIFO принципу
                let remaining = requestedQuantity;
                const productReservations = [];
                
                for (const batch of validBatches) {
                    if (remaining <= 0) break;
                    
                    const canReserve = Math.min(remaining, batch.available_quantity);
                    
                    if (canReserve > 0) {
                        productReservations.push({
                            batch_id: batch.id,
                            production_id: batch.production_id,
                            batch_date: batch.batch_date,
                            expiry_date: batch.expiry_date,
                            reserved_quantity: canReserve,
                            available_before: batch.available_quantity,
                            available_after: batch.available_quantity - canReserve
                        });
                        
                        totalReserved += canReserve;
                        remaining -= canReserve;
                    }
                }
                
                if (remaining > 0) {
                    warnings.push(`Товар ${product_id}: недостатньо партій (не вистачає ${remaining} шт)`);
                }
                
                if (productReservations.length > 0) {
                    reservations.push({
                        product_id: product_id,
                        requested_quantity: requestedQuantity,
                        reserved_quantity: requestedQuantity - remaining,
                        shortage: remaining,
                        batches: productReservations
                    });
                }
            }
            
            return {
                success: true,
                reservations: reservations,
                warnings: warnings,
                summary: {
                    total_requested: totalRequested,
                    total_reserved: totalReserved,
                    shortage: totalRequested - totalReserved,
                    products_count: orderItems.length,
                    batches_allocated: reservations.reduce((sum, r) => sum + r.batches.length, 0)
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                reservations: [],
                warnings: [`Помилка резервування: ${error.message}`]
            };
        }
    }
    
    /**
     * Calculate available quantities for products from batches
     * @param {Array} productIds - Array of product IDs to check
     * @param {Object} batchQueries - Batch queries interface  
     * @returns {Object} Availability information per product
     */
    static async getProductAvailability(productIds, batchQueries) {
        try {
            const availability = {};
            
            for (const productId of productIds) {
                const batches = await batchQueries.getByProductId(productId);
                const activeBatches = batches.filter(b => b.status === 'ACTIVE');
                
                const totalAvailable = activeBatches.reduce((sum, b) => sum + (b.available_quantity || 0), 0);
                const totalStock = activeBatches.reduce((sum, b) => sum + (b.total_quantity || 0), 0);
                const totalReserved = activeBatches.reduce((sum, b) => sum + (b.reserved_quantity || 0), 0);
                
                availability[productId] = {
                    total_stock: totalStock,
                    available_quantity: totalAvailable,
                    reserved_quantity: totalReserved,
                    batches_count: activeBatches.length,
                    expiring_soon: activeBatches.filter(b => {
                        const expiryDate = new Date(b.expiry_date);
                        const weekFromNow = new Date();
                        weekFromNow.setDate(weekFromNow.getDate() + 7);
                        return expiryDate <= weekFromNow;
                    }).length
                };
            }
            
            return availability;
        } catch (error) {
            console.error('❌ Error calculating availability:', error);
            return {};
        }
    }
    
    /**
     * Format reservation details for logging
     * @param {Object} reservationResult - Result from reserveBatchesForOrder
     * @returns {Object} Formatted details for logging
     */
    static formatReservationForLog(reservationResult) {
        if (!reservationResult.success) {
            return {
                success: false,
                error: reservationResult.error,
                reservations_count: 0
            };
        }
        
        return {
            success: true,
            total_requested: reservationResult.summary.total_requested,
            total_reserved: reservationResult.summary.total_reserved,
            shortage: reservationResult.summary.shortage,
            products_count: reservationResult.summary.products_count,
            batches_allocated: reservationResult.summary.batches_allocated,
            warnings_count: reservationResult.warnings.length,
            reservations: reservationResult.reservations.map(r => ({
                product_id: r.product_id,
                reserved: r.reserved_quantity,
                requested: r.requested_quantity,
                batches_used: r.batches.length
            }))
        };
    }
}

module.exports = BatchReservationHelper; 