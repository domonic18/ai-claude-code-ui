# 用户提示词模块 (User Prompt)

> **最后更新**: 2026-07-10

> 路由源码: `backend/routes/api/user-prompt.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/user-prompt` | JWT | 读取用户提示词文件 |
| PUT | `/api/user-prompt` | JWT | 保存用户提示词文件 |

### 请求参数

**PUT /api/user-prompt**
```json
{
  "content": "string (required)"
}
```
