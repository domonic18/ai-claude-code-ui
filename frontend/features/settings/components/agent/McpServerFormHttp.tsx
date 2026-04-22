/**
 * MCP 服务器 HTTP/SSE 传输配置表单组件
 *
 * 用于配置通过 HTTP 或 SSE（Server-Sent Events）方式通信的 MCP 服务器
 * 提供服务器 URL 和 HTTP 请求头的输入字段
 *
 * HTTP/SSE 传输方式：
 * - 通过 HTTP/HTTPS 协议连接远程 MCP 服务器
 * - SSE 使用服务器推送事件进行实时通信
 * - HTTP 使用标准请求-响应模式
 */

// 导入 React 核心库
import React from 'react';
// 导入输入框组件
import { Input } from '@/shared/components/ui/Input';

// HTTP/SSE 配置表单组件属性接口
export interface McpServerFormHttpProps {
  url?: string;                                             // MCP 服务器 URL
  headers?: Record<string, string>;                         // HTTP 请求头
  onUrlChange: (url: string) => void;                       // URL 变更回调函数
  onHeadersChange: (headers: Record<string, string>) => void;  // 请求头变更回调函数
}

/**
 * MCP 服务器 HTTP/SSE 传输配置表单
 * 用于配置通过 HTTP/SSE 协议通信的 MCP 服务器
 */
export const McpServerFormHttp: React.FC<McpServerFormHttpProps> = ({
  url,                   // 服务器 URL
  headers = {},          // HTTP 请求头，默认空对象
  onUrlChange,           // URL 变更处理函数
  onHeadersChange        // 请求头变更处理函数
}) => {
  /**
   * 处理请求头输入框变更
   * 将多行文本（KEY=value 格式）转换为请求头对象
   */
  const handleHeadersChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const headersObj: Record<string, string> = {};
    // 按行分割文本
    e.target.value.split('\n').forEach(line => {
      // 按第一个等号分割键值对
      const [key, ...valueParts] = line.split('=');
      if (key && key.trim()) {
        headersObj[key.trim()] = valueParts.join('=').trim();
      }
    });
    onHeadersChange(headersObj);
  };

  return (
    <div className="space-y-4">
      {/* URL 输入字段 */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          URL *
        </label>
        <Input
          value={url || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUrlChange(e.target.value)}
          placeholder="https://api.example.com/mcp"
          type="url"
          required
        />
      </div>

      {/* HTTP 请求头输入字段（多行文本） */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Headers (KEY=value, one per line)
        </label>
        <textarea
          // 将请求头对象转换为 KEY=value 格式的多行文本
          value={Object.entries(headers || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
          onChange={handleHeadersChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          rows={3}
          placeholder={`Authorization=Bearer token
X-API-Key=your-key`}
        />
      </div>
    </div>
  );
};

export default McpServerFormHttp;
