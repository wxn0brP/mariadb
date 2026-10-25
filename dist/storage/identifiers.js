export function quoteIdentifier(identifier) {
    if (!identifier)
        throw new Error("MariaDB identifier cannot be empty");
    return `\`${identifier.replace(/`/g, "``")}\``;
}
export function columnForField(field) {
    return field;
}
export function sqlColumnForField(field) {
    return quoteIdentifier(columnForField(field));
}
export function tableName(collection, database) {
    const table = quoteIdentifier(collection);
    return database ? `${quoteIdentifier(database)}.${table}` : table;
}
