import { updateObj } from "@wxn0brp/db-core/utils/process";
import { find } from "./find.js";
import { encodeValue, serializeData } from "./storage/codec.js";
import { columnForField, quoteIdentifier } from "./storage/identifiers.js";
import { ensureColumns, getColumns } from "./storage/schema.js";
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function tryBuildSimpleUpdate(mv, updater, primaryKey) {
    const $fields = {};
    const flatFields = {};
    for (const key of Object.keys(updater)) {
        if (key.startsWith("$"))
            $fields[key.toLowerCase()] = updater[key];
        else
            flatFields[key] = updater[key];
    }
    if (Object.keys($fields).some(key => key !== "$set"))
        return null;
    const fields = [];
    if ("$set" in $fields) {
        const setMap = $fields["$set"];
        if (!isPlainObject(setMap))
            return null;
        for (const [field, value] of Object.entries(setMap)) {
            if (field === primaryKey)
                continue;
            if (isPlainObject(value))
                return null;
            fields.push({
                key: field,
                ...encodeValue(value, mv.compositeEncoding),
            });
        }
    }
    for (const [field, value] of Object.entries(flatFields)) {
        if (field === primaryKey)
            continue;
        if (isPlainObject(value))
            return null;
        fields.push({
            key: field,
            ...encodeValue(value, mv.compositeEncoding),
        });
    }
    if (fields.length === 0)
        return null;
    return {
        set: fields
            .map(field => `${quoteIdentifier(columnForField(field.key))} = ?`)
            .join(", "),
        values: fields.map(field => field.value),
        fields,
    };
}
export async function update(mv, query, one) {
    const { collection, updater } = query;
    await mv.ensureCollection(collection);
    const primaryKey = mv.primaryKey(collection);
    if (!one && typeof updater !== "function") {
        const simple = tryBuildSimpleUpdate(mv, updater, primaryKey);
        if (simple) {
            await ensureColumns(mv, collection, simple.fields);
            const matched = await find(mv, query);
            if (matched.length === 0)
                return [];
            const pks = matched.map(doc => doc[primaryKey]);
            const placeholders = pks.map(() => "?").join(", ");
            await mv.query(`UPDATE ${mv.table(collection)} SET ${simple.set} WHERE ${quoteIdentifier(primaryKey)} IN (${placeholders})`, [
                ...simple.values,
                ...pks,
            ]);
            return matched.map(row => {
                const pk = row[primaryKey];
                const newData = updateObj(query, row);
                if (newData[primaryKey] !== pk)
                    newData[primaryKey] = pk;
                return newData;
            });
        }
    }
    const matched = await find(mv, {
        ...query,
        dbFindOpts: {
            ...(query.dbFindOpts || {}),
            limit: one ? 1 : undefined,
        },
    });
    if (matched.length === 0)
        return [];
    const results = [];
    const columns = await getColumns(mv, collection);
    for (const target of matched) {
        const beforeKeys = Object.keys(target);
        const pkValue = target[primaryKey];
        const newData = updateObj(query, target);
        if (target[primaryKey] !== undefined)
            newData[primaryKey] = target[primaryKey];
        else if (pkValue !== undefined)
            newData[primaryKey] = pkValue;
        const fields = serializeData(newData, primaryKey, mv.compositeEncoding);
        await ensureColumns(mv, collection, fields, columns);
        const assignments = [];
        const values = [];
        for (const field of fields) {
            values.push(field.value);
            assignments.push(`${quoteIdentifier(columnForField(field.key))} = ?`);
        }
        for (const key of beforeKeys) {
            if (key === primaryKey || key in newData)
                continue;
            assignments.push(`${quoteIdentifier(key)} = NULL`);
        }
        if (!assignments.length) {
            results.push(newData);
            continue;
        }
        const pk = target[primaryKey];
        values.push(pk);
        await mv.query(`UPDATE ${mv.table(collection)} SET ${assignments.join(", ")} WHERE ${quoteIdentifier(primaryKey)} = ?`, values);
        results.push(newData);
    }
    return results;
}
