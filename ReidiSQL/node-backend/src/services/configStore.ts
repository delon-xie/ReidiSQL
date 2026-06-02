/**
 * 连接配置持久化存储
 * 使用 JSON 文件存储连接配置到 ~/.reidisql/connections.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

const APP_DIR = join(homedir(), '.reidisql');
const CONNECTIONS_FILE = join(APP_DIR, 'connections.json');

export interface StoredConnection {
  id: string;
  name: string;
  type: 'mysql' | 'mariadb' | 'postgresql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  ssh?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    privateKey?: string;
  };
  ssl?: {
    enabled: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  options?: {
    charset?: string;
    connectTimeout?: number;
    queryTimeout?: number;
  };
  color?: string;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export class ConfigStore {
  private connections: Map<string, StoredConnection> = new Map();
  private initialized = false;

  constructor() {
    this.ensureAppDir();
    this.load();
  }

  private ensureAppDir(): void {
    if (!existsSync(APP_DIR)) {
      mkdirSync(APP_DIR, { recursive: true });
      logger.info(`Created app directory: ${APP_DIR}`);
    }
  }

  private load(): void {
    if (this.initialized) return;
    try {
      if (existsSync(CONNECTIONS_FILE)) {
        const data = JSON.parse(readFileSync(CONNECTIONS_FILE, 'utf-8'));
        if (Array.isArray(data)) {
          for (const conn of data) {
            this.connections.set(conn.id, conn);
          }
        }
        logger.info(`Loaded ${this.connections.size} connections from config`);
      }
    } catch (err) {
      logger.warn(`Failed to load connections config: ${err}`);
    }
    this.initialized = true;
  }

  private save(): void {
    try {
      const data = Array.from(this.connections.values());
      writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to save connections config: ${err}`);
    }
  }

  getAll(): StoredConnection[] {
    return Array.from(this.connections.values());
  }

  getById(id: string): StoredConnection | undefined {
    return this.connections.get(id);
  }

  create(conn: Omit<StoredConnection, 'id' | 'createdAt' | 'updatedAt'>): StoredConnection {
    const now = new Date().toISOString();
    const stored: StoredConnection = {
      ...conn,
      id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.connections.set(stored.id, stored);
    this.save();
    logger.info(`Created connection: ${stored.name} (${stored.id})`);
    return stored;
  }

  update(id: string, updates: Partial<StoredConnection>): StoredConnection | null {
    const existing = this.connections.get(id);
    if (!existing) return null;
    const updated: StoredConnection = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.connections.set(id, updated);
    this.save();
    logger.info(`Updated connection: ${updated.name} (${id})`);
    return updated;
  }

  delete(id: string): boolean {
    const result = this.connections.delete(id);
    if (result) {
      this.save();
      logger.info(`Deleted connection: ${id}`);
    }
    return result;
  }

  touchConnected(id: string): void {
    const existing = this.connections.get(id);
    if (existing) {
      existing.lastConnectedAt = new Date().toISOString();
      this.save();
    }
  }
}
