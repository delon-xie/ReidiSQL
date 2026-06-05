/**
 * MySQL 用户管理服务
 * 提供用户 CRUD 和权限操作
 */

import { getConnectionManager } from './connectionService.js';
import { logger } from '../utils/logger.js';

/** 用户信息 */
export interface UserInfo {
  username: string;
  host: string;
  plugin: string;
  isRole: boolean;
  accountLocked: boolean;
  passwordExpired: boolean;
  sslType: string;
  maxConnections?: number;
  maxUserConnections?: number;
  maxQuestions?: number;
  maxUpdates?: number;
  passwordLastChanged?: string;
  passwordLifetime?: number;
  privileges: PrivilegeGrant[];
  roles: string[];
}

/** 权限授予 */
export interface PrivilegeGrant {
  privilege: string;
  scope: 'global' | 'database' | 'table' | 'column' | 'routine';
  target: string;
  columns?: string[];
  grantOption: boolean;
}

/** 创建用户请求 */
export interface CreateUserRequest {
  username: string;
  host: string;
  password?: string;
  plugin?: string;
  privileges?: PrivilegeGrant[];
  roles?: string[];
  ssl?: {
    requireSSL?: boolean;
    requireX509?: boolean;
  };
  resourceLimits?: {
    maxQueriesPerHour?: number;
    maxUpdatesPerHour?: number;
    maxConnectionsPerHour?: number;
    maxUserConnections?: number;
  };
}

/** 修改权限请求 */
export interface ModifyPrivilegesRequest {
  grant?: PrivilegeGrant[];
  revoke?: PrivilegeGrant[];
}

export class AdminService {
  /** 获取用户列表 */
  async getUsers(connectionId: string): Promise<UserInfo[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);

    const [rows] = await pool.query(`
      SELECT 
        User, Host, plugin, 
        account_locked, password_expired, ssl_type,
        max_questions, max_updates, max_connections, max_user_connections,
        password_last_changed, password_lifetime
      FROM mysql.user
      ORDER BY User, Host
    `);

    const users: UserInfo[] = (rows as any[]).map(row => ({
      username: row.User,
      host: row.Host,
      plugin: row.plugin || '',
      isRole: false,
      accountLocked: row.account_locked === 'Y',
      passwordExpired: row.password_expired === 'Y',
      sslType: row.ssl_type || '',
      maxConnections: row.max_connections || undefined,
      maxUserConnections: row.max_user_connections || undefined,
      maxQuestions: row.max_questions || undefined,
      maxUpdates: row.max_updates || undefined,
      passwordLastChanged: row.password_last_changed?.toISOString?.() || row.password_last_changed || undefined,
      passwordLifetime: row.password_lifetime || undefined,
      privileges: [],
      roles: [],
    }));

