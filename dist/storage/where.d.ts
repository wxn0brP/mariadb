import { VQueryT } from "@wxn0brp/db-core/types/query";
import type { MariaDBValthera } from "../actions.js";
export interface WhereResult {
    sql: string;
    values: any[];
    partial: boolean;
}
export declare function buildWhere(mv: MariaDBValthera, collection: string, config: VQueryT.Find | VQueryT.Update | VQueryT.Remove): Promise<WhereResult>;
