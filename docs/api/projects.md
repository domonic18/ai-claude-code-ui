# 项目模块 (Projects)

> **最后更新**: 2026-04-17

> 路由源码: `backend/routes/api/projects.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/projects` | JWT | 获取所有项目列表 |
| GET | `/api/projects/:projectName` | JWT | 获取单个项目详情 |
| GET | `/api/projects/:projectName/sessions` | JWT | 获取项目的会话列表 |
| GET | `/api/projects/:projectName/sessions/:sessionId/messages` | JWT | 获取会话消息 |
| PUT | `/api/projects/:projectName/sessions/:sessionId/rename` | JWT | 重命名会话摘要 |
| DELETE | `/api/projects/:projectName/sessions/:sessionId` | JWT | 删除会话 |
| PUT | `/api/projects/:projectName/rename` | JWT | 重命名项目的显示名称 |
| DELETE | `/api/projects/:projectName` | JWT | 删除项目（仅当为空时） |
| GET | `/api/projects/:projectName/empty` | JWT | 检查项目是否为空 |
| POST | `/api/projects/create` | JWT | 手动创建项目（添加路径） |
| POST | `/api/projects/create-workspace` | JWT | 创建新工作空间 |

### 请求参数

**POST /api/projects/create**
```json
{
  "path": "string (required) - 项目路径"
}
```

**POST /api/projects/create-workspace**
```json
{
  "workspaceType": "string (required) - 'existing' 或 'new'",
  "path": "string (required)",
  "githubUrl": "string (optional)",
  "githubTokenId": "number (optional)",
  "newGithubToken": "string (optional)"
}
```

**PUT /api/projects/:projectName/sessions/:sessionId/rename**
```json
{
  "summary": "string (required)"
}
```

**PUT /api/projects/:projectName/rename**
```json
{
  "displayName": "string (required)"
}
```
