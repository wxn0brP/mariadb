import { ActionsBase } from "@wxn0brp/db-core/base/actions";
import { addId } from "@wxn0brp/db-core/helpers/addId";
import { genId } from "@wxn0brp/db-core/helpers/gen";
import { find } from "./find.js";
import { remove } from "./remove.js";
import { serializeData } from "./storage/codec.js";
import { columnForField, quoteIdentifier, tableName, } from "./storage/identifiers.js";
import { ensureColumns } from "./storage/schema.js";
import { buildWhere } from "./storage/where.js";
import { update } from "./update.js";
import { createPool } from "./pool.js";
const DDL_RE = /^\s*(CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/i;
function extractRows(result) {
    if (!result)
        return [];
    if (Array.isArray(result)) {
        if (result.length > 0 && Array.isArray(result[0]))
            return result[0];
        return result;
    }
    if (Array.isArray(result.rows))
        return result.rows;
    return [];
}
async function runQuery(connection, sql, values = []) {
    const target = connection;
    if (typeof target.query === "function")
        return extractRows(await target.query(sql, values));
    if (typeof target.unsafe === "function")
        return extractRows(await target.unsafe(sql, values));
    throw new Error("Unsupported MariaDB connection: expected query() or unsafe() method");
}
export class MariaDBValthera extends ActionsBase {
    db;
    _inited = true;
    capabilities = {
        transactions: true,
        indexes: true,
        persistent: true,
    };
    mode;
    compositeEncoding;
    primaryKeyOption;
    database;
    connectionString;
    driver;
    _closed = false;
    _columnsCache = new Map();
    _columnsCacheTTL = 5000;
    _knownCollections = new Set();
    _database;
    _txActive = false;
    _txConn = null;
    _txWaiters = [];
    constructor(db, opts = {}) {
        super();
        this.db = db;
        this.database = opts.database;
        this.mode = opts.mode ?? "strict";
        this.compositeEncoding = opts.compositeEncoding ?? "blob";
        this.primaryKeyOption = opts.primaryKey ?? "_id";
        this.connectionString = opts.connectionString;
        this.driver = opts.driver ?? "mariadb";
    }
    async init() {
        if (!this._closed || !this.connectionString)
            return;
        this.db = await createPool(this.connectionString, this.driver);
        this._closed = false;
        await this.databaseName();
    }
    async close() {
        this._columnsCache.clear();
        this._knownCollections.clear();
        this._database = undefined;
        const txConn = this._txConn;
        if (txConn && typeof txConn.release === "function")
            txConn.release();
        this._txConn = null;
        this._txActive = false;
        const db = this.db;
        if (typeof db.end === "function")
            await Promise.resolve(db.end());
        else if (typeof db.close === "function")
            await Promise.resolve(db.close());
        else if (typeof db.destroy === "function")
            await Promise.resolve(db.destroy());
        this._closed = true;
    }
    async query(sql, values = []) {
        const target = this._txConn ?? this.db;
        const rows = await runQuery(target, sql, values);
        if (this._txActive && DDL_RE.test(sql))
            await runQuery(target, "BEGIN");
        return rows;
    }
    async _waitForTx() {
        if (!this._txActive)
            return;
        return await new Promise(resolve => {
            this._txWaiters.push(resolve);
        });
    }
    _releaseTx() {
        this._txActive = false;
        const conn = this._txConn;
        this._txConn = null;
        if (conn && typeof conn.release === "function")
            conn.release();
        const waiters = this._txWaiters;
        this._txWaiters = [];
        for (const waiter of waiters)
            waiter();
    }
    table(collection) {
        return tableName(collection, this.database);
    }
    metadataTable(collection) {
        return collection;
    }
    primaryKey(collection) {
        return typeof this.primaryKeyOption === "string"
            ? this.primaryKeyOption
            : (this.primaryKeyOption[collection] ?? "_id");
    }
    async databaseName() {
        if (this.database)
            return this.database;
        if (this._database)
            return this._database;
        const rows = await this.query("SELECT DATABASE() AS db");
        this._database = rows[0]?.db ?? "";
        return this._database;
    }
    async getCollections() {
        const database = await this.databaseName();
        const rows = await this.query(`SELECT table_name AS name
             FROM information_schema.tables
             WHERE table_schema = ? AND table_type = 'BASE TABLE'
             ORDER BY table_name`, [
            database,
        ]);
        return rows.map(row => row.name ?? row.TABLE_NAME);
    }
    async issetCollection(collection) {
        if (this._knownCollections.has(collection))
            return true;
        const database = await this.databaseName();
        const rows = await this.query(`SELECT 1 FROM information_schema.tables
             WHERE table_schema = ? AND table_name = ? AND table_type = 'BASE TABLE'
             LIMIT 1`, [
            database,
            this.metadataTable(collection),
        ]);
        const exists = rows.length > 0;
        if (exists)
            this._knownCollections.add(collection);
        return exists;
    }
    async ensureCollection(collection) {
        const exists = await this.issetCollection(collection);
        if (!exists && this.mode === "strict")
            throw new Error(`MariaDB table ${this.table(collection)} does not exist`);
        if (!exists) {
            const primaryKey = this.primaryKey(collection);
            await this.query(`CREATE TABLE ${this.table(collection)} (
                    ${quoteIdentifier(primaryKey)} VARCHAR(191) NOT NULL PRIMARY KEY
                )`);
            this._knownCollections.add(collection);
            return true;
        }
        return false;
    }
    async removeCollection(collection) {
        await this.query(`DROP TABLE IF EXISTS ${this.table(collection)}`);
        this._knownCollections.delete(collection);
        this._columnsCache.delete(collection);
        return true;
    }
    async add(config) {
        const { data, collection } = config;
        await this.ensureCollection(collection);
        const primaryKey = this.primaryKey(collection);
        if (primaryKey === "_id") {
            await addId(config, this, true);
        }
        else if (data[primaryKey] === undefined) {
            data[primaryKey] = genId();
        }
        const originalId = data[primaryKey] ?? genId();
        const storageId = typeof originalId !== "string" ? String(originalId) : originalId;
        const fields = serializeData(data, primaryKey, this.compositeEncoding);
        await ensureColumns(this, collection, fields);
        const columns = [
            primaryKey,
            ...fields.map(field => columnForField(field.key)),
        ];
        const values = [
            storageId,
            ...fields.map(field => field.value),
        ];
        const placeholders = values.map(() => "?").join(", ");
        await this.query(`INSERT INTO ${this.table(collection)}
             (${columns.map(quoteIdentifier).join(", ")})
             VALUES (${placeholders})`, values);
        return data;
    }
    find(config) {
        return find(this, config);
    }
    async findOne(config) {
        config.dbFindOpts = {
            ...(config.dbFindOpts || {}),
            limit: 1,
        };
        const result = await this.find(config);
        return result.length ? result[0] : null;
    }
    update(config) {
        return update(this, config, false);
    }
    async updateOne(config) {
        const result = await update(this, config, true);
        return result[0] || null;
    }
    remove(config) {
        return remove(this, config, false);
    }
    async removeOne(config) {
        const result = await remove(this, config, true);
        return result[0] || null;
    }
    async count(config) {
        const { collection } = config;
        await this.ensureCollection(collection);
        const where = await buildWhere(this, collection, config);
        if (where.partial)
            return (await this.find(config)).length;
        const rows = await this.query(`SELECT COUNT(*) AS count FROM ${this.table(collection)} ${where.sql}`, where.values);
        return Number(rows[0]?.count ?? 0);
    }
    async beginTransaction(id) {
        await this._waitForTx();
        const pool = this.db;
        let conn;
        if (typeof pool.reserve === "function")
            conn = await pool.reserve();
        else if (typeof pool.getConnection === "function")
            conn = await pool.getConnection();
        else
            conn = pool;
        this._txConn = conn;
        this._txActive = true;
        await this.query("BEGIN");
        return {
            id,
        };
    }
    async commitTransaction(handle) {
        await this.query("COMMIT");
        this._releaseTx();
    }
    async rollbackTransaction(handle) {
        await this.query("ROLLBACK");
        this._releaseTx();
    }
    async createIndex(config) {
        await this._waitForTx();
        const { collection, index } = config;
        const { fields, opts } = index;
        const indexName = opts?.name || `idx_${collection}_${fields.join("_")}`;
        const uniqueStr = opts?.unique ? "UNIQUE " : "";
        const fieldsStr = fields.map(field => quoteIdentifier(field)).join(", ");
        await this.query(`CREATE ${uniqueStr}INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${this.table(collection)} (${fieldsStr})`);
    }
    async removeIndex(config) {
        await this._waitForTx();
        const { collection, index } = config;
        const { fields, opts } = index;
        const indexName = opts?.name || `idx_${collection}_${fields.join("_")}`;
        await this.query(`DROP INDEX IF EXISTS ${quoteIdentifier(indexName)} ON ${this.table(collection)}`);
    }
}
