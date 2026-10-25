import { findUtil } from "@wxn0brp/db-core/utils/action";
import { findObj } from "@wxn0brp/db-core/utils/process";
import { rowToData } from "./storage/row.js";
import { getColumns } from "./storage/schema.js";
import { buildWhere } from "./storage/where.js";
export async function find(mv, config) {
    const { collection } = config;
    await mv.ensureCollection(collection);
    const columns = await getColumns(mv, collection);
    const where = await buildWhere(mv, collection, config);
    const primaryKey = mv.primaryKey(collection);
    const search = config.search;
    const rows = await mv.query(`SELECT * FROM ${mv.table(collection)} ${where.sql}`, where.values);
    const docs = rows
        .map(row => {
        const data = rowToData(row, columns, mv.compositeEncoding);
        if (search && typeof search === "object" && !Array.isArray(search)) {
            for (const [key, value] of Object.entries(search)) {
                if (key.startsWith("$"))
                    continue;
                if (key === primaryKey &&
                    typeof value === "number" &&
                    typeof data[key] === "string") {
                    const num = Number(data[key]);
                    if (!Number.isNaN(num) && String(num) === data[key])
                        data[key] = num;
                }
            }
        }
        return findObj(config, data);
    })
        .filter(Boolean);
    return findUtil(config, docs, []);
}
