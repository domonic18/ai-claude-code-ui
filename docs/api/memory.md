# 记忆模块 (Memory)

> **最后更新**: 2026-04-17

> 路由源码: `backend/routes/api/memory.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/memory` | JWT | 读取 CLAUDE.md 记忆文件 |
| PUT | `/api/memory` | JWT | 保存记忆文件 |

### 请求参数

**PUT /api/memory**
```json
{
  "content": "string (required)"
}
```
