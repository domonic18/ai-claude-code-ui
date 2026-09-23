# 认证模块 (Auth) & SAML 单点登录

> **最后更新**: 2026-09-23
>
> **认证方式：仅 SAML SSO**（用户名密码登录已于 2026-09-23 移除，管理员由 `SSO_ADMIN_USERS` 白名单授予，操作手册见 [管理员用户管理](../user_operate/admin-user-management.md)）

---

## 1. 认证模块 (Auth)

> 路由源码: `backend/routes/core/auth.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/auth/status` | - | 检查认证状态（返回 `needsSetup`/`samlEnabled`） |
| GET | `/api/auth/ws-token` | JWT | 获取 WebSocket 认证令牌 |
| GET | `/api/auth/user` | JWT | 获取当前认证用户信息 |
| POST | `/api/auth/logout` | JWT | 登出 |

> ⚠️ `POST /register`、`POST /login`、`PUT /password` 已物理移除，调用返回 404。

---

## 2. SAML 单点登录

> 路由源码: `backend/routes/core/saml.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/saml/init` | - | 初始化 SSO 登录 |
| GET | `/api/auth/saml/sso-login` | - | 发起 SAML 登录请求（重定向到 IdP） |
| POST | `/api/auth/saml/callback` | - | 处理 SAML Response（IdP 回调，JIT 自动建号 + 白名单提权） |
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

### 用户生命周期（JIT Provisioning）

IdP 认证通过后，回调处理（`samlUserManager.js`）自动完成：

1. 按 `external_id`（SAML NameID，当前 IdP 传用户姓名）查库 → 已存在则直接登录
2. 不存在则自动创建 `user` 角色账号（无需任何注册动作）
3. **提权检查**：NameID 命中 `SSO_ADMIN_USERS` 白名单 → 提升为 `admin`（幂等，每次登录都检查，但只升不降）

### 相关配置

| 环境变量 | 说明 |
|------|------|
| `SAML_ENABLED` | SAML 总开关 |
| `SAML_ISSUER` / `SAML_CALLBACK_URL` / `SAML_LOGOUT_CALLBACK_URL` | SP 标识与回调地址（本地/线上不同，见 `.env.deploy` 注释） |
| `FRONTEND_URL` | 登录成功后重定向的前端地址 |
| `SSO_ADMIN_USERS` | admin 用户名白名单（逗号分隔，匹配 SAML NameID，大小写不敏感） |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | Cookie 安全策略（https 用 `true`/`none`，http 本地用 `false`/`lax`） |
