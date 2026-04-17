# 会话模块 (Sessions)

> **最后更新**: 2026-04-17

> 路由源码: `backend/routes/api/sessions.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/sessions` | JWT | 获取所有会话列表 |
| GET | `/api/sessions/search` | JWT | 搜索会话 |
| GET | `/api/sessions/:sessionId/messages` | JWT | 获取会话消息 |
| GET | `/api/sessions/:sessionId/stats` | JWT | 获取会话统计信息 |
| DELETE | `/api/sessions/:sessionId` | JWT | 删除会话 |
