import { Data } from "@wxn0brp/db-core/types/data";
import type { CompositeEncoding } from "../types.js";
import { ColumnInfo, SerializedField } from "./types.js";
declare const NULL_SENTINEL = "VDB_NULL:null";
export declare function encodeValue(value: any, compositeEncoding?: CompositeEncoding): {
    value: any;
    sqlType: string;
};
export declare function isJsonSafe(value: any): boolean;
export declare function decodeValue(value: any, column?: ColumnInfo, compositeEncoding?: CompositeEncoding): any;
export declare function isEncodedNull(value: any): boolean;
export declare function serializeData(data: Data, primaryKey?: string, compositeEncoding?: CompositeEncoding): SerializedField[];
export { NULL_SENTINEL };
