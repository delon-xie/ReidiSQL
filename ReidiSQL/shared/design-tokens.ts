/**
 * ReidiSQL Design Tokens
 * 
 * 设计系统令牌定义。与 Ant Design 5 ConfigProvider 主题系统集成。
 * 使用方式：在 App.tsx 中通过 ConfigProvider theme 注入。
 */

import type { DataTypeCategory, ColorPreset, DataTypeColorMap } from './types';

// ============================================================
// 1. 颜色令牌
// ============================================================

/** 语义色板 - 亮色模式 */
export const lightColors = {
  // 品牌色
  primary: '#1677ff',
  primaryHover: '#4096ff',
  primaryActive: '#0958d9',

  // 功能色
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1677ff',

  // 中性色 - 文本
  textPrimary: 'rgba(0, 0, 0, 0.88)',
  textSecondary: 'rgba(0, 0, 0, 0.65)',
  textTertiary: 'rgba(0, 0, 0, 0.45)',
  textDisabled: 'rgba(0, 0, 0, 0.25)',

  // 中性色 - 背景
  bgBase: '#ffffff',
  bgContainer: '#ffffff',
  bgElevated: '#ffffff',
  bgLayout: '#f5f5f5',
  bgSpotlight: 'rgba(0, 0, 0, 0.85)',

  // 中性色 - 边框
  border: '#d9d9d9',
  borderSecondary: '#f0f0f0',

  // 特殊
  link: '#1677ff',
  linkHover: '#69b1ff',
} as const;

/** 语义色板 - 暗色模式 */
export const darkColors = {
  primary: '#1668dc',
  primaryHover: '#3c89e8',
  primaryActive: '#1554ad',

  success: '#49aa19',
  warning: '#d89614',
  error: '#dc4446',
  info: '#1668dc',

  textPrimary: 'rgba(255, 255, 255, 0.85)',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textTertiary: 'rgba(255, 255, 255, 0.45)',
  textDisabled: 'rgba(255, 255, 255, 0.25)',

  bgBase: '#000000',
  bgContainer: '#141414',
  bgElevated: '#1f1f1f',
  bgLayout: '#000000',
  bgSpotlight: 'rgba(255, 255, 255, 0.85)',

  border: '#424242',
  borderSecondary: '#303030',

  link: '#1668dc',
  linkHover: '#3c89e8',
} as const;

// ============================================================
// 2. 数据类型颜色
// ============================================================

/** 网格文本颜色预设 - 亮色 */
export const gridColorsLight: DataTypeColorMap = {
  integer: '#0000FF',
  real: '#4800FF',
  text: '#008000',
  binary: '#800080',
  temporal: '#800000',
  spatial: '#808000',
  other: '#808080',
};

/** 网格文本颜色预设 - 暗色 */
export const gridColorsDark: DataTypeColorMap = {
  integer: '#8597FF',
  real: '#7D7DD0',
  text: '#73D573',
  binary: '#7F76C9',
  temporal: '#C97373',
  spatial: '#73CECE',
  other: '#C1C173',
};

/** 全黑预设 */
export const gridColorsBlack: DataTypeColorMap = {
  integer: '#000000',
  real: '#000000',
  text: '#000000',
  binary: '#000000',
  temporal: '#000000',
  spatial: '#000000',
  other: '#000000',
};

/** 全白预设 */
export const gridColorsWhite: DataTypeColorMap = {
  integer: '#FFFFFF',
  real: '#FFFFFF',
  text: '#FFFFFF',
  binary: '#FFFFFF',
  temporal: '#FFFFFF',
  spatial: '#FFFFFF',
  other: '#FFFFFF',
};

/** 所有颜色预设 */
export const gridColorPresets: ColorPreset[] = [
  { name: 'Current custom settings', colors: gridColorsLight },
  { name: 'Light', colors: gridColorsLight },
  { name: 'Dark', colors: gridColorsDark },
  { name: 'Black', colors: gridColorsBlack },
  { name: 'White', colors: gridColorsWhite },
];

/** 数据类型友好名称 */
export const dataTypeLabels: Record<DataTypeCategory, string> = {
  integer: 'Integer',
  real: 'Real',
  text: 'Text',
  binary: 'Binary',
  temporal: 'Date/Time',
  spatial: 'Spatial',
  other: 'Other',
};

// ============================================================
// 3. 间距令牌
// ============================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 面板边距 */
export const layout = {
  siderWidth: 240,
  siderCollapsedWidth: 48,
  headerHeight: 48,
  toolbarHeight: 40,
  statusBarHeight: 28,
  tabBarHeight: 36,
  splitterWidth: 4,
  minWindowWidth: 1000,
  minWindowHeight: 700,
} as const;

// ============================================================
// 4. 排版令牌
// ============================================================

export const typography = {
  /** 系统默认字体栈 */
  fontFamilySystem: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'Noto Sans',
    'sans-serif',
  ].join(', '),

  /** 等宽字体栈（SQL 编辑器） */
  fontFamilyMono: [
    'JetBrains Mono',
    'Fira Code',
    'Consolas',
    'Liberation Mono',
    'Menlo',
    'Courier New',
    'monospace',
  ].join(', '),

  /** 字号 */
  fontSize: {
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 18,
    h2: 20,
    h1: 24,
  },

  /** 行高 */
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  /** 字重 */
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ============================================================
// 5. 圆角与阴影
// ============================================================

export const borderRadius = {
  none: 0,
  sm: 4,
  base: 6,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
  base: '0 2px 8px rgba(0, 0, 0, 0.08)',
  md: '0 4px 16px rgba(0, 0, 0, 0.12)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.16)',
} as const;

