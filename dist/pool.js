export async function createPool(connectionString, driver) {
    if (driver === "mysql2") {
        const { createPool: create } = await import("mysql2/promise");
        return create(connectionString);
    }
    if (driver === "bun") {
        const { SQL } = await import("bun");
        return new SQL(connectionString);
    }
    const { createPool: create } = await import("mariadb");
    return create(connectionString);
}
