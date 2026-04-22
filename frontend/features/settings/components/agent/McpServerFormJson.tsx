/**
 * McpServerFormJson Component
 *
 * JSON import mode for MCP server configuration.
 * Provides a textarea for JSON input with real-time validation.
 */

// 导入 React 核心库
import React from 'react';

// MCP 服务器 JSON 表单组件属性接口
export interface McpServerFormJsonProps {
  jsonInput: string;                                  // JSON 输入字符串
  validationError: string;                            // 验证错误信息
  onChange: (value: string) => void;                  // 输入变更回调
  onValidationErrorChange: (error: string) => void;   // 验证错误变更回调
}

/**
 * McpServerFormJson - JSON import mode with validation
 */
// MCP 服务器 JSON 表单组件，带实时验证
export const McpServerFormJson: React.FC<McpServerFormJsonProps> = ({
  jsonInput,
  validationError,
  onChange,
  onValidationErrorChange
}) => {
  // 处理文本框输入变化，实时验证 JSON 格式
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    onChange(value);

    // 用户输入时实时验证 JSON 格式
    try {
      if (value.trim()) {
        const parsed = JSON.parse(value);
        if (!parsed.type) {
          onValidationErrorChange('Missing required field: type');
        } else if (parsed.type === 'stdio' && !parsed.command) {
          // stdio 类型必须有 command 字段
          onValidationErrorChange('stdio type requires a command field');
        } else if ((parsed.type === 'http' || parsed.type === 'sse') && !parsed.url) {
          // http/sse 类型必须有 url 字段
          onValidationErrorChange(`${parsed.type} type requires a url field`);
        } else {
          onValidationErrorChange('');
        }
      }
    } catch (err) {
      // JSON 解析失败
      if (value.trim()) {
        onValidationErrorChange('Invalid JSON format');
      } else {
        onValidationErrorChange('');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* JSON 配置输入框 */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          JSON Configuration *
        </label>
        <textarea
          value={jsonInput}
          onChange={handleChange}
          className={`w-full px-3 py-2 border ${
            validationError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          } bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500`}
          rows={8}
          placeholder={`{
  "type": "stdio",
  "command": "/path/to/server",
  "args": ["--api-key", "abc123"],
  "env": {
    "CACHE_DIR": "/tmp"
  }
}`}
          required
        />
        {validationError && (
          <p className="text-xs text-red-500 mt-1">{validationError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Paste your MCP server configuration in JSON format. Example formats:
          <br />• stdio: {`{"type":"stdio","command":"npx","args":["@upstash/context7-mcp"]}`}
          <br />• http/sse: {`{"type":"http","url":"https://api.example.com/mcp"}`}
        </p>
      </div>
    </div>
  );
};

export default McpServerFormJson;
