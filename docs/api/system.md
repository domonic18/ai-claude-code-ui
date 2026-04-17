# 系统、上传与健康检查

> **最后更新**: 2026-04-17

---

## 23. 系统模块 (System)

> 路由源码: `backend/routes/tools/system.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/system/update` | JWT | 通过 `git pull && npm install` 更新应用 |
| GET | `/api/system/browse-filesystem` | JWT | 浏览容器内文件系统（路径自动补全） |

### 查询参数

**GET /api/system/browse-filesystem**
| 查询参数 | 类型 | 说明 |
|----------|------|------|
| path | string | 浏览路径，默认 `~` |

---

## 24. 上传模块 (Uploads)

> 路由源码: `backend/routes/tools/uploads.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/uploads/transcribe` | JWT | 音频转录为文本（OpenAI Whisper API） |
| POST | `/api/uploads/:projectName/upload-images` | JWT | 上传图片并返回 base64 数据 |

### 请求参数

**POST /api/uploads/transcribe**（multipart/form-data）

| 字段 | 类型 | 说明 |
|------|------|------|
| audio | file | 音频文件（支持 mp3, wav, webm, ogg, flac, m4a） |
| mode | string | 增强模式：`default`、`prompt`、`vibe`、`instructions`、`architect` |

**POST /api/uploads/:projectName/upload-images**（multipart/form-data）

| 字段 | 类型 | 说明 |
|------|------|------|
| images | file[] | 图片文件（最多 5 个，单个最大 5MB，支持 JPEG/PNG/GIF/WebP/SVG） |

---

## 25. 健康检查

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/health` | - | 服务健康检查（公开端点） |
