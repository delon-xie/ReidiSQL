/**
 * 密码加密工具 — AES-256-GCM
 * 主密钥（Master Key）存储在 ~/.reidisql/.masterkey（首次使用时自动生成）
 */

import { randomBytes, createCipheriv, createDecipheriv, CipherGCM, DecipherGCM } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from './logger.js';

const APP_DIR = join(homedir(), '.reidisql');
const MASTER_KEY_FILE = join(APP_DIR, '.masterkey');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended
const KEY_LENGTH = 32; // 256 bits

/** 加密结果 */
export interface EncryptedPayload {
  encrypted: true;
  iv: string;       // hex
  data: string;     // hex (ciphertext)
  tag: string;      // hex (auth tag)
}

/** 缓存的主密钥 */
let masterKey: Buffer | null = null;

/** 获取或生成主密钥 */
function getMasterKey(): Buffer {
  if (masterKey) return masterKey;

  if (existsSync(MASTER_KEY_FILE)) {
    const hex = readFileSync(MASTER_KEY_FILE, 'utf-8').trim();
    masterKey = Buffer.from(hex, 'hex');
    if (masterKey.length !== KEY_LENGTH) {
      logger.warn('Master key length mismatch, regenerating');
      masterKey = null;
    } else {
      return masterKey;
    }
  }

  // 生成新主密钥
  masterKey = randomBytes(KEY_LENGTH);
  writeFileSync(MASTER_KEY_FILE, masterKey.toString('hex'), { encoding: 'utf-8', mode: 0o600 });
  logger.info('Generated new master key');
  return masterKey;
}

/** 加密明文 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher: CipherGCM = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = (cipher as any).getAuthTag() as Buffer;

  return {
    encrypted: true,
    iv: iv.toString('hex'),
    data: encrypted,
    tag: tag.toString('hex'),
  };
}

/** 解密密文 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getMasterKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');

  const decipher: DecipherGCM = createDecipheriv(ALGORITHM, key, iv);
  (decipher as any).setAuthTag(tag);

  let decrypted = decipher.update(payload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** 判断是否为加密数据 */
export function isEncrypted(value: unknown): value is EncryptedPayload {
  return typeof value === 'object' && value !== null && (value as any).encrypted === true;
}
