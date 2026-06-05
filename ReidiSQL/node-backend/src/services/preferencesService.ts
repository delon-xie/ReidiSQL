/**
 * 偏好设置服务
 * 持久化到 ~/.reidisql/preferences.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

const APP_DIR = join(homedir(), '.reidisql');
const PREFS_FILE = join(APP_DIR, 'preferences.json');

/** 应用偏好设置 */
export interface AppPreferences {
  general: {
    language: string;
    theme: 'light' | 'dark' | 'system';
    guiFont: { name: string; size: number };
    allowMultipleInstances: boolean;
    autoReconnect: boolean;
    restoreLastDatabase: boolean;
    updateCheck: { enabled: boolean; intervalDays: number; checkBuilds: boolean };
    usageStatistics: boolean;
    wheelZoom: boolean;
    displayBars: boolean;
    mysqlBinariesPath: string;
    customSnippetsDirectory: string;
    webSearchBaseUrl: string;
  };
  editor: {
    font: { name: string; size: number };
    tabWidth: number;
    tabsToSpaces: boolean;
    autoUppercase: boolean;
    completionProposal: { enabled: boolean; delay: number; searchOnMid: boolean };
    colorPreset: string;
    lineBreakStyle: string;
    activeLineColor: string;
    matchingBraceForeground: string;
    matchingBraceBackground: string;
  };
  grid: {
    font: { name: string; size: number };
    maxColumnWidth: number;
    rowsPerStep: number;
    maxRows: number;
    maxLineCount: number;
    nullBackground: string;
    rowBackgroundEven: string;
    rowBackgroundOdd: string;
    highlightSameText: string;
    localNumberFormat: boolean;
    lowercaseHex: boolean;
    showRowId: boolean;
    columnHeaderClickSort: boolean;
    realTrailingZeros: number;
    longSortRowThreshold: number;
    maxQueryResults: number;
    hintsOnResultTabs: boolean;
  };
  logging: {
    maxLines: number;
    snipLength: number;
    events: Record<string, boolean>;
    logToFile: boolean;
    logDirectory: string;
    showTimestamp: boolean;
    horizontalScrollbar: boolean;
    queryHistory: { enabled: boolean; keepDays: number };
  };
  shortcuts: Record<string, { key1: string; key2?: string }>;
  files: {
    promptSaveOnClose: boolean;
    restoreTabs: boolean;
    tabCloseOnDoubleClick: boolean;
    tabCloseOnMiddleClick: boolean;
    tabIconsGrayscaleMode: number;
    reformatter: string;
  };
}

/** 默认偏好 */
const DEFAULT_PREFERENCES: AppPreferences = {
  general: {
    language: 'zh_CN',
    theme: 'system',
    guiFont: { name: 'Segoe UI', size: 9 },
    allowMultipleInstances: false,
    autoReconnect: true,
    restoreLastDatabase: true,
    updateCheck: { enabled: true, intervalDays: 7, checkBuilds: false },
    usageStatistics: false,
    wheelZoom: true,
    displayBars: true,
    mysqlBinariesPath: '',
    customSnippetsDirectory: '',
    webSearchBaseUrl: 'https://www.google.com/search?q=%s',
  },
  editor: {
    font: { name: 'Consolas', size: 12 },
    tabWidth: 2,
    tabsToSpaces: true,
    autoUppercase: true,
    completionProposal: { enabled: true, delay: 300, searchOnMid: false },
    colorPreset: 'default',
    lineBreakStyle: 'lf',
    activeLineColor: '#1a3050',
    matchingBraceForeground: '',
    matchingBraceBackground: '#e0e0e0',
  },
  grid: {
    font: { name: 'Segoe UI', size: 9 },
    maxColumnWidth: 200,
    rowsPerStep: 1000,
    maxRows: 0,
    maxLineCount: 3,
    nullBackground: '#f5f5f5',
    rowBackgroundEven: '#ffffff',
    rowBackgroundOdd: '#f8f8f8',
    highlightSameText: '#ffff00',
    localNumberFormat: true,
    lowercaseHex: false,
    showRowId: true,
    columnHeaderClickSort: true,
    realTrailingZeros: 0,
    longSortRowThreshold: 100000,
    maxQueryResults: 1000,
    hintsOnResultTabs: true,
  },
  logging: {
    maxLines: 10000,
    snipLength: 200,
    events: { queries: true, connections: true, errors: true },
    logToFile: false,
    logDirectory: '',
    showTimestamp: true,
    horizontalScrollbar: false,
    queryHistory: { enabled: true, keepDays: 30 },
  },
  shortcuts: {},
  files: {
    promptSaveOnClose: true,
    restoreTabs: true,
    tabCloseOnDoubleClick: false,
    tabCloseOnMiddleClick: true,
    tabIconsGrayscaleMode: 0,
    reformatter: '',
  },
};

export class PreferencesService {
  private preferences: AppPreferences;
  private initialized = false;

  constructor() {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.load();
  }

  private load(): void {
    if (this.initialized) return;
    try {
      if (existsSync(PREFS_FILE)) {
        const data = JSON.parse(readFileSync(PREFS_FILE, 'utf-8'));
        // 深度合并（保留默认值）
        this.preferences = this.deepMerge(DEFAULT_PREFERENCES, data);
        logger.info('Loaded preferences from config');
      }
    } catch (err) {
      logger.warn(`Failed to load preferences: ${err}`);
    }
    this.initialized = true;
  }

  private save(): void {
    try {
      writeFileSync(PREFS_FILE, JSON.stringify(this.preferences, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to save preferences: ${err}`);
    }
  }

  /** 获取所有偏好设置 */
  getPreferences(): AppPreferences {
    return this.preferences;
  }

  /** 更新偏好设置（深度合并） */
  updatePreferences(updates: Partial<AppPreferences>): AppPreferences {
    this.preferences = this.deepMerge(this.preferences, updates);
    this.save();
    logger.info('Preferences updated');
    return this.preferences;
  }

  /** 深度合并对象 */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key of Object.keys(source) as Array<keyof T>) {
      const val = source[key];
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = this.deepMerge(result[key] as any, val as any);
      } else if (val !== undefined) {
        result[key] = val as any;
      }
    }
    return result;
  }
}

// 全局单例
let instance: PreferencesService | null = null;

export function getPreferencesService(): PreferencesService {
  if (!instance) {
    instance = new PreferencesService();
  }
  return instance;
}
