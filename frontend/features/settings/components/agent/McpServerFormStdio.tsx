/**
 * MCP 服务器 stdio 传输配置表单组件
 *
 * 用于配置通过标准输入/输出（stdio）方式通信的 MCP 服务器
 * 提供命令路径和命令行参数的输入字段
 *
 * stdio 传输方式：
 * - 通过子进程启动 MCP 服务器
 * - 通过标准输入/输出流进行通信
 * - 适合本地运行的 MCP 服务器
 */

// 导入 React 核心库
import React from 'react';
// 导入输入框组件
import { Input } from '@/shared/components/ui/Input';

// stdio 配置表单组件属性接口
export interface McpServerFormStdioProps {
  command?: string;                                  // 启动 MCP 服务器的命令路径
  args?: string[];                                   // 命令行参数数组
  onCommandChange: (command: string) => void;        // 命令变更回调函数
  onArgsChange: (args: string[]) => void;            // 参数数组变更回调函数
}

/**
 * MCP 服务器 stdio 传输配置表单
 * 用于配置通过标准输入/输出通信的 MCP 服务器
 */
export const McpServerFormStdio: React.FC<McpServerFormStdioProps> = ({
  command,            // 启动命令
  args = [],          // 命令行参数，默认空数组
  onCommandChange,    // 命令变更处理函数
  onArgsChange        // 参数变更处理函数
}) => {
  /**
   * 处理参数输入框变更
   * 将多行文本转换为字符串数组（每行一个参数）
   */
  const handleArgsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 按换行符分割，过滤空行
    const argsArray = e.target.value.split('\n').filter(arg => arg.trim());
    onArgsChange(argsArray);
  };

  return (
    <div className="space-y-4">
      {/* 命令输入字段 */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Command *
        </label>
        <Input
          value={command || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCommandChange(e.target.value)}
          placeholder="/path/to/mcp-server"
          required
        />
      </div>

      {/* 参数输入字段（多行文本） */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Arguments (one per line)
        </label>
        <textarea
          value={Array.isArray(args) ? args.join('\n') : ''}
          onChange={handleArgsChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          rows={3}
          placeholder={`--api-key
abc123`}
        />
      </div>
    </div>
  );
};

export default McpServerFormStdio;
