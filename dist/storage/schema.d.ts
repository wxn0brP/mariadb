import type { MariaDBValthera } from "../actions.js";
import { ColumnInfo, SerializedField } from "./types.js";
export declare function isBlobColumn(column?: ColumnInfo): boolean;
export declare function isBooleanColumn(column?: ColumnInfo): boolean;
export declare function columnInfoForSqlType(name: string, sqlType: string): ColumnInfo;
export declare function compatibleType(existing: ColumnInfo | undefined, sqlType: string): boolean;
export declare function getColumns(mv: MariaDBValthera, collection: string): Promise<Map<string, ColumnInfo>>;
export declare function invalidateColumnsCache(mv: MariaDBValthera, collection: string): void;
export declare function ensureColumns(mv: MariaDBValthera, collection: string, fields: SerializedField[], columns?: Map<string, ColumnInfo>): Promise<void>;
