import { DataInternal } from "@wxn0brp/db-core/types/data";
import { VQueryT } from "@wxn0brp/db-core/types/query";
import { MariaDBValthera } from "./actions.js";
export declare const BATCH_SIZE: number;
export declare function remove(mv: MariaDBValthera, query: VQueryT.Remove, one: boolean): Promise<DataInternal[]>;
