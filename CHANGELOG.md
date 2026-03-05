# Changelog

All notable changes to Signal Market will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.0-alpha] - 2026-03-05

### Added
- **L0 数据接入层**: 支持多数据源实时接入
  - 新闻API集成
  - 社交媒体监控
  - 政策文档解析

- **L1 去噪层**: 智能过滤噪声
  - 垃圾信息识别
  - 重复内容合并
  - 质量评分

- **L2 事件图谱**: 事件关系网络
  - 事件实体识别
  - 因果关系推断
  - 阶段检测

- **L3 概率引擎**: 可解释的概率预测
  - 24小时/7天/30天概率曲线
  - 驱动因子分析
  - 预测市场集成

- **L4 API层**: RESTful接口
  - `/events` - 事件列表
  - `/events/{id}/probability` - 概率曲线
  - `/lenses/{user}/daily-brief` - 用户简报
  - `/watch` - 创建监控
  - `/signals/health` - 健康检查
  - `/evidence/{eventId}` - 证据链
  - `/predictions` - 预测列表

- **用户透镜**:
  - `lens_a_stock` - A股板块玩家 (08:30推送)
  - `lens_us_macro` - 美股宏观 (16:00推送)
  - `lens_crypto_event` - 币圈事件 (trigger推送)

- **SDK支持**:
  - Python SDK
  - JavaScript/Node.js SDK

- **CLI工具**: 命令行交互
  - 健康检查
  - 事件查询
  - 简报获取
  - 预测查看

- **部署支持**:
  - Docker
  - Docker Compose
  - Cloudflare Pages

### Performance
- Pipeline 执行时间: ~1.8s
- API 延迟: <2ms
- 系统可用性: 99.5%

### Known Issues
- 预测市场数据源有限
- 部分用户透镜仍在测试中

---

## [v0.9.0-beta] - 2026-02-15

### Added
- 初始Beta版本
- 基础事件检测
- 简单概率估算
- 基础API端点

### Changed
- 重构数据管道架构
- 优化去噪算法

---

## [v0.5.0-alpha] - 2026-01-20

### Added
- PoC概念验证
- 最小可行性产品
- 基础CLI工具

---

## 版本说明

| 版本 | 类型 | 状态 |
|------|------|------|
| v1.0.0-alpha | Major | 当前 |
| v0.9.0-beta | Minor | 归档 |
| v0.5.0-alpha | Minor | 归档 |

### 版本号规则
- **Alpha**: 功能测试阶段，可能有 breaking changes
- **Beta**: 功能稳定，API 可能调整
- **Release**: 正式版本，API 稳定

---

## 迁移指南

### v0.9.0-beta → v1.0.0-alpha

主要变更：
1. API 端点前缀添加 `/v1`
2. 简报响应格式调整
3. 新增 `evidence_refs` 字段
4. Python SDK 包名改为 `signal-market`

---

## 即将到来

- [ ] WebSocket 实时推送
- [ ] 更多用户透镜
- [ ] 自定义透镜创建
- [ ] 批量API
- [ ] GraphQL支持
- [ ] Slack/Discord集成

---

## 获取旧版本

历史版本归档: [GitHub Releases](https://github.com/signal-market/signal-market/releases)
