import { MariaDBConnection, MariaDBDriver } from "./types.js";
export declare function createPool(connectionString: string, driver: MariaDBDriver): Promise<MariaDBConnection>;
