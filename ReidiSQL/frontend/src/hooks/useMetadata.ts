/**
 * 元数据 React Query Hook
 * 用于：懒加载数据库、表、列信息
 */

import { useQuery } from '@tanstack/react-query';
import { metadataApi } from '@/lib/api';

/** 获取数据库列表（连接激活后可用） */
export function useDatabases(connectionId: string | null) {
  return useQuery<string[]>({
    queryKey: ['metadata', 'databases', connectionId],
    queryFn: () => metadataApi.databases(connectionId!),
    enabled: !!connectionId,
  });
}

/** 获取表列表 */
export function useTables(connectionId: string | null, database: string | null) {
  return useQuery<any[]>({
    queryKey: ['metadata', 'tables', connectionId, database],
    queryFn: () => metadataApi.tables(connectionId!, database!),
    enabled: !!connectionId && !!database,
  });
}

/** 获取表列信息 */
export function useColumns(
  connectionId: string | null,
  database: string | null,
  table: string | null,
) {
  return useQuery<any[]>({
    queryKey: ['metadata', 'columns', connectionId, database, table],
    queryFn: () => metadataApi.columns(connectionId!, database!, table!),
    enabled: !!connectionId && !!database && !!table,
  });
}

/** 获取视图列表 */
export function useViews(connectionId: string | null, database: string | null) {
  return useQuery<any[]>({
    queryKey: ['metadata', 'views', connectionId, database],
    queryFn: () => metadataApi.views(connectionId!, database!),
    enabled: !!connectionId && !!database,
  });
}

/** 获取存储过程列表 */
export function useProcedures(connectionId: string | null, database: string | null) {
  return useQuery<any[]>({
    queryKey: ['metadata', 'procedures', connectionId, database],
    queryFn: () => metadataApi.procedures(connectionId!, database!),
    enabled: !!connectionId && !!database,
  });
}

/** 获取函数列表 */
export function useFunctions(connectionId: string | null, database: string | null) {
  return useQuery<any[]>({
    queryKey: ['metadata', 'functions', connectionId, database],
    queryFn: () => metadataApi.functions(connectionId!, database!),
    enabled: !!connectionId && !!database,
  });
}

/** 获取触发器列表 */
export function useTriggers(
  connectionId: string | null,
  database: string | null,
  _table: string | null = null,
) {
  return useQuery<any[]>({
    queryKey: ['metadata', 'triggers', connectionId, database, _table],
    queryFn: () => metadataApi.triggers(connectionId!, database!),
    enabled: !!connectionId && !!database,
  });
}
