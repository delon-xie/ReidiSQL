/**
 * 查询执行 React Query Hook
 * 用于：执行 SQL 查询并缓存结果
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { queriesApi } from '@/lib/api';

/** 执行查询（mutation，因为查询是有副作用的操作） */
export function useExecuteQuery() {
  return useMutation({
    mutationFn: ({
      connectionId,
      query,
      options,
    }: {
      connectionId: string;
      query: string;
      options?: { limit?: number };
    }) => queriesApi.execute(connectionId, query, options),
  });
}

/** 查询历史（按连接 ID 缓存） */
export function useQueryHistory(connectionId: string | null) {
  return useQuery<any[]>({
    queryKey: ['queryHistory', connectionId],
    queryFn: () => queriesApi.history(connectionId!),
    enabled: !!connectionId,
  });
}
