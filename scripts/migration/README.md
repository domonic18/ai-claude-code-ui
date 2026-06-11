# 用户数据迁移：旧 mac → Linux

> 适用于从旧版（`372aab3`，`#46` 之前）docker-compose 部署迁移到新版 Linux 部署。

## 目录

- [单用户迁移](#单用户迁移) — 试迁移 / 补充单个用户
- [批量迁移](#批量迁移) — 一次性迁移多个用户（清空重导模式）

---

## 前置条件

**旧 mac 端（导出）**：
- Docker Desktop 运行中
- 用户容器 `claude-user-{id}` 存在（**运行或停止均可**，脚本自动启动并恢复）
- 主应用容器 `claude-code-app` 存在（同上）
- 磁盘空间 ≥ 数据量 × 2

**Linux 端（导入）**：
- Claude Code UI 已通过 `docker-compose.deploy.yml` 部署并运行
- `sqlite3` 命令可用（`apt install sqlite3`）
- root 权限
- SAML SSO 已配置同一 IdP（如需 SSO 用户登录）

## 路径映射（#46 版本变更）

旧版（372）文档系统路径与新版（#46）不同，导入脚本会自动转换：

| 数据 | 旧路径 | 新路径 | 处理 |
|------|--------|--------|------|
| 上传文档 | `<项目>/uploads/YYYY-MM-DD/` | `<项目>/documents/uploads/` | 自动搬迁（保留日期子目录） |
| AI 文档 | `<项目>/generated_docs/` | `<项目>/generated_docs/` | 不变 |
| 旧 README 模板 | `<项目>/README.md` | — | 自动删除 |
| AI 文档清单 | 无 | `<项目>/documents/.ai-documents.json` | 自动从 generated_docs 扫描生成 |

---

## 单用户迁移

### 0. 准备脚本

从代码仓库拷贝脚本到服务器部署目录下的 `migration/` 子目录：

```bash
# 在你的开发机上执行（代码仓库目录）
# 拷贝到旧 mac
ssh zhugedongming@mac-server "mkdir -p /Users/zhugedongming/Code/patent/ai-claude-code-ui-images/migration"
scp scripts/migration/export-from-mac.sh  zhugedongming@mac-server:/Users/zhugedongming/Code/patent/ai-claude-code-ui-images/migration/

# 拷贝到 Linux
ssh user@linux-server "mkdir -p /home/yufangming/patent/migration"
scp scripts/migration/import-to-linux.sh  user@linux-server:/home/yufangming/patent/migration/
```

> 脚本不依赖项目代码，只需要 Docker 运行。

### 1. 导出（旧 mac 上执行）

```bash
cd /Users/zhugedongming/Code/patent/ai-claude-code-ui-images/migration
chmod +x export-from-mac.sh

# 使用默认值（user_id=2, claude-user-2），产出在 ./data/
./export-from-mac.sh

# 或自定义参数
./export-from-mac.sh -u 2 -c claude-user-2 -o ./data-user2
```

产出文件在 `./data/`（即 `/Users/zhugedongming/Code/patent/ai-claude-code-ui-images/migration/data/`）：
- `workspace.tar.gz` — 用户数据（已排除运行时垃圾）
- `claude-code.db` — 旧数据库副本
- `meta.json` — 元数据

### 2. 传输到 Linux

```bash
scp -r ./data user@linux-server:/tmp/migration-export
```

### 3. 导入（Linux 上执行）

```bash
cd /home/yufangming/patent/migration
chmod +x import-to-linux.sh

# 先用 dry-run 预览（不修改任何文件）
sudo ./import-to-linux.sh -n

# 确认无误后正式执行
sudo bash ./import-to-linux.sh

# 如果 claude-code.db 不在默认位置（脚本会自动从容器环境变量和 Docker volume 映射查找）
sudo DATABASE_PATH=/custom/path/claude-code.db ./import-to-linux.sh -i /tmp/migration-export
```

### 4. 验证

1. 用迁过来的账号登录 Web UI（SSO 或密码均可）
2. 侧边栏检查项目列表（应显示 `my-workspace` + `my-worksite`）
3. 进 `my-workspace` 检查会话历史是否完整可恢复
4. 文档面板检查 uploads 和 generated_docs 是否显示
5. 检查 skills（42 个）、settings 等配置是否生效
6. 在项目里发一条消息，确认 Claude 能读旧文件、续上会话

### 回滚

```bash
# 1. 停掉新用户的容器
docker stop claude-user-<NEW_USER_ID>

# 2. 删除 sandbox volume
docker volume rm claude-user-<NEW_USER_ID>-workspace

# 3. 恢复数据库
cp /tmp/migration-export/backup-*/claude-code.db.bak <DB_PATH>

# 4. 重启 app
docker restart claude-code-app
```

---

## 批量迁移

> **场景：** 已验证单用户迁移成功，需要一次性迁移多个用户（如 2, 5, 6, 8, 9, 10, 11, 12, 14）。
> **模式：** 清空重导 — 先清除 Linux 上所有用户数据，再从头导入，保证干净无冲突。

### 关键设计

- **清空重导**：删除所有用户表数据 + 所有 `claude-user-*` volumes 后从头导入
- **ID 顺序分配**：从 2 开始，旧 2→新 2，旧 5→新 3，旧 6→新 4...
- **全量回滚**：`inject_user_data` 失败 → 立即恢复 DB 备份 + 删所有新建 volume + 重启 app
- **跳过不致命**：旧库不存在的用户 ID 跳过继续，不会触发回滚

### 0. 准备脚本

```bash
# 拷贝到旧 mac
scp scripts/migration/batch-export-from-mac.sh zhugedongming@mac-server:/Users/zhugedongming/Code/patent/ai-claude-code-ui-images/migration/

# 拷贝到 Linux
scp scripts/migration/batch-import-to-linux.sh user@linux-server:/home/yufangming/patent/migration/
```

### 1. 导出（旧 mac 上执行）

```bash
cd /Users/zhugedongming/Code/patent/ai-claude-code-ui-images/migration
chmod +x batch-export-from-mac.sh

# 导出指定用户
./batch-export-from-mac.sh -u "2,5,6,8,9,10,11,12,14"
```

产出结构：
```
batch-export/
├── manifest.json          # 批量元数据（用户列表、导出时间）
├── claude-code.db         # 共享数据库（一份）
└── users/
    ├── 2/                 # workspace.tar.gz + meta.json
    ├── 5/
    ├── 6/
    └── ...
```

### 2. 传输到 Linux

```bash
scp -r batch-export user@linux-server:/tmp/
```

### 3. 导入（Linux 上执行）

```bash
cd /home/yufangming/patent/migration
chmod +x batch-import-to-linux.sh

# 先预览（不修改任何数据）
sudo ./batch-import-to-linux.sh -i batch-export -n

# 确认无误后正式导入
sudo ./batch-import-to-linux.sh -i batch-export
```

### 4. 验证

同单用户验证步骤，逐个账号登录检查。

### 回滚

脚本会在 `inject_user_data` 失败时自动全量回滚。如需手动回滚：

```bash
# 1. 停 app
docker stop claude-code-app

# 2. 删除所有新建的用户容器和 volume
docker rm -f claude-user-2 claude-user-3 ...  # 按实际 ID
docker volume rm claude-user-2-workspace claude-user-3-workspace ...

# 3. 恢复数据库（备份在迁移包的 backup-*/ 目录下）
cp /tmp/batch-export/backup-*/claude-code.db.bak <DB_PATH>

# 4. 重启 app
docker start claude-code-app
```

