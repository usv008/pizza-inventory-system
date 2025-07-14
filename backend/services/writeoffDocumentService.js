/**
 * Writeoff Document Service
 * Business logic for group writeoff functionality
 * 
 * Handles:
 * - Document validation
 * - Multi-item document creation
 * - Stock updates
 * - Batch management (FIFO)
 * - Integration with movement tracking
 */

const { writeoffDocumentQueries, productQueries, batchQueries, movementsQueries } = require('../supabase-database');
const { supabase } = require('../supabase-client');

class WriteoffDocumentService {
    constructor() {
        this.name = 'WriteoffDocumentService';
    }

    /**
     * Get all writeoff documents (hybrid: new + legacy)
     */
    async getAllDocuments() {
        try {
            console.log(`[${this.name}] Getting all writeoff documents...`);
            
            const documents = await writeoffDocumentQueries.getAllHybrid();
            
            console.log(`[${this.name}] Retrieved ${documents.length} documents`);
            return {
                success: true,
                data: documents
            };
        } catch (error) {
            console.error(`[${this.name}] Error getting documents:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get document by ID
     */
    async getDocumentById(id) {
        try {
            console.log(`[${this.name}] Getting document by ID: ${id}`);
            
            const document = await writeoffDocumentQueries.getById(id);
            
            return {
                success: true,
                data: document
            };
        } catch (error) {
            console.error(`[${this.name}] Error getting document ${id}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate document data before creation
     */
    async validateDocumentData(documentData, items) {
        const errors = [];

        // Validate document header
        if (!documentData.writeoff_date) {
            errors.push('Дата списання обов\'язкова');
        }
        
        if (!documentData.reason || documentData.reason.trim().length < 3) {
            errors.push('Причина списання обов\'язкова (мінімум 3 символи)');
        }
        
        if (!documentData.responsible || documentData.responsible.trim().length < 2) {
            errors.push('Відповідальна особа обов\'язкова');
        }

        // Validate items
        if (!items || items.length === 0) {
            errors.push('Документ повинен містити хоча б одну позицію');
        }

        for (const [index, item] of items.entries()) {
            if (!item.product_id) {
                errors.push(`Позиція ${index + 1}: товар не вибраний`);
            }
            
            if (!item.quantity || item.quantity <= 0) {
                errors.push(`Позиція ${index + 1}: кількість повинна бути більше 0`);
            }

            // Check product exists and has sufficient stock
            if (item.product_id) {
                try {
                    const product = await productQueries.getById(item.product_id);
                    if (!product) {
                        errors.push(`Позиція ${index + 1}: товар не знайдений`);
                    } else if (product.current_stock < item.quantity) {
                        errors.push(`Позиція ${index + 1}: недостатньо товару на складі (доступно: ${product.current_stock})`);
                    }
                } catch (error) {
                    errors.push(`Позиція ${index + 1}: помилка перевірки товару`);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate batch availability for writeoff (simplified version)
     */
    async validateBatchAvailability(batchId, quantity) {
        try {
            // For now, we'll accept any batch_id as valid
            // In a real implementation, this would check actual batch availability
            console.log(`[${this.name}] Validating batch ${batchId} for quantity ${quantity}`);
            
            return {
                isValid: true,
                batchDate: new Date().toISOString().split('T')[0], // Use current date as fallback
                availableQuantity: quantity // Assume sufficient quantity
            };
        } catch (error) {
            console.error(`[${this.name}] Error validating batch ${batchId}:`, error);
            return {
                isValid: false,
                error: `Помилка перевірки партії: ${error.message}`
            };
        }
    }

    /**
     * Select batch for writeoff using FIFO principle (simplified fallback)
     */
    async selectBatchForWriteoff(productId, quantity) {
        try {
            // Simplified version - just return current date as batch
            console.log(`[${this.name}] Using fallback batch selection for product ${productId}`);
            
            return {
                batch_date: new Date().toISOString().split('T')[0],
                available_quantity: quantity
            };
        } catch (error) {
            console.error(`[${this.name}] Error selecting batch for product ${productId}:`, error);
            return null;
        }
    }

    /**
     * Create writeoff document with multiple items (simplified)
     */
    async createDocument(documentData, items) {
        try {
            console.log(`[${this.name}] Creating writeoff document (simplified version)...`);

            // Simple validation
            if (!documentData.writeoff_date || !documentData.responsible || !documentData.reason) {
                return {
                    success: false,
                    error: 'Заповніть всі обов\'язкові поля'
                };
            }

            if (!items || items.length === 0) {
                return {
                    success: false,
                    error: 'Додайте хоча б одну позицію'
                };
            }

            // Prepare items with default batch_date if not provided
            const preparedItems = items.map(item => ({
                ...item,
                batch_date: item.batch_date || new Date().toISOString().split('T')[0]
            }));

            // Create document only (no stock updates for now)
            const document = await writeoffDocumentQueries.create(documentData, preparedItems);

            console.log(`[${this.name}] Document created successfully: ${document.document_number}`);

            return {
                success: true,
                data: document,
                message: `Документ списання ${document.document_number} створено успішно`
            };

        } catch (error) {
            console.error(`[${this.name}] Error creating document:`, error);
            return {
                success: false,
                error: 'Помилка створення документу',
                details: error.message
            };
        }
    }

    /**
     * Update batch stock after writeoff (simplified version)
     */
    async updateBatchStock(batchId, quantity) {
        try {
            // For now, we'll just log the batch update
            // In a real implementation, this would update actual batch quantities
            console.log(`[${this.name}] Would update batch ${batchId} stock by -${quantity}`);
            
        } catch (error) {
            console.error(`[${this.name}] Error updating batch stock:`, error);
            // Don't throw error - this is not critical for basic functionality
        }
    }

    /**
     * Update product stock after writeoff (simplified)
     */
    async updateProductStock(productId, quantity) {
        try {
            const product = await productQueries.getById(productId);
            if (!product) {
                throw new Error(`Product ${productId} not found`);
            }

            const newStock = Math.max(0, product.current_stock - quantity);
            
            // Update stock directly without creating additional movement
            const { error } = await supabase.from('products')
                .update({ stock_pieces: newStock })
                .eq('id', productId);
                
            if (error) {
                throw new Error(`Error updating product stock: ${error.message}`);
            }
            
            console.log(`[${this.name}] Updated stock for product ${productId}: ${product.current_stock} -> ${newStock}`);
            
        } catch (error) {
            console.error(`[${this.name}] Error updating stock for product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Create stock movement record
     */
    async createStockMovement(documentId, item) {
        try {
            const movement = {
                product_id: item.product_id,
                movement_type: 'writeoff',
                pieces: item.quantity, // Required field
                boxes: 0, // Default to 0 boxes
                quantity: -item.quantity, // Negative for writeoff
                reason: 'Списання по документу',
                user: 'system',
                batch_id: item.batch_id || null,
                batch_date: item.batch_date || null,
                reference_type: 'writeoff_document',
                reference_id: documentId,
                notes: `Списання по документу ${documentId}`,
                created_at: new Date().toISOString()
            };

            await movementsQueries.create(movement);
            
            console.log(`[${this.name}] Created stock movement for product ${item.product_id}`);
            
        } catch (error) {
            console.error(`[${this.name}] Error creating stock movement:`, error);
            // Don't throw - movement tracking is not critical
        }
    }

    /**
     * Generate preview of document number
     */
    async previewDocumentNumber(date) {
        try {
            const documentNumber = await writeoffDocumentQueries.generateDocumentNumber(date);
            
            return {
                success: true,
                data: documentNumber
            };
        } catch (error) {
            console.error(`[${this.name}] Error generating document number:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get writeoff statistics
     */
    async getStatistics(startDate, endDate) {
        try {
            console.log(`[${this.name}] Getting statistics for ${startDate} to ${endDate}`);
            
            const documents = await writeoffDocumentQueries.getAllHybrid();
            
            // Filter by date range if provided
            let filteredDocuments = documents;
            if (startDate || endDate) {
                filteredDocuments = documents.filter(doc => {
                    const docDate = new Date(doc.writeoff_date);
                    if (startDate && docDate < new Date(startDate)) return false;
                    if (endDate && docDate > new Date(endDate)) return false;
                    return true;
                });
            }

            // Calculate statistics
            const stats = {
                total_documents: filteredDocuments.length,
                total_items: filteredDocuments.reduce((sum, doc) => sum + doc.writeoff_items.length, 0),
                total_quantity: filteredDocuments.reduce((sum, doc) => {
                    return sum + doc.writeoff_items.reduce((itemSum, item) => itemSum + item.quantity, 0);
                }, 0),
                by_reason: {},
                by_responsible: {},
                legacy_count: filteredDocuments.filter(doc => doc.is_legacy).length,
                new_count: filteredDocuments.filter(doc => !doc.is_legacy).length
            };

            // Group by reason and responsible
            filteredDocuments.forEach(doc => {
                stats.by_reason[doc.reason] = (stats.by_reason[doc.reason] || 0) + 1;
                stats.by_responsible[doc.responsible] = (stats.by_responsible[doc.responsible] || 0) + 1;
            });

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            console.error(`[${this.name}] Error getting statistics:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new WriteoffDocumentService(); 