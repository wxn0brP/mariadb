import { ValtheraClass, forgeTypedValthera } from "@wxn0brp/db-core";
import { MariaDBValthera } from "./actions.js";
import { createPool } from "./pool.js";
export function createMariaDBValthera(mariadbDB, opts = {}) {
    const adapter = new MariaDBValthera(mariadbDB, opts);
    const db = new ValtheraClass({
        adapter,
    });
    return forgeTypedValthera(db);
}
async function createWithDriver(connectionString, driver, opts) {
    const pool = await createPool(connectionString, driver);
    return new MariaDBValthera(pool, {
        connectionString,
        driver,
        ...opts,
    });
}
export const DYNAMIC = {
    async mariadb(connectionString, opts = {}) {
        return createWithDriver(connectionString, "mariadb", opts);
    },
    async mysql2(connectionString, opts = {}) {
        return createWithDriver(connectionString, "mysql2", opts);
    },
    async bun(connectionString, opts = {}) {
        return createWithDriver(connectionString, "bun", opts);
    },
    async def(connectionString, opts = {}) {
        const drivers = opts.driver
            ? [
                opts.driver,
            ]
            : [
                "mariadb",
                "mysql2",
                "bun",
            ];
        let lastError;
        for (const driver of drivers) {
            try {
                return await createWithDriver(connectionString, driver, opts);
            }
            catch (error) {
                lastError = error;
            }
        }
        throw lastError ?? new Error("No MariaDB driver available");
    },
};
