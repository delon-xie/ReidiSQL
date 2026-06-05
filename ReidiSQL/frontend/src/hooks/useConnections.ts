/**
 * 连接列表 React Query Hook
 * 用于：获取、创建、更新、删除连接
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionsApi, ConnectionConfig, ConnectionInfo } from '@/lib/api';

const CONNECTIONS_KEY = ['connections'];

/** 获取连接列表 */
export function useConnections() {
  return useQuery<ConnectionInfo[]>({
    queryKey: CONNECTIONS_KEY,
    queryFn: () => connectionsApi.list(),
  });
}

/** 创建连接 */
export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cfg: ConnectionConfig) => connectionsApi.create(cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/** 更新连接 */
export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cfg }: { id: string; cfg: Partial<ConnectionConfig> }) =>
      connectionsApi.update(id, cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/** 删除连接 */
export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => connectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/** 测试连接 */
export function useTestConnection() {
  return useMutation({
    mutationFn: (cfg: ConnectionConfig) => connectionsApi.test(cfg),
  });
}

/** 连接到数据库 */
export function useConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => connectionsApi.connect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/** 断开连接 */
export function useDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => connectionsApi.disconnect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}