    return users;
  }

  /** 创建用户 */
  async createUser(connectionId: string, req: CreateUserRequest): Promise<{ success: boolean; message: string }> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      // CREATE USER
      let sql = `CREATE USER '${this.escape(req.username)}'@'${this.escape(req.host)}'`;

      // 认证
      if (req.plugin) {
        sql += ` IDENTIFIED WITH ${req.plugin}`;
        if (req.password) sql += ` BY '${this.escape(req.password)}'`;
      } else if (req.password) {
        sql += ` IDENTIFIED BY '${this.escape(req.password)}'`;
      }

      // SSL
      if (req.ssl?.requireX509) {
        sql += ' REQUIRE X509';
      } else if (req.ssl?.requireSSL) {
        sql += ' REQUIRE SSL';
      }

      // 资源限制
      if (req.resourceLimits) {
        const limits: string[] = [];
        if (req.resourceLimits.maxQueriesPerHour) limits.push(`MAX_QUERIES_PER_HOUR ${req.resourceLimits.maxQueriesPerHour}`);
        if (req.resourceLimits.maxUpdatesPerHour) limits.push(`MAX_UPDATES_PER_HOUR ${req.resourceLimits.maxUpdatesPerHour}`);
        if (req.resourceLimits.maxConnectionsPerHour) limits.push(`MAX_CONNECTIONS_PER_HOUR ${req.resourceLimits.maxConnectionsPerHour}`);
        if (req.resourceLimits.maxUserConnections) limits.push(`MAX_USER_CONNECTIONS ${req.resourceLimits.maxUserConnections}`);
        if (limits.length > 0) sql += ' WITH ' + limits.join(' ');
      }

      await conn.query(sql);
      logger.info(`Created user: ${req.username}@${req.host}`);

      // GRANT 权限
      if (req.privileges && req.privileges.length > 0) {
        for (const priv of req.privileges) {
          await this.grantPrivilege(conn, req.username, req.host, priv);
        }
      }

      // GRANT 角色
      if (req.roles && req.roles.length > 0) {
        for (const role of req.roles) {
          await conn.query(`GRANT '${this.escape(role)}' TO '${this.escape(req.username)}'@'${this.escape(req.host)}'`);
        }
      }

      return { success: true, message: `User ${req.username}@${req.host} created` };
    } finally {
      conn.release();
    }
  }

  /** 修改用户 */
  async modifyUser(connectionId: string, username: string, host: string, req: Partial<CreateUserRequest>): Promise<{ success: boolean; message: string }> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      const parts: string[] = [];

      // 修改密码
      if (req.password !== undefined) {
        if (req.password) {
          parts.push(`IDENTIFIED BY '${this.escape(req.password)}'`);
        } else {
          parts.push('IDENTIFIED BY \'\'');
        }
      }

      // 账户锁定
      if (req.resourceLimits) {
        if (req.resourceLimits.maxQueriesPerHour !== undefined) parts.push(`MAX_QUERIES_PER_HOUR ${req.resourceLimits.maxQueriesPerHour}`);
        if (req.resourceLimits.maxUpdatesPerHour !== undefined) parts.push(`MAX_UPDATES_PER_HOUR ${req.resourceLimits.maxUpdatesPerHour}`);
        if (req.resourceLimits.maxConnectionsPerHour !== undefined) parts.push(`MAX_CONNECTIONS_PER_HOUR ${req.resourceLimits.maxConnectionsPerHour}`);
        if (req.resourceLimits.maxUserConnections !== undefined) parts.push(`MAX_USER_CONNECTIONS ${req.resourceLimits.maxUserConnections}`);
      }

      if (parts.length > 0) {
        await conn.query(`ALTER USER '${this.escape(username)}'@'${this.escape(host)}' ${parts.join(' ')}`);
        logger.info(`Modified user: ${username}@${host}`);
      }

      return { success: true, message: `User ${username}@${host} modified` };
    } finally {
      conn.release();
    }
  }

  /** 删除用户 */
  async dropUser(connectionId: string, username: string, host: string): Promise<{ success: boolean; message: string }> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);

    await pool.query(`DROP USER '${this.escape(username)}'@'${this.escape(host)}'`);
    logger.info(`Dropped user: ${username}@${host}`);

    return { success: true, message: `User ${username}@${host} dropped` };
  }

  /** 获取用户权限 */
  async getUserPrivileges(connectionId: string, username: string, host: string): Promise<PrivilegeGrant[]> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);

    const [rows] = await pool.query(`SHOW GRANTS FOR '${this.escape(username)}'@'${this.escape(host)}'`);

    const privileges: PrivilegeGrant[] = [];
    for (const row of rows as any[]) {
      const grantStr = Object.values(row)[0] as string;
      const parsed = this.parseGrant(grantStr);
      privileges.push(...parsed);
    }

    return privileges;
  }

  /** 修改权限 */
  async modifyPrivileges(
    connectionId: string,
    username: string,
    host: string,
    req: ModifyPrivilegesRequest
  ): Promise<{ success: boolean; message: string }> {
    const connManager = getConnectionManager();
    const pool = connManager.getMySQLPool(connectionId);
    const conn = await pool.getConnection();

    try {
      // REVOKE
      if (req.revoke && req.revoke.length > 0) {
        for (const priv of req.revoke) {
          await this.revokePrivilege(conn, username, host, priv);
        }
      }

      // GRANT
      if (req.grant && req.grant.length > 0) {
        for (const priv of req.grant) {
          await this.grantPrivilege(conn, username, host, priv);
        }
      }

      await conn.query('FLUSH PRIVILEGES');
      logger.info(`Modified privileges for: ${username}@${host}`);

      return { success: true, message: `Privileges modified for ${username}@${host}` };
    } finally {
      conn.release();
    }
  }

  // ==================== 内部方法 ====================

  private async grantPrivilege(conn: any, username: string, host: string, priv: PrivilegeGrant): Promise<void> {
    const privStr = priv.privilege.toUpperCase();
    const target = this.buildTarget(priv);
    const withGrant = priv.grantOption ? ' WITH GRANT OPTION' : '';
    await conn.query(`GRANT ${privStr} ON ${target} TO '${this.escape(username)}'@'${this.escape(host)}'${withGrant}`);
  }

  private async revokePrivilege(conn: any, username: string, host: string, priv: PrivilegeGrant): Promise<void> {
    const privStr = priv.privilege.toUpperCase();
    const target = this.buildTarget(priv);
    await conn.query(`REVOKE ${privStr} ON ${target} FROM '${this.escape(username)}'@'${this.escape(host)}'`);
  }

  private buildTarget(priv: PrivilegeGrant): string {
    if (priv.scope === 'global') return '*.*';
    if (priv.scope === 'database') return `\`${priv.target}\`.*`;
    if (priv.scope === 'table') {
      const parts = priv.target.split('.');
      if (parts.length === 2) return `\`${parts[0]}\`.\`${parts[1]}\``;
      return `\`${priv.target}\`.*`;
    }
    return '*.*';
  }

  private parseGrant(grantStr: string): PrivilegeGrant[] {
    const results: PrivilegeGrant[] = [];

    // GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION
    const match = grantStr.match(/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO/i);
    if (!match) return results;

    const privStr = match[1].trim();
    const target = match[2].trim();
    const hasGrantOption = /WITH\s+GRANT\s+OPTION/i.test(grantStr);

    // 解析权限
    const privs = privStr === 'ALL PRIVILEGES' || privStr === 'USAGE'
      ? [privStr]
      : privStr.split(',').map(s => s.trim());

    // 解析 scope
    let scope: PrivilegeGrant['scope'] = 'global';
    if (target === '*.*') scope = 'global';
    else if (target.endsWith('.*')) scope = 'database';
    else scope = 'table';

    for (const priv of privs) {
      results.push({
        privilege: priv,
        scope,
        target: target.replace(/`/g, ''),
        grantOption: hasGrantOption,
      });
    }

    return results;
  }

  private escape(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }
}

// 全局单例
let instance: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!instance) {
    instance = new AdminService();
  }
  return instance;
}
