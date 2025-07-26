/**
 * Database Adapter - універсальний інтерфейс для SQLite та Supabase
 * Дозволяє поетапну міграцію з збереженням однакового API
 */

const { supabase } = require('../database-supabase');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseAdapter {
    constructor(useSupabase = false) {
        this.useSupabase = useSupabase;
        this.tableName = null;
        
        if (useSupabase) {
            this.client = supabase;
            console.log('🟢 DatabaseAdapter: використовується Supabase');
        } else {
            const dbPath = path.join(__dirname, '..', process.env.SQLITE_DB_PATH || 'pizza_inventory.db');
            this.client = new sqlite3.Database(dbPath);
            console.log('🔵 DatabaseAdapter: використовується SQLite');
        }
    }
    
    /**
     * Встановити поточну таблицю для операцій
     */
    table(tableName) {
        this.tableName = tableName;
        return this;
    }
    
    /**
     * SELECT операції
     */
    async select(columns = '*', options = {}) {
        if (this.useSupabase) {
            return this._selectSupabase(columns, options);
        } else {
            return this._selectSQLite(columns, options);
        }
    }
    
    /**
     * INSERT операції
     */
    async insert(data) {
        if (this.useSupabase) {
            return this._insertSupabase(data);
        } else {
            return this._insertSQLite(data);
        }
    }
    
    /**
     * UPDATE операції
     */
    async update(data, where = {}) {
        if (this.useSupabase) {
            return this._updateSupabase(data, where);
        } else {
            return this._updateSQLite(data, where);
        }
    }
    
    /**
     * DELETE операції
     */
    async delete(where = {}) {
        if (this.useSupabase) {
            return this._deleteSupabase(where);
        } else {
            return this._deleteSQLite(where);
        }
    }
    
    /**
     * RAW SQL запити (тільки для складних операцій)
     */
    async raw(sql, params = []) {
        if (this.useSupabase) {
            throw new Error('Raw SQL запити не підтримуються в Supabase режимі. Використовуйте Supabase функції.');
        } else {
            return this._rawSQLite(sql, params);
        }
    }
    
    // =====================================
    // SUPABASE МЕТОДИ
    // =====================================
    
    async _selectSupabase(columns, options) {
        try {
            let query = this.client.from(this.tableName);
            
            // SELECT колонки
            if (Array.isArray(columns)) {
                query = query.select(columns.join(', '));
            } else {
                query = query.select(columns);
            }
            
            // WHERE умови
            if (options.where) {
                for (const [field, value] of Object.entries(options.where)) {
                    if (Array.isArray(value)) {
                        query = query.in(field, value);
                    } else if (value === null) {
                        query = query.is(field, null);
                    } else {
                        query = query.eq(field, value);
                    }
                }
            }
            
            // ORDER BY
            if (options.orderBy) {
                const { column, direction = 'asc' } = options.orderBy;
                query = query.order(column, { ascending: direction === 'asc' });
            }
            
            // LIMIT
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            // OFFSET
            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 1000) - 1);
            }
            
            const { data, error } = await query;
            
            if (error) {
                throw new Error(`Supabase SELECT error: ${error.message}`);
            }
            
            return data;
            
        } catch (error) {
            console.error('DatabaseAdapter Supabase SELECT error:', error);
            throw error;
        }
    }
    
    async _insertSupabase(data) {
        try {
            const { data: result, error } = await this.client
                .from(this.tableName)
                .insert(data)
                .select()
                .single();
                
            if (error) {
                throw new Error(`Supabase INSERT error: ${error.message}`);
            }
            
            return result;
            
        } catch (error) {
            console.error('DatabaseAdapter Supabase INSERT error:', error);
            throw error;
        }
    }
    
    async _updateSupabase(data, where) {
        try {
            let query = this.client.from(this.tableName).update(data);
            
            // WHERE умови
            for (const [field, value] of Object.entries(where)) {
                query = query.eq(field, value);
            }
            
            const { data: result, error } = await query.select().single();
            
            if (error) {
                throw new Error(`Supabase UPDATE error: ${error.message}`);
            }
            
            return result;
            
        } catch (error) {
            console.error('DatabaseAdapter Supabase UPDATE error:', error);
            throw error;
        }
    }
    
    async _deleteSupabase(where) {
        try {
            let query = this.client.from(this.tableName);
            
            // WHERE умови
            for (const [field, value] of Object.entries(where)) {
                query = query.eq(field, value);
            }
            
            const { error } = await query.delete();
            
            if (error) {
                throw new Error(`Supabase DELETE error: ${error.message}`);
            }
            
            return true;
            
        } catch (error) {
            console.error('DatabaseAdapter Supabase DELETE error:', error);
            throw error;
        }
    }
    
    // =====================================
    // SQLITE МЕТОДИ
    // =====================================
    
    async _selectSQLite(columns, options) {
        return new Promise((resolve, reject) => {
            try {
                let sql = `SELECT ${Array.isArray(columns) ? columns.join(', ') : columns} FROM ${this.tableName}`;
                const params = [];
                
                // WHERE умови
                if (options.where) {
                    const whereConditions = [];
                    for (const [field, value] of Object.entries(options.where)) {
                        if (Array.isArray(value)) {
                            const placeholders = value.map(() => '?').join(', ');
                            whereConditions.push(`${field} IN (${placeholders})`);
                            params.push(...value);
                        } else if (value === null) {
                            whereConditions.push(`${field} IS NULL`);
                        } else {
                            whereConditions.push(`${field} = ?`);
                            params.push(value);
                        }
                    }
                    sql += ` WHERE ${whereConditions.join(' AND ')}`;
                }
                
                // ORDER BY
                if (options.orderBy) {
                    const { column, direction = 'ASC' } = options.orderBy;
                    sql += ` ORDER BY ${column} ${direction.toUpperCase()}`;
                }
                
                // LIMIT
                if (options.limit) {
                    sql += ` LIMIT ?`;
                    params.push(options.limit);
                }
                
                // OFFSET
                if (options.offset) {
                    sql += ` OFFSET ?`;
                    params.push(options.offset);
                }
                
                this.client.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(new Error(`SQLite SELECT error: ${err.message}`));
                    } else {
                        resolve(rows);
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async _insertSQLite(data) {
        return new Promise((resolve, reject) => {
            try {
                const columns = Object.keys(data);
                const placeholders = columns.map(() => '?').join(', ');
                const values = Object.values(data);
                
                const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                
                this.client.run(sql, values, function(err) {
                    if (err) {
                        reject(new Error(`SQLite INSERT error: ${err.message}`));
                    } else {
                        // Повернути вставлений запис
                        resolve({ id: this.lastID, ...data });
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async _updateSQLite(data, where) {
        return new Promise((resolve, reject) => {
            try {
                const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
                const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
                
                const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause}`;
                const params = [...Object.values(data), ...Object.values(where)];
                
                this.client.run(sql, params, function(err) {
                    if (err) {
                        reject(new Error(`SQLite UPDATE error: ${err.message}`));
                    } else {
                        resolve({ changes: this.changes, ...data, ...where });
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async _deleteSQLite(where) {
        return new Promise((resolve, reject) => {
            try {
                const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
                const sql = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
                const params = Object.values(where);
                
                this.client.run(sql, params, function(err) {
                    if (err) {
                        reject(new Error(`SQLite DELETE error: ${err.message}`));
                    } else {
                        resolve(this.changes > 0);
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async _rawSQLite(sql, params) {
        return new Promise((resolve, reject) => {
            this.client.all(sql, params, (err, rows) => {
                if (err) {
                    reject(new Error(`SQLite RAW error: ${err.message}`));
                } else {
                    resolve(rows);
                }
            });
        });
    }
    
    // =====================================
    // УТИЛІТНІ МЕТОДИ
    // =====================================
    
    /**
     * Закрити з'єднання (тільки для SQLite)
     */
    close() {
        if (!this.useSupabase && this.client) {
            this.client.close();
        }
    }
    
    /**
     * Перевірити з'єднання
     */
    async testConnection() {
        if (this.useSupabase) {
            const { data, error } = await this.client.from('users').select('count', { count: 'exact', head: true });
            return !error;
        } else {
            return new Promise((resolve) => {
                this.client.get('SELECT 1', (err) => {
                    resolve(!err);
                });
            });
        }
    }
}

module.exports = DatabaseAdapter;