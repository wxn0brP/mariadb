import { find } from "./find.js";
import { quoteIdentifier } from "./storage/identifiers.js";
export const BATCH_SIZE = +process.env.VALTHERA_MARIADB_BATCH_SIZE || 500;
export async function remove(mv, query, one) {
    const { collection } = query;
    await mv.ensureCollection(collection);
    const toDelete = await find(mv, {
        ...query,
        dbFindOpts: {
            ...(query.dbFindOpts || {}),
            limit: one ? 1 : undefined,
        },
    });
    if (!toDelete.length)
        return [];
    const primaryKey = mv.primaryKey(collection);
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "?").join(", ");
        await mv.query(`DELETE FROM ${mv.table(collection)} WHERE ${quoteIdentifier(primaryKey)} IN (${placeholders})`, batch.map(doc => doc[primaryKey]));
    }
    return toDelete;
}
