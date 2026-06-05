/**
 * 数据库驱动工厂
 * 根据连接类型返回对应的驱动实例，遵循开闭原则
 */

import { DatabaseDriver } from './DatabaseDriver.js';
import { MysqlDriver } from './MysqlDriver.js';
import { PgDriver } from './PgDriver.js';
import { SqliteDriver } from './SqliteDriver.js';

/** 驱动实例缓存（单例） */
const driverCache = new Map<string, DatabaseDriver>();

/** 获取对应类型的驱动实例 */
export function getDriver(type: string): DatabaseDriver {
  // 规范化类型标识
  const key = normalizeType(type);

  if (driverCache.has(key)) {
    return driverCache.get(key)!;
  }

  let driver: DatabaseDriver;
  switch (key) {
    case 'mysql':
      driver = new MysqlDriver();
      break;
    case 'postgresql':
      driver = new PgDriver();
      break;
    case 'sqlite':
      driver = new SqliteDriver();
      break;
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }

  driverCache.set(key, driver);
  return driver;
}

/** 将连接类型字符串规范化为内部标识 */
function normalizeType(type: string): string {
  const t = type.toLowerCase();
  if (t === 'mariadb') return 'mysql'; // MariaDB 使用 MySQL 驱动
  return t;
}

/** 导出所有驱动类供外部直接使用 */
export { MysqlDriver, PgDriver, SqliteDriver };
export type { DatabaseDriver } from './DatabaseDriver.js';
