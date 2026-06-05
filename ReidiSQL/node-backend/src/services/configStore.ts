/**
 * 连接配置持久化存储
 * 使用 JSON 文件存储连接配置到 ~/.reidisql/connections.json
 * 密码字段自动使用 AES-256-GCM 加密存储
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt, isEncrypted, EncryptedPayload } from '../utils/crypto.js';

const APP_DIR = join(homedir(), '.reidisql');
const CONNECTIONS_FILE = join(APP_DIR, 'connections.json');

/** 敏感字段值类型：可能是明文（旧版兼容）或加密载荷 */
type SecretValue = string | EncryptedPayload | undefined;

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

/** 加密单个敏感字段（如果非空） */
function encryptField(value: string | undefined): SecretValue {
  if (!value) return undefined;
  return encrypt(value);
}

/** 解密单个敏感字段（兼容旧版明文） */
function decryptField(value: SecretValue): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value; // 旧版明文兼容
  if (isEncrypted(value)) {
    try {
      return decrypt(value);
    } catch (err: any) {
      logger.warn(`Failed to decrypt field: ${err.message}`);
      return undefined;
    }
  }
  return undefined;
}

/** 对连接配置中的敏感字段加密（用于持久化） */
function encryptConnection(conn: StoredConnection): any {
  return {
    ...conn,
    password: encryptField(conn.password),
    ssh: conn.ssh ? {
      ...conn.ssh,
      password: encryptField(conn.ssh.password),
    } : undefined,
  };
}

/** 对连接配置中的敏感字段解密（用于内存使用） */
function decryptConnection(raw: any): StoredConnection {
  return {
    ...raw,
    password: decryptField(raw.password),
    ssh: raw.ssh ? {
      ...raw.ssh,
      password: decryptField(raw.ssh.password),
    } : undefined,
  } as StoredConnection;
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
          for (const raw of data) {
            // 自动解密敏感字段（兼容旧版明文）
            const conn = decryptConnection(raw);
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
      // 加密敏感字段后写入
      const data = Array.from(this.connections.values()).map(encryptConnection);
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
