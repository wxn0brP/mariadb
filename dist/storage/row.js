import { decodeValue } from "./codec.js";
export function rowToData(row, columns, compositeEncoding = "blob") {
    const data = {};
    for (const column of columns.keys()) {
        const value = row[column];
        if (value !== null && value !== undefined)
            data[column] = decodeValue(value, columns.get(column), compositeEncoding);
    }
    return data;
}
