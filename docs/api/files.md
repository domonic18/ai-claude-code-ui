# 文件模块 (Files)

> **最后更新**: 2026-04-17

> 路由源码: `backend/routes/api/files.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/projects/:projectName/file` | JWT | 读取文件内容（文本） |
| GET | `/api/projects/:projectName/file/download` | JWT | 下载文件（二进制流） |
| PUT | `/api/projects/:projectName/file` | JWT | 保存文件内容 |
| GET | `/api/projects/:projectName/files` | JWT | 获取项目文件树 |
| GET | `/api/projects/:projectName/files/content` | JWT | 获取二进制文件内容（如图片） |
| GET | `/api/projects/:projectName/files/stats` | JWT | 获取文件统计信息 |
| DELETE | `/api/projects/:projectName/files` | JWT | 删除文件 |
| PUT | `/api/projects/:projectName/rename` | JWT | 重命名文件或目录 |
| POST | `/api/projects/:projectName/directory` | JWT | 创建目录 |
| POST | `/api/projects/:projectName/move` | JWT | 移动文件或目录 |
| GET | `/api/projects/:projectName/files/exists` | JWT | 检查文件是否存在 |
| POST | `/api/files/upload` | JWT | 上传文件附件（multipart/form-data） |

### 请求参数

**GET /api/projects/:projectName/file**
| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| filePath | string | 是 | 文件路径 |

**PUT /api/projects/:projectName/file**
```json
{
  "filePath": "string (required)",
  "content": "string (required)"
}
```

**POST /api/projects/:projectName/directory**
```json
{
  "path": "string (required)"
}
```

**POST /api/projects/:projectName/move**
```json
{
  "sourcePath": "string (required)",
  "targetPath": "string (optional)"
}
```

**PUT /api/projects/:projectName/rename**
```json
{
  "oldPath": "string (required)",
  "newName": "string (required)"
}
```
