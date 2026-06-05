# ReidiSQL 新项目

> ReidiSQL 是 HeidiSQL 的现代化重构版本，采用 Tauri + React + Node.js 技术栈，提供跨平台、高性能的数据库管理体验。

## 📁 目录说明

```
ReidiSQL/
├── README.md                    # 本文件，项目概览
├── docs/                        # 项目文档
│   ├── README.md                # 文档索引
│   ├── 新架构开发指南.md        # 开发环境设置
│   ├── 代码规范.md              # 编码规范
│   ├── 架构设计文档.md          # 系统架构设计
│   ├── API接口规范.md           # API 接口定义
│   ├── CICD配置指南.md          # CI/CD 配置
│   ├── 项目文档体系完成报告.md  # 文档总结
│   └── [其他历史文档]
│
├── src-tauri/                   # [待创建] Tauri/Rust 后端
├── frontend/                    # [待创建] React 前端
├── node-backend/                # [待创建] Node.js 数据库服务
├── shared/                      # [待创建] 共享类型定义
└── scripts/                     # [待创建] 构建脚本
```

## 🚀 快速开始

### 第一步：阅读文档

在开始编码之前，建议按以下顺序阅读文档：

1. **[文档索引](./docs/README.md)** - 了解文档结构
2. **[新架构开发指南](./docs/新架构开发指南.md)** - 设置开发环境
3. **[架构设计文档](./docs/架构设计文档.md)** - 理解系统架构
4. **[代码规范](./docs/代码规范.md)** - 了解编码标准
5. **[API接口规范](./docs/API接口规范.md)** - 了解接口设计

### 第二步：准备开发环境

按照 [新架构开发指南](./docs/新架构开发指南.md) 安装必需的软件：

- **Node.js** 22 LTS
- Rust 1.75+
- Git 2.30+
- VS Code（推荐）

### 第三步：搭建项目脚手架

**选项 A：使用自动化脚本（推荐）**
```bash
# 等待脚本创建完成后运行
./scripts/init.sh
```

**选项 B：手动创建**
按照 [新架构开发指南](./docs/新架构开发指南.md) 中的步骤手动创建。

### 第四步：开始开发

```bash
cd ReidiSQL

   # 终端 1: 前端
   cd frontend && npm run dev

   # 终端 2: Node.js 后端
   cd node-backend && npm run dev

   # 终端 3: Tauri 应用
   cd src-tauri && cargo tauri dev

# 运行测试
npm test

# 构建生产版本
npm run build
```

## 📋 项目状态

### ✅ 已完成
- [x] 可行性研究
- [x] 架构设计
- [x] 技术栈选型
- [x] 开发规范
- [x] API 设计
- [x] CI/CD 规划
- [x] 文档体系（14份文档）

### 🔧 进行中
- [ ] 项目脚手架搭建
- [ ] 核心模块开发
- [ ] 数据库驱动实现

### 📅 计划中
- [ ] MVP 版本（Month 6）
- [ ] v0.5.0（Month 12）
- [ ] v1.0.0（Month 18）

## 🎯 下一步行动

### 立即可做（今天）
1. ✅ 阅读文档
2. ⏳ 确认项目基础信息
3. ⏳ 准备开发环境

### 本周可做
4. ⏳ 搭建项目脚手架
5. ⏳ 验证技术栈
6. ⏳ 完成 Hello World 示例

### 本月可做
7. ⏳ 实现核心功能
8. ⏳ 完成 MVP 原型
9. ⏳ 配置 CI/CD

## 📞 获取帮助

- 📖 **文档**: [docs/README.md](./docs/README.md)
- 🐛 **问题**: [GitHub Issues](https://github.com/your-org/reidisql/issues)
- 💬 **讨论**: [GitHub Discussions](https://github.com/your-org/reidisql/discussions)
- 📧 **联系**: contact@reidisql.com

## 📝 许可证

本项目采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。

---

**项目启动时间**: 2026-06-01  
**当前版本**: 0.0.1 (规划中)  
**状态**: 📋 文档完成，准备启动
