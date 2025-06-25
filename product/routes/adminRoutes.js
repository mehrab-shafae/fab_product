import express from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Admin Panel HTML
router.get('/', (req, res) => {
      res.sendFile(cwd('admin-panel.html'));
});

// Get all tables with detailed information
router.get('/tables', async (req, res) => {
      try {
            const pgPool = req.app.locals.pgPool;

            // Get all tables with detailed information
            const query = `
            SELECT 
                t.table_name as name,
                obj_description(c.oid) as description,
                c.reltuples as estimated_rows,
                pg_size_pretty(pg_total_relation_size(c.oid)) as size,
                c.reltuples::bigint as row_count
            FROM information_schema.tables t
            JOIN pg_class c ON c.relname = t.table_name
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name
        `;

            const result = await pgPool.query(query);

            // Get actual row counts for each table
            const tablesWithCounts = [];

            for (const table of result.rows) {
                  try {
                        const countQuery = `SELECT COUNT(*) as count FROM "${table.name}"`;
                        const countResult = await pgPool.query(countQuery);
                        tablesWithCounts.push({
                              name: table.name,
                              description: table.description || '',
                              estimated_rows: isNaN(parseInt(table.estimated_rows)) || parseInt(table.estimated_rows) < 0 ? 0 : Math.round(parseInt(table.estimated_rows)),
                              actual_rows: isNaN(parseInt(countResult.rows[0].count)) || parseInt(countResult.rows[0].count) < 0 ? 0 : parseInt(countResult.rows[0].count),
                              size: table.size || '0 kB',
                              last_updated: new Date().toISOString(),
                        });
                  } catch (error) {
                        console.log(`Error counting rows for table ${table.name}:`, error.message);
                        tablesWithCounts.push({
                              name: table.name,
                              description: table.description || '',
                              estimated_rows: isNaN(parseInt(table.estimated_rows)) || parseInt(table.estimated_rows) < 0 ? 0 : Math.round(parseInt(table.estimated_rows)),
                              actual_rows: 0,
                              size: table.size || '0 kB',
                              last_updated: new Date().toISOString(),
                        });
                  }
            }

            res.success(tablesWithCounts);
      } catch (error) {
            console.error('Error in admin tables endpoint:', error);
            res.error(error);
      }
});

// Get table data with pagination
router.get('/tables/:tableName', async (req, res) => {
      try {
            const { tableName } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;
            const pgPool = req.app.locals.pgPool;

            // Get table columns with detailed information
            const columnsQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                col_description(cl.oid, ordinal_position) as description
            FROM information_schema.columns c
            JOIN pg_class cl ON cl.relname = c.table_name
            WHERE c.table_schema = 'public' 
            AND c.table_name = $1 
            ORDER BY ordinal_position
        `;
            const columnsResult = await pgPool.query(columnsQuery, [tableName]);
            const columns = columnsResult.rows;

            // Get table constraints and indexes
            const constraintsQuery = `
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            LEFT JOIN information_schema.constraint_column_usage ccu 
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = $1
            ORDER BY tc.constraint_type, tc.constraint_name
        `;
            const constraintsResult = await pgPool.query(constraintsQuery, [tableName]);

            // Get indexes
            let indexesResult = { rows: [] };
            try {
                  const indexesQuery = `
                SELECT
                    i.relname AS indexname,
                    pg_get_indexdef(ix.indexrelid) AS indexdef,
                    ix.indisunique,
                    ix.indisprimary,
                    ix.indisclustered
                FROM pg_class t
                JOIN pg_index ix ON t.oid = ix.indrelid
                JOIN pg_class i ON i.oid = ix.indexrelid
                WHERE t.relname = $1
                ORDER BY i.relname
            `;
                  indexesResult = await pgPool.query(indexesQuery, [tableName]);
            } catch (indexesError) {
                  console.log(`pg_indexes not available for table ${tableName}, skipping indexes:`, indexesError.message);
            }

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`;
            const countResult = await pgPool.query(countQuery);
            const total = parseInt(countResult.rows[0].total);

            // Get data with pagination
            let dataQuery;
            // Check if the table has a deleted_at column
            const hasDeletedAt = columns.some(col => col.column_name === 'deleted_at');
            if (hasDeletedAt) {
                  // For tables with deleted_at, include is_deleted field
                  dataQuery = `SELECT *, deleted_at IS NOT NULL AS is_deleted FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`;
            } else {
                  dataQuery = `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`;
            }
            const dataResult = await pgPool.query(dataQuery, [limit, offset]);

            // Get table statistics
            let statsResult = { rows: [] };
            try {
                  const statsQuery = `
                SELECT 
                    schemaname,
                    tablename,
                    attname,
                    n_distinct,
                    correlation,
                    most_common_vals,
                    most_common_freqs
                FROM pg_stats 
                WHERE tablename = $1
                ORDER BY attname
            `;
                  statsResult = await pgPool.query(statsQuery, [tableName]);
            } catch (statsError) {
                  console.log(`pg_stats not available for table ${tableName}, skipping statistics:`, statsError.message);
            }

            res.success({
                  table_info: {
                        name: tableName,
                        total_rows: total,
                        page,
                        limit,
                        total_pages: Math.ceil(total / limit),
                  },
                  columns,
                  constraints: constraintsResult.rows,
                  indexes: indexesResult.rows,
                  statistics: statsResult.rows,
                  rows: dataResult.rows,
            });
      } catch (error) {
            res.error(error);
      }
});

