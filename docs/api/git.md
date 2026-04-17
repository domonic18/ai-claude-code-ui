# Git 模块

> **最后更新**: 2026-04-17

> 路由源码: `backend/routes/api/git.js`

所有 Git 端点均需要 JWT 认证。

---

### 状态查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/git/status` | 获取项目 git 状态 |
| GET | `/api/git/diff` | 获取文件 diff |
| GET | `/api/git/file-with-diff` | 获取文件内容和 diff 信息 |
| GET | `/api/git/branches` | 获取分支列表 |
| GET | `/api/git/commits` | 获取最近提交记录 |
| GET | `/api/git/commit-diff` | 获取特定提交的 diff |
| GET | `/api/git/remote-status` | 获取远程仓库状态 |

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | string | 是 | 项目名称 |
| file | string | 视端点 | 文件路径（diff/file-with-diff 必填） |
| commit | string | 视端点 | 提交哈希（commit-diff 必填） |
| limit | number | 否 | 提交记录数量限制，默认 10 |

---

### 提交操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/git/initial-commit` | 创建初始提交 |
| POST | `/api/git/commit` | 提交更改 |
| POST | `/api/git/generate-commit-message` | AI 生成提交消息 |

**POST /api/git/commit**
```json
{
  "project": "string (required)",
  "message": "string (required)",
  "files": ["string[] (required)"]
}
```

**POST /api/git/generate-commit-message**
```json
{
  "project": "string (required)",
  "files": ["string[] (required)"],
  "provider": "string (optional) - 'claude' 或 'cursor'，默认 'claude'"
}
```

---

### 分支操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/git/checkout` | 切换分支 |
| POST | `/api/git/create-branch` | 创建新分支 |

```json
{
  "project": "string (required)",
  "branch": "string (required)"
}
```

---

### 远程操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/git/fetch` | 从远程获取 |
| POST | `/api/git/pull` | 从远程拉取 |
| POST | `/api/git/push` | 推送到远程 |
| POST | `/api/git/publish` | 发布分支到远程（含 `branch` 参数） |

```json
{
  "project": "string (required)",
  "branch": "string (publish 必填)"
}
```

---

### 文件操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/git/discard` | 丢弃文件更改 |
| POST | `/api/git/delete-untracked` | 删除未跟踪的文件 |

```json
{
  "project": "string (required)",
  "file": "string (required)"
}
```
