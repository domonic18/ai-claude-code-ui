# 认证模块 (Auth) & SAML 单点登录

> **最后更新**: 2026-04-17

---

## 1. 认证模块 (Auth)

> 路由源码: `backend/routes/core/auth.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/auth/status` | - | 检查认证状态和初始设置要求 |
| GET | `/api/auth/ws-token` | JWT | 获取 WebSocket 认证令牌 |
| POST | `/api/auth/register` | - | 用户注册（仅初始设置，无已有用户时允许） |
| POST | `/api/auth/login` | - | 用户登录 |
| GET | `/api/auth/user` | JWT | 获取当前认证用户信息 |
| PUT | `/api/auth/password` | JWT | 修改密码 |
| POST | `/api/auth/logout` | JWT | 登出 |

### 请求参数

**POST /api/auth/register**
```json
{
  "username": "string (min: 3)",
  "password": "string (min: 6)"
}
```

**POST /api/auth/login**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**PUT /api/auth/password**
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required, min: 6)"
}
```

---

## 2. SAML 单点登录

> 路由源码: `backend/routes/core/saml.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/saml/init` | - | 初始化 SSO 登录 |
| GET | `/api/auth/saml/sso-login` | - | 发起 SAML 登录请求（重定向到 IdP） |
| POST | `/api/auth/saml/callback` | - | 处理 SAML Response（IdP 回调） |
| POST | `/api/auth/saml/sso-callback` | - | Legacy 回调别名 |
| GET | `/api/auth/saml/logout` | - | SAML 登出 |
| GET | `/api/auth/saml/metadata` | - | SP Metadata 端点（XML） |
| GET | `/api/auth/saml/status` | - | 获取 SAML 配置状态 |
| GET | `/api/auth/saml/test` | - | 测试 SAML 配置是否完整 |

### 请求参数

**POST /api/auth/saml/init**
```json
{
  "return_to": "string (required) - 登录后重定向的前端 URL"
}
```