// Get database overview
router.get('/overview', async (req, res) => {
      try {
            const pgPool = req.app.locals.pgPool;

            // Get database size
            const dbSizeQuery = `
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as database_size,
                pg_database_size(current_database()) as size_bytes
        `;
            const dbSizeResult = await pgPool.query(dbSizeQuery);

            // Get total tables count
            const tablesCountQuery = `
            SELECT COUNT(*) as total_tables
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
        `;
            const tablesCountResult = await pgPool.query(tablesCountQuery);

            // Get total rows across all tables
            const totalRowsQuery = `
            SELECT SUM(reltuples) as total_estimated_rows
            FROM pg_class c
            JOIN information_schema.tables t ON t.table_name = c.relname
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
        `;
            const totalRowsResult = await pgPool.query(totalRowsQuery);
            let totalRows = parseInt(totalRowsResult.rows[0].total_estimated_rows);
            if (isNaN(totalRows) || totalRows < 0) totalRows = 0;

            // Get largest tables
            const largestTablesQuery = `
            SELECT 
                c.relname as table_name,
                pg_size_pretty(pg_total_relation_size(c.oid)) as size,
                c.reltuples::bigint as estimated_rows
            FROM pg_class c
            JOIN information_schema.tables t ON t.table_name = c.relname
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            ORDER BY pg_total_relation_size(c.oid) DESC
            LIMIT 10
        `;
            const largestTablesResult = await pgPool.query(largestTablesQuery);

            // Get recent activity (last modified tables) - Using a safer approach
            let recentActivityResult = { rows: [] };
            try {
                  const recentActivityQuery = `
                SELECT 
                    schemaname,
                    tablename,
                    last_vacuum,
                    last_autovacuum,
                    last_analyze,
                    last_autoanalyze
                FROM pg_stat_user_tables
                ORDER BY GREATEST(last_vacuum, last_autovacuum, last_analyze, last_autoanalyze) DESC NULLS LAST
                LIMIT 10
            `;
                  recentActivityResult = await pgPool.query(recentActivityQuery);
            } catch (activityError) {
                  console.log('pg_stat_user_tables not available, skipping recent activity:', activityError.message);
            }

            res.success({
                  database_info: {
                        name: process.env.POSTGRES_DB || 'product_db',
                        size: dbSizeResult.rows[0].database_size,
                        size_bytes: parseInt(dbSizeResult.rows[0].size_bytes),
                        total_tables: parseInt(tablesCountResult.rows[0].total_tables),
                        total_estimated_rows: totalRows,
                  },
                  largest_tables: largestTablesResult.rows,
                  recent_activity: recentActivityResult.rows,
                  last_updated: new Date().toISOString(),
            });
      } catch (error) {
            console.error('Error in admin overview endpoint:', error);
            res.error(error);
      }
});

// Get table relationships
router.get('/tables/:tableName/relationships', async (req, res) => {
      try {
            const { tableName } = req.params;
            const pgPool = req.app.locals.pgPool;

            // Get foreign key relationships
            const fkQuery = `
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND (tc.table_name = $1 OR ccu.table_name = $1)
        `;
            const fkResult = await pgPool.query(fkQuery, [tableName]);

            res.success({
                  table_name: tableName,
                  relationships: fkResult.rows,
            });
      } catch (error) {
            res.error(error);
      }
});

// Get table structure
router.get('/tables/:tableName/structure', async (req, res) => {
      try {
            const { tableName } = req.params;
            const pgPool = req.app.locals.pgPool;

            // Get detailed column information
            const structureQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                datetime_precision,
                col_description(cl.oid, ordinal_position) as description,
                ordinal_position
            FROM information_schema.columns c
            JOIN pg_class cl ON cl.relname = c.table_name
            WHERE c.table_schema = 'public' 
            AND c.table_name = $1 
            ORDER BY ordinal_position
        `;
            const structureResult = await pgPool.query(structureQuery, [tableName]);

            // Get indexes
            let indexesResult = { rows: [] };
            try {
                  const indexesQuery = `
                SELECT
                    i.relname AS indexname,
                    pg_get_indexdef(ix.indexrelid) AS indexdef,
                    ix.indisunique,
                    ix.indisprimary,
                    ix.indisclustered
                FROM pg_class t
                JOIN pg_index ix ON t.oid = ix.indrelid
                JOIN pg_class i ON i.oid = ix.indexrelid
                WHERE t.relname = $1
                ORDER BY i.relname
            `;
                  indexesResult = await pgPool.query(indexesQuery, [tableName]);
            } catch (indexesError) {
                  console.log(`pg_indexes not available for table ${tableName}, skipping indexes:`, indexesError.message);
            }

            res.success({
                  table_name: tableName,
                  structure: structureResult.rows,
                  indexes: indexesResult.rows,
            });
      } catch (error) {
            res.error(error);
      }
});

export default router;
