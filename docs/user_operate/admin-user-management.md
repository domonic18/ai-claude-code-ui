# 管理员用户管理

> **最后更新**: 2026-09-23
>
> 适用前提：系统已启用 SAML SSO 登录（密码登录已移除）

## 概述

系统管理员（admin）角色**不再通过密码账号授予**，改为环境变量白名单 + 数据库角色双轨管理：

- **授予**：`.env` 中的 `SSO_ADMIN_USERS` 白名单 + 用户 SSO 登录 → 自动写库提权
- **撤销**：手动执行 SQL 将角色降回 `user`（白名单只升不降，撤销必须手动）

## 角色管理规则

| 操作 | 方式 | 生效时机 |
|------|------|------|
| 授予 admin | `SSO_ADMIN_USERS` 加名字 → 重启容器 → 该用户 SSO 登录一次 | 下次 SSO 登录时 |
| 撤销 admin | 手动 SQL 降级（见下文） | 立即（后端逐请求查库） |

**关键不对称性**：白名单只管"给"，不管"收"。

- 白名单**新增**名字 → 重启后该用户登录即成为 admin
- 白名单**删掉**名字 → 已有 admin **不会**被自动降级，必须手动执行 SQL

> 为什么不做"白名单即唯一真相"的强同步？因为环境变量一处笔误（拼错名字、漏逗号）会在下次登录时把所有 admin 连坐降级，包括最后一个管理员，导致系统失去管理入口。手动 SQL 撤销虽多一步，但每次降权都是有意识的操作。

## 授予 admin

1. 编辑 `.env.deploy`（或对应环境的 env 文件）：

```bash
# SSO 管理员用户名白名单（逗号分隔，SAML NameID 命中自动提为 admin）
SSO_ADMIN_USERS=YuFangMing,Zhangsan
```

> 注意：匹配的是 **SAML NameID**（当前 IdP 传用户姓名，如 `YuFangMing`），不是邮箱、不是中文显示名。大小写不敏感。确认某人的 NameID 可查库：`SELECT username, external_id FROM users WHERE identity_provider='saml'`。

2. 重启容器：

```bash
docker compose -f docker-compose.deploy.yml up -d
```

3. 让该用户 **SSO 登录一次**（提权在每次登录时检查并写库）。

4. 验证：

```bash
docker exec claude-code-app node -e "
const Database = require('better-sqlite3');
const db = new Database('/workspace/database/claude-code.db', {readonly:true});
console.log(db.prepare(\"SELECT username, role FROM users WHERE identity_provider='saml'\").all());
"
```

用户界面验证：admin 登录后左下角用户菜单会多出「管理控制台」入口。

## 撤销 admin

1. （可选）同时把名字从 `SSO_ADMIN_USERS` 移除——防止未来某次重启+重登又被提回来。

2. 执行降级 SQL（以收回 `YuFangMing` 为例）：

```bash
docker exec claude-code-app node -e "
const Database = require('better-sqlite3');
const db = new Database('/workspace/database/claude-code.db');
db.prepare(\"UPDATE users SET role='user' WHERE external_id='YuFangMing'\").run();
console.log(db.prepare(\"SELECT username, role FROM users WHERE external_id='YuFangMing'\").get());
"
```

3. 让该用户**退出重新登录**一次。后端权限立即生效（下一个请求即被拦截），但前端页面还缓存着旧的 admin 身份，重登后才完全干净。

## 应急通道

IdP（guanghua.53jy.net）故障导致所有人无法登录时：

> 密码登录已移除，无本地登录应急通道。恢复方式是修复 IdP 本身。
> （历史方案 `LOCAL_AUTH_ENABLED` 开关已随密码登录删除，不再可用。）

## 相关代码

| 文件 | 职责 |
|------|------|
| `backend/config/authMode.config.js` | 解析 `SSO_ADMIN_USERS` 白名单 |
| `backend/routes/core/samlUserManager.js` | JIT 建号 + 白名单提权（`promoteToAdminIfAllowlisted`） |
| `backend/middleware/auth.js` | `requireAdmin` 中间件（admin 接口逐请求校验） |
| `frontend/router/AdminRoute.tsx` | `/admin` 页面路由守卫（非 admin 重定向 `/chat`） |
