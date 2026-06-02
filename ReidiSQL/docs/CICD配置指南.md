# ReidiSQL CI/CD 配置指南

> 本文档描述 ReidiSQL 项目的持续集成和持续部署配置，包括自动化测试、构建和发布流程。

## 目录

1. [CI/CD 概览](#1-cicd-概览)
2. [GitHub Actions 工作流](#2-github-actions-工作流)
3. [自动化测试](#3-自动化测试)
4. [构建配置](#4-构建配置)
5. [发布流程](#5-发布流程)
6. [代码质量](#6-代码质量)
7. [部署策略](#7-部署策略)

---

## 1. CI/CD 概览

### 1.1 工具选择

- **CI/CD 平台**: GitHub Actions
- **包管理**: npm / pnpm
- **测试框架**: Vitest (单元测试), Playwright (E2E)
- **代码质量**: ESLint, Prettier, SonarQube
- **制品存储**: GitHub Releases
- **通知**: Discord, Email

### 1.2 工作流概览

```
Pull Request
    │
    ├──→ Lint & Type Check
    │         │
    │         ▼
    │    Unit Tests
    │         │
    │         ▼
    │    Build Test
    │         │
    │         ▼
    │    Code Review
    │         │
    │         ▼
    └──→ Merge to Main
              │
              ▼
         Integration Tests
              │
              ▼
         Build Release
              │
              ▼
         Publish Release
```

---

## 2. GitHub Actions 工作流

### 2.1 主工作流配置

`.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  RUST_VERSION: '1.75'

jobs:
  # 代码质量检查
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run ESLint
        run: pnpm lint
      
      - name: Type check
        run: pnpm type-check

  # 单元测试
  unit-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run unit tests
        run: pnpm test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  # 构建测试
  build-test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: ${{ env.RUST_VERSION }}
      
      - name: Install dependencies (Ubuntu)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            build-essential \
            curl \
            wget \
            libssl-dev \
            libgtk-3-dev \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build frontend
        run: pnpm build:frontend
      
      - name: Build Tauri
        run: pnpm build:tauri
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # E2E 测试
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [build-test]
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
      
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          TEST_DB_MYSQL_HOST: localhost
          TEST_DB_MYSQL_PORT: 3306
          TEST_DB_PG_HOST: localhost
          TEST_DB_PG_PORT: 5432

  # 发布（仅在 main 分支）
  release:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ${{ matrix.os }}
    needs: [lint-and-type-check, unit-tests, e2e-tests]
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: ${{ env.RUST_VERSION }}
      
      - name: Install dependencies (Ubuntu)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            build-essential \
            curl \
            wget \
            libssl-dev \
            libgtk-3-dev \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'ReidiSQL v__VERSION__'
          releaseBody: 'See the assets to download this version and install.'
          releaseDraft: true
          prerelease: false
```

### 2.2 定时安全扫描

`.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 6 * * 1'  # 每周一早上 6 点
  workflow_dispatch:

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
      
      - name: Run cargo audit
        run: |
          cargo install cargo-audit
          cd src-tauri && cargo audit

  codeql-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, typescript
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
```

---

## 3. 自动化测试

### 3.1 单元测试配置

`vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
    },
  },
});
```

### 3.2 E2E 测试配置

`playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3.3 测试数据库初始化

`tests/setup-database.sql`:

```sql
-- 创建测试数据库
CREATE DATABASE IF NOT EXISTS test_reidisql;
USE test_reidisql;

-- 创建测试表
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 插入测试数据
INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Charlie', 'charlie@example.com');

INSERT INTO orders (user_id, amount, status) VALUES
  (1, 99.99, 'completed'),
  (2, 149.99, 'pending'),
  (1, 79.99, 'completed');
```

---

## 4. 构建配置

### 4.1 前端构建

`frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          monaco: ['monaco-editor'],
          aggrid: ['ag-grid-community', 'ag-grid-react'],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

### 4.2 Tauri 构建

`src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "pnpm dev:frontend",
    "beforeBuildCommand": "pnpm build:frontend",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../frontend/dist"
  },
  "app": {
    "windows": [
      {
        "title": "ReidiSQL",
        "width": 1400,
        "height": 900,
        "resizable": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": ["en-US", "zh-CN"]
      }
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "11.0",
      "exceptionDomain": "",
      "signingIdentity": null,
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": []
      }
    }
  }
}
```

### 4.3 Node.js 服务构建

`node-backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 5. 发布流程

### 5.1 版本管理

使用 `changesets` 管理版本：

```bash
# 安装
pnpm add -D @changesets/cli

# 初始化
pnpm changeset init

# 添加变更
pnpm changeset

# 版本更新
pnpm changeset version

# 发布
pnpm changeset publish
```

### 5.2 发布清单

`.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@2.3.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### 5.3 自动发布工作流

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 6. 代码质量

### 6.1 ESLint 配置

`.eslintrc.json`:

```json
{
  "root": true,
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "no-console": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### 6.2 Prettier 配置

`.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always"
}
```

### 6.3 Husky 配置

`package.json`:

```json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

`.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
```

`.husky/commit-msg`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm commitlint --edit "$1"
```

### 6.4 Commitlint 配置

`commitlint.config.js`:

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case']],
  },
};
```

---

## 7. 部署策略

### 7.1 开发环境

```bash
# 启动开发环境
npm run dev

# 分别启动
npm run dev:backend    # Node.js 服务
npm run dev:frontend   # 前端开发服务器
npm run dev:tauri      # Tauri 应用
```

### 7.2 生产环境

```bash
# 构建生产版本
npm run build

# 启动应用
./reidisql  # Linux/macOS
reidisql.exe  # Windows
```

### 7.3 分发格式

| 平台 | 格式 | 构建命令 |
|------|------|---------|
| Windows | NSIS Installer | `npm run build:tauri -- --target x86_64-pc-windows-msvc` |
| Windows | MSI | `npm run build:tauri -- --target x86_64-pc-windows-msvc` |
| macOS | DMG | `npm run build:tauri -- --target x86_64-apple-darwin` |
| macOS | Universal | `npm run build:tauri -- --target universal-apple-darwin` |
| Linux | AppImage | `npm run build:tauri -- --target x86_64-unknown-linux-gnu` |
| Linux | deb | `npm run build:tauri -- --target x86_64-unknown-linux-gnu` |

### 7.4 自动更新配置

```typescript
// Tauri 自动更新
import { checkUpdate, installUpdate } from '@tauri-apps/plugin-updater';

async function checkForUpdates() {
  const update = await checkUpdate();
  
  if (update?.available) {
    console.log(`Update available: ${update.version}`);
    
    await installUpdate((progress, total) => {
      console.log(`Downloaded ${progress} of ${total}`);
    });
    
    console.log('Update installed. Restart to apply.');
  }
}
```

---

## 附录

### A. 环境变量

`.env.development`:

```env
NODE_ENV=development
API_PORT=0  # 随机端口
LOG_LEVEL=debug
ENABLE_CORS=true
```

`.env.production`:

```env
NODE_ENV=production
API_PORT=0
LOG_LEVEL=info
ENABLE_CORS=false
```

### B. Docker 配置（用于测试）

`docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: test_db
    ports:
      - "3306:3306"
    volumes:
      - ./tests/setup-database.sql:/docker-entrypoint-initdb.d/init.sql
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test_db
    ports:
      - "5432:5432"
    volumes:
      - ./tests/setup-database.sql:/docker-entrypoint-initdb.d/init.sql
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

### C. 性能基准

```yaml
# 构建性能目标
frontend_build: < 30s
tauri_build: < 120s
unit_tests: < 60s
e2e_tests: < 300s

# 应用性能目标
startup_time: < 5s
query_response: < 2s
memory_usage: < 500MB
```

---

**配置版本**: 1.0.0  
**最后更新**: 2026-06-01  
**维护者**: ReidiSQL 开发团队
