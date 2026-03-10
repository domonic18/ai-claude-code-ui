# 模型配置指南

## 概述

本系统支持通过 `.env` 环境变量自定义可用 AI 模型列表，无需修改代码。

## 配置架构

```
.env (环境变量)
    ↓
backend/config/config.js (读取并解析 AVAILABLE_MODELS)
    ↓
GET /api/models (前端通过 API 获取模型列表)
    ↓
前端 ModelSelector 显示模型选项
```

## 快速开始

### 1. 编辑 .env 文件

在项目根目录的 `.env` 文件中设置 `AVAILABLE_MODELS`：

```bash
# 单行 JSON 格式（重要：不要换行！）
AVAILABLE_MODELS=[{"name":"glm-4.7","provider":"Zhipu GLM","description":"Latest flagship model"},{"name":"glm-5","provider":"Zhipu GLM","description":"Next generation model"},{"name":"kimi-k2.5","provider":"Kimi","description":"Moonshot AI Kimi model"}]
```

### 2. 重启后端服务器

```bash
# 停止当前服务器（如果正在运行）
# 然后重新启动
npm run server
```

### 3. 刷新前端页面

模型列表将自动更新，无需重新构建前端。

## 默认模型

如果不设置 `AVAILABLE_MODELS`，系统将使用 `backend/config/config.js` 中硬编码的以下默认模型：

| name | provider | description |
|------|----------|-------------|
| glm-4.7 | Zhipu GLM | Latest flagship model |
| glm-5 | Zhipu GLM | Next generation model |
| kimi-k2.5 | Kimi | Moonshot AI Kimi model |

## 模型对象格式

每个模型对象包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|--------|------|
| `name` | string | 是 | 模型标识符，用于 API 调用和 UI 显示 |
| `provider` | string | 是 | 提供商名称，用于分组显示 |
| `description` | string | 否 | 模型描述（建议使用英文） |

## 添加新模型

### 示例：添加 DeepSeek 模型

```bash
# .env
AVAILABLE_MODELS=[{"name":"glm-4.7","provider":"Zhipu GLM","description":"Latest flagship model"},{"name":"glm-5","provider":"Zhipu GLM","description":"Next generation model"},{"name":"kimi-k2.5","provider":"Kimi","description":"Moonshot AI Kimi model"},{"name":"deepseek-chat","provider":"DeepSeek","description":"DeepSeek Chat model"},{"name":"deepseek-coder","provider":"DeepSeek","description":"DeepSeek Coder model"}]
```

### 步骤

1. 编辑 `.env` 文件，在 `AVAILABLE_MODELS` 数组中添加新模型
2. 确保 JSON 格式正确（使用在线 JSON 验证工具）
3. 重启后端服务器
4. 刷新前端页面

## OneAPI 集成

如果使用 OneAPI 或类似的统一 API 网关：

### 1. 配置 API 端点

```bash
# .env
ANTHROPIC_BASE_URL=https://your-oneapi-endpoint.com/v1
ANTHROPIC_API_KEY=sk-your-oneapi-api-key
ANTHROPIC_MODEL=glm-4.7
```

### 2. 配置可用模型

```bash
AVAILABLE_MODELS=[{"name":"glm-4.7","provider":"Zhipu GLM"},{"name":"glm-4-plus","provider":"Zhipu GLM"},{"name":"deepseek-chat","provider":"DeepSeek"},{"name":"deepseek-coder","provider":"DeepSeek"}]
```

## 重要注意事项

### JSON 格式要求

1. **必须使用单行格式**，不要换行
2. 确保引号正确转义（如需要）
3. 使用 JSON 验证工具检查格式

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 模型列表不显示 | JSON 解析失败 | 检查 JSON 格式，确保是单行 |
| 模型无法选择 | name 字段为空或重复 | 确保每个模型的 name 唯一且不为空 |
| 前端加载失败 | API 端点不可用 | 检查后端服务器是否正常运行 |

## API 参考

### GET /api/models

获取可用模型列表

**响应示例：**

```json
{
  "success": true,
  "models": [
    {
      "name": "glm-4.7",
      "provider": "Zhipu GLM",
      "description": "Latest flagship model"
    },
    {
      "name": "glm-5",
      "provider": "Zhipu GLM",
      "description": "Next generation model"
    }
  ],
  "default": "glm-4.7",
  "api": {
    "baseURL": "https://api.openai.com/v1",
    "hasAPIKey": true
  }
}
```

## 故障排除

### 模型列表为空

1. 检查 `.env` 文件是否正确加载
2. 查看后端日志是否有解析错误
3. 确保后端服务器正在运行
4. 在浏览器控制台检查网络请求

### JSON 解析错误

```bash
# 使用 jq 验证 JSON 格式
echo '[{"name":"glm-4.7","provider":"Zhipu GLM"}]' | jq .
```

### 模型切换不生效

1. 清除浏览器 localStorage：
   ```javascript
   localStorage.removeItem('selected-model');
   ```
2. 刷新页面
3. 重新选择模型

## 完整配置示例

```bash
# .env

# =============================================================================
# 服务器配置
# =============================================================================
NODE_ENV=development
PORT=3001

# =============================================================================
# AI API 配置
# =============================================================================
ANTHROPIC_BASE_URL=https://api.your-oneapi.com/v1
ANTHROPIC_API_KEY=sk-your-api-key-here
ANTHROPIC_MODEL=glm-4.7

# =============================================================================
# 可用模型配置
# =============================================================================
AVAILABLE_MODELS=[{"name":"glm-4.7","provider":"Zhipu GLM","description":"Latest flagship model"},{"name":"glm-5","provider":"Zhipu GLM","description":"Next generation model"},{"name":"kimi-k2.5","provider":"Kimi","description":"Moonshot AI Kimi model"},{"name":"deepseek-chat","provider":"DeepSeek","description":"DeepSeek Chat model"},{"name":"deepseek-coder","provider":"DeepSeek","description":"DeepSeek Coder model"}]

# =============================================================================
# 其他配置...
# =============================================================================
```
