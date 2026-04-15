# Vipercode V6 Fresh

[![GitHub Stars](https://img.shields.io/github/stars/oasis-zepher/VIPER?style=flat-square&logo=github&color=yellow)](https://github.com/oasis-zepher/VIPER/stargazers)
[![GitHub Contributors](https://img.shields.io/github/contributors/oasis-zepher/VIPER?style=flat-square&color=green)](https://github.com/oasis-zepher/VIPER/graphs/contributors)
[![GitHub Issues](https://img.shields.io/github/issues/oasis-zepher/VIPER?style=flat-square&color=orange)](https://github.com/oasis-zepher/VIPER/issues)
[![GitHub License](https://img.shields.io/github/license/oasis-zepher/VIPER?style=flat-square)](https://github.com/oasis-zepher/VIPER/blob/main/LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/oasis-zepher/VIPER?style=flat-square&color=blue)](https://github.com/oasis-zepher/VIPER/commits/main)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?style=flat-square&logo=bun)](https://bun.sh/)

> Vipercode is the V6 migration baseline: upstream modular branch first, old VIPER capabilities layered back in deliberately.

这个目录是基于 `claude-code-best/claude-code` 的 `feature/v6` 分支建立的 fresh 基线，用来承接 `VIPER` 的下一阶段迁移。目标不是继续在旧石山上堆功能，而是先拿到上游 V6 的模块化底座，再把原来 `vipercode` 的能力逐批迁回。

当前已迁入的第一批能力：

- `viper` / `vipercode` CLI 入口
- daemon-backed `rcs` / `remote-control-server`
- `bun run rcs` 开发入口
- build 默认包含 `BRIDGE_MODE` 和 `DAEMON`

## Quick Start

### Requirements

- [Bun](https://bun.sh/) >= 1.3.11
- 按常规方式准备模型供应商配置

### Install

```bash
bun install
```

国内网络访问 GitHub 较慢时，可以先设置：

```bash
DEFAULT_RELEASE_BASE=https://ghproxy.net/https://github.com/microsoft/ripgrep-prebuilt/releases/download/v15.0.1
```

### Dev

```bash
bun run dev
```

### Build

```bash
bun run build
```

构建采用 `build.ts` 的 code splitting 多文件打包，产物位于 `dist/`，入口为 `dist/cli.js`。

## Remote Control Server

这个 fresh V6 基线已经接回了旧 `VIPER` 比较关键的一条链路：持久化远控 daemon。

```bash
# 启动持久远控服务
bun run rcs

# 查看状态
bun run rcs -- status

# 停止服务
bun run rcs -- stop
```

安装产物后也可以直接使用：

```bash
viper rcs
viper rcs status
viper rcs stop
viper remote-control-server
```

## Migration Notes

- 这是 V6 fresh 基线，不是旧 `VIPER` 主分支的原地重构。
- 当前策略是小批次迁移，先恢复高价值能力，再做更深的品牌和功能整合。
- 仓库中仍保留大量上游 `Claude Code` / `claude-code-best` 文案，后续会按模块逐步收口，而不是做一次性全仓替换。

## Debug

TUI 模式需要真实终端。调试时建议使用 attach 模式：

```bash
bun run dev:inspect
```

然后在 VS Code 中附着到 Bun 调试端口。

## License

本项目仅供学习研究用途。相关上游项目与模型服务的权利归其各自所有者。
