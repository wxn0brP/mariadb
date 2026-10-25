import { Data } from "@wxn0brp/db-core/types/data";
import { VQueryT } from "@wxn0brp/db-core/types/query";
import { MariaDBValthera } from "./actions.js";
export declare function find(mv: MariaDBValthera, config: VQueryT.Find): Promise<Data[]>;
