/**
 * 日志状态管理 — Zustand Store (含 WebSocket 连接)
 */

import { create } from 'zustand';

export interface LogMessage {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  timestamp: string;
  source?: string;
}

interface LogStore {
  messages: LogMessage[];
  connected: boolean;
  ws: WebSocket | null;
  maxMessages: number;

  connect: () => void;
  disconnect: () => void;
  addMessage: (level: LogMessage['level'], message: string, source?: string) => void;
  clearMessages: () => void;
}

let msgCounter = 0;

export const useLogStore = create<LogStore>((set, get) => ({
  messages: [],
  connected: false,
  ws: null,
  maxMessages: 500,

  connect: () => {
    const { ws, connected } = get();
    if (ws && connected) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    const socket = new WebSocket(url);

    socket.onopen = () => {
      set({ connected: true });
      get().addMessage('info', 'WebSocket connected', 'system');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const level = data.type === 'error' ? 'error' : data.type === 'warn' ? 'warn' : 'info';
        get().addMessage(level, data.message || data.data || event.data, data.type);
      } catch {
        get().addMessage('debug', String(event.data), 'ws');
      }
    };

    socket.onclose = () => {
      set({ connected: false, ws: null });
      get().addMessage('warn', 'WebSocket disconnected', 'system');
    };

    socket.onerror = () => {
      set({ connected: false });
    };

    set({ ws: socket });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, connected: false });
    }
  },

  addMessage: (level, message, source) => {
    const msg: LogMessage = {
      id: `log_${++msgCounter}`,
      level,
      message,
      timestamp: new Date().toISOString(),
      source,
    };
    set((s) => {
      const messages = [...s.messages, msg];
      return { messages: messages.slice(-s.maxMessages) };
    });
  },

  clearMessages: () => set({ messages: [] }),
}));
