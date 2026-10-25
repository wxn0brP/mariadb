import { Data } from "@wxn0brp/db-core/types/data";
import type { CompositeEncoding } from "../types.js";
import { ColumnInfo } from "./types.js";
export declare function rowToData(row: Record<string, any>, columns: Map<string, ColumnInfo>, compositeEncoding?: CompositeEncoding): Data;