// ============================================================
// 6. 动画
// ============================================================

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ============================================================
// 7. Ant Design 5 主题配置生成器
// ============================================================

export function createAntdTheme(mode: 'light' | 'dark') {
  const colors = mode === 'dark' ? darkColors : lightColors;

  return {
    token: {
      colorPrimary: colors.primary,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.error,
      colorInfo: colors.info,
      colorTextBase: mode === 'dark' ? '#ffffff' : '#000000',
      colorBgBase: mode === 'dark' ? '#000000' : '#ffffff',
      fontFamily: typography.fontFamilySystem,
      fontSize: typography.fontSize.md,
      borderRadius: borderRadius.base,
    },
    components: {
      Layout: {
        siderBg: mode === 'dark' ? '#141414' : '#ffffff',
        headerBg: mode === 'dark' ? '#1f1f1f' : '#001529',
        bodyBg: colors.bgLayout,
      },
      Tabs: {
        horizontalItemPadding: '8px 16px',
        horizontalItemGutter: 2,
      },
      Tree: {
        directoryNodeSelectedBg: mode === 'dark' ? '#111b26' : '#e6f4ff',
      },
      Table: {
        headerBg: mode === 'dark' ? '#1d1d1d' : '#fafafa',
        rowHoverBg: mode === 'dark' ? '#262626' : '#f5f5f5',
        cellPaddingBlock: 4,
        cellPaddingInline: 8,
      },
      Menu: {
        itemHeight: 32,
      },
    },
  };
}

// ============================================================
// 8. 编辑器语法高亮预设
// ============================================================

export const editorColorPresets = {
  Light: {
    keyword: { foreground: '#0000FF', bold: true },
    dataType: { foreground: '#0000FF', bold: true },
    function: { foreground: '#800080' },
    identifier: { foreground: '#000000' },
    quotedIdentifier: { foreground: '#008080' },
    string: { foreground: '#FF0000' },
    number: { foreground: '#800000' },
    comment: { foreground: '#008000', italic: true },
    variable: { foreground: '#800080' },
    operator: { foreground: '#000000' },
  },
  Dark: {
    keyword: { foreground: '#569CD6', bold: true },
    dataType: { foreground: '#4EC9B0' },
    function: { foreground: '#DCDCAA' },
    identifier: { foreground: '#9CDCFE' },
    quotedIdentifier: { foreground: '#4EC9B0' },
    string: { foreground: '#CE9178' },
    number: { foreground: '#B5CEA8' },
    comment: { foreground: '#6A9955', italic: true },
    variable: { foreground: '#9CDCFE' },
    operator: { foreground: '#D4D4D4' },
  },
  Material: {
    keyword: { foreground: '#C792EA', bold: true },
    dataType: { foreground: '#FFCB6B' },
    function: { foreground: '#82AAFF' },
    identifier: { foreground: '#EEFFFF' },
    quotedIdentifier: { foreground: '#FFCB6B' },
    string: { foreground: '#C3E88D' },
    number: { foreground: '#F78C6C' },
    comment: { foreground: '#546E7A', italic: true },
    variable: { foreground: '#89DDFF' },
    operator: { foreground: '#89DDFF' },
  },
} as const;

// ============================================================
// 9. CSS 自定义属性（注入到 :root）
// ============================================================

export const cssVariables = {
  light: {
    '--rs-color-primary': lightColors.primary,
    '--rs-color-bg-container': lightColors.bgContainer,
    '--rs-color-bg-layout': lightColors.bgLayout,
    '--rs-color-text': lightColors.textPrimary,
    '--rs-color-text-secondary': lightColors.textSecondary,
    '--rs-color-border': lightColors.border,
    '--rs-color-null-bg': '#f0f0f0',
    '--rs-color-row-even': '#ffffff',
    '--rs-color-row-odd': '#fafafa',
    '--rs-color-highlight-same': '#fff3b0',
    '--rs-font-mono': typography.fontFamilyMono,
    '--rs-font-system': typography.fontFamilySystem,
    '--rs-font-size-editor': `${typography.fontSize.base}px`,
    '--rs-font-size-grid': `${typography.fontSize.base}px`,
    '--rs-layout-sider-width': `${layout.siderWidth}px`,
    '--rs-layout-header-height': `${layout.headerHeight}px`,
    '--rs-layout-statusbar-height': `${layout.statusBarHeight}px`,
  },
  dark: {
    '--rs-color-primary': darkColors.primary,
    '--rs-color-bg-container': darkColors.bgContainer,
    '--rs-color-bg-layout': darkColors.bgLayout,
    '--rs-color-text': darkColors.textPrimary,
    '--rs-color-text-secondary': darkColors.textSecondary,
    '--rs-color-border': darkColors.border,
    '--rs-color-null-bg': '#2a2a2a',
    '--rs-color-row-even': '#141414',
    '--rs-color-row-odd': '#1a1a1a',
    '--rs-color-highlight-same': '#3d3d00',
    '--rs-font-mono': typography.fontFamilyMono,
    '--rs-font-system': typography.fontFamilySystem,
    '--rs-font-size-editor': `${typography.fontSize.base}px`,
    '--rs-font-size-grid': `${typography.fontSize.base}px`,
    '--rs-layout-sider-width': `${layout.siderWidth}px`,
    '--rs-layout-header-height': `${layout.headerHeight}px`,
    '--rs-layout-statusbar-height': `${layout.statusBarHeight}px`,
  },
} as const;
