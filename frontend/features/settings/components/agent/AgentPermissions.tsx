/**
 * Agent 权限配置组件
 *
 * 管理 Claude 工具的权限设置（允许/阻止工具）
 * 功能包括：
 * - 跳过权限确认提示
 * - 配置允许使用的工具列表（白名单）
 * - 配置禁止使用的工具列表（黑名单）
 * - 快捷添加常用工具按钮
 * - 工具模式配置（支持通配符和参数匹配）
 *
 * 迁移自：frontend/components/settings/PermissionsContent.jsx
 * 注意：Cursor 和 Codex 变体已被移除，因为不再支持
 */

// 导入 React 核心库
import React from 'react';
// 导入国际化 Hook
import { useTranslation } from 'react-i18next';
// 导入 UI 组件
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
// 导入图标组件
import { Shield, AlertTriangle, Plus, X } from 'lucide-react';

// Claude 常用工具模式列表，用于快捷添加
const commonClaudeTools = [
  'Bash(git log:*)',      // Git 日志查看
  'Bash(git diff:*)',     // Git 差异对比
  'Bash(git status:*)',   // Git 状态查看
  'Write',                 // 文件写入
  'Read',                  // 文件读取
  'Edit',                  // 文件编辑
  'Glob',                  // 文件路径匹配
  'Grep',                  // 文本搜索
  'MultiEdit',             // 批量编辑
  'Task',                  // 任务管理
  'TodoWrite',             // 待办事项写入
  'TodoRead',              // 待办事项读取
  'WebFetch',              // 网页获取
  'WebSearch'              // 网页搜索
];

// Agent 权限主组件属性接口
interface AgentPermissionsProps {
  skipPermissions: boolean;                         // 是否跳过权限确认
  setSkipPermissions: (value: boolean) => void;     // 设置跳过权限确认
  allowedTools: string[];                           // 允许的工具列表
  setAllowedTools: (tools: string[]) => void;       // 设置允许的工具列表
  disallowedTools: string[];                        // 禁止的工具列表
  setDisallowedTools: (tools: string[]) => void;    // 设置禁止的工具列表
  newAllowedTool: string;                           // 新允许工具输入值
  setNewAllowedTool: (value: string) => void;       // 设置新允许工具输入
  newDisallowedTool: string;                        // 新禁止工具输入值
  setNewDisallowedTool: (value: string) => void;    // 设置新禁止工具输入
}

// 跳过权限区域组件属性接口
interface SkipPermissionsSectionProps {
  skipPermissions: boolean;
  setSkipPermissions: (value: boolean) => void;
}

// 允许工具区域组件属性接口
interface AllowedToolsSectionProps {
  allowedTools: string[];
  newAllowedTool: string;
  setNewAllowedTool: (value: string) => void;
  onAddTool: (tool: string) => void;
  onRemoveTool: (tool: string) => void;
}

// 禁止工具区域组件属性接口
interface DisallowedToolsSectionProps {
  disallowedTools: string[];
  newDisallowedTool: string;
  setNewDisallowedTool: (value: string) => void;
  onAddTool: (tool: string) => void;
  onRemoveTool: (tool: string) => void;
}

/**
 * 跳过权限确认区域组件
 * 提供复选框，允许用户跳过工具使用的权限确认提示
 */
const SkipPermissionsSection: React.FC<SkipPermissionsSectionProps> = ({
  skipPermissions,      // 是否跳过权限确认
  setSkipPermissions    // 设置跳过权限确认
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 区域标题 */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-medium text-foreground">
          {t('agentPermissions.title')}
        </h3>
      </div>
      {/* 跳过权限确认复选框 */}
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={skipPermissions}
            onChange={(e) => setSkipPermissions(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <div>
            {/* 复选框标题 */}
            <div className="font-medium text-orange-900 dark:text-orange-100">
              {t('agentPermissions.skipPrompts')}
            </div>
            {/* 复选框说明 */}
            <div className="text-sm text-orange-700 dark:text-orange-300">
              {t('agentPermissions.skipPromptsDescription')}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};

/**
 * 允许工具列表区域组件
 * 管理允许使用的工具列表，提供手动添加和快捷添加功能
 */
const AllowedToolsSection: React.FC<AllowedToolsSectionProps> = ({
  allowedTools,          // 允许的工具列表
  newAllowedTool,        // 新工具输入值
  setNewAllowedTool,     // 设置新工具输入
  onAddTool,             // 添加工具处理函数
  onRemoveTool           // 移除工具处理函数
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 区域标题 */}
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-medium text-foreground">
          {t('agentPermissions.allowedTools')}
        </h3>
      </div>
      {/* 区域说明文字 */}
      <p className="text-sm text-muted-foreground">
        {t('agentPermissions.allowedToolsDescription')}
      </p>

      {/* 手动添加工具输入框 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newAllowedTool}
          onChange={(e) => setNewAllowedTool(e.target.value)}
          placeholder={t('agentPermissions.placeholder')}
          onKeyPress={(e) => {
            // 回车键添加工具
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddTool(newAllowedTool);
            }
          }}
          className="flex-1 h-10"
        />
        <Button
          onClick={() => onAddTool(newAllowedTool)}
          disabled={!newAllowedTool}
          size="sm"
          className="h-10 px-4"
        >
          <Plus className="w-4 h-4 mr-2 sm:mr-0" />
          <span className="sm:hidden">{t('agentPermissions.add')}</span>
        </Button>
      </div>

      {/* 快捷添加常用工具按钮 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('agentPermissions.quickAdd')}
        </p>
        <div className="flex flex-wrap gap-2">
          {commonClaudeTools.map(tool => (
            <Button
              key={tool}
              variant="outline"
              size="sm"
              onClick={() => onAddTool(tool)}
              disabled={allowedTools.includes(tool)}  // 已添加的按钮禁用
              className="text-xs h-8"
            >
              {tool}
            </Button>
          ))}
        </div>
      </div>

      {/* 已添加的工具列表 */}
      <div className="space-y-2">
        {allowedTools.map(tool => (
          <div key={tool} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            {/* 工具名称 */}
            <span className="font-mono text-sm text-green-800 dark:text-green-200">
              {tool}
            </span>
            {/* 移除按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveTool(tool)}
              className="text-green-600 hover:text-green-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {/* 空状态提示 */}
        {allowedTools.length === 0 && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            {t('agentPermissions.noAllowedTools')}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 禁止工具列表区域组件
 * 管理禁止使用的工具列表
 */
const DisallowedToolsSection: React.FC<DisallowedToolsSectionProps> = ({
  disallowedTools,          // 禁止的工具列表
  newDisallowedTool,        // 新工具输入值
  setNewDisallowedTool,     // 设置新工具输入
  onAddTool,                // 添加工具处理函数
  onRemoveTool              // 移除工具处理函数
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 区域标题 */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-medium text-foreground">
          {t('agentPermissions.blockedTools')}
        </h3>
      </div>
      {/* 区域说明文字 */}
      <p className="text-sm text-muted-foreground">
        {t('agentPermissions.blockedToolsDescription')}
      </p>

      {/* 手动添加工具输入框 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newDisallowedTool}
          onChange={(e) => setNewDisallowedTool(e.target.value)}
          placeholder={t('agentPermissions.blockedPlaceholder')}
          onKeyPress={(e) => {
            // 回车键添加工具
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddTool(newDisallowedTool);
            }
          }}
          className="flex-1 h-10"
        />
        <Button
          onClick={() => onAddTool(newDisallowedTool)}
          disabled={!newDisallowedTool}
          size="sm"
          className="h-10 px-4"
        >
          <Plus className="w-4 h-4 mr-2 sm:mr-0" />
          <span className="sm:hidden">{t('agentPermissions.add')}</span>
        </Button>
      </div>

      {/* 已添加的工具列表 */}
      <div className="space-y-2">
        {disallowedTools.map(tool => (
          <div key={tool} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            {/* 工具名称 */}
            <span className="font-mono text-sm text-red-800 dark:text-red-200">
              {tool}
            </span>
            {/* 移除按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveTool(tool)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {/* 空状态提示 */}
        {disallowedTools.length === 0 && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            {t('agentPermissions.noBlockedTools')}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 帮助说明区域组件
 * 显示工具模式的使用示例和说明
 */
const HelpSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
        {t('agentPermissions.examples.title')}
      </h4>
      {/* 工具模式示例列表 */}
      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(git log:*)"</code> - {t('agentPermissions.examples.gitLog')}</li>
        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(git diff:*)"</code> - {t('agentPermissions.examples.gitDiff')}</li>
        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Write"</code> - {t('agentPermissions.examples.write')}</li>
        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(rm:*)"</code> - {t('agentPermissions.examples.rm')}</li>
      </ul>
    </div>
  );
};

/**
 * Agent 权限配置主组件
 * 整合所有权限设置区域，提供完整的功能界面
 */
const AgentPermissions: React.FC<AgentPermissionsProps> = ({
  skipPermissions,
  setSkipPermissions,
  allowedTools,
  setAllowedTools,
  disallowedTools,
  setDisallowedTools,
  newAllowedTool,
  setNewAllowedTool,
  newDisallowedTool,
  setNewDisallowedTool
}) => {
  /**
   * 添加允许的工具
   * 验证工具不为空且不存在于列表中
   */
  const addAllowedTool = (tool: string) => {
    if (tool && !allowedTools.includes(tool)) {
      setAllowedTools([...allowedTools, tool]);
      setNewAllowedTool('');  // 清空输入框
    }
  };

  /**
   * 移除允许的工具
   */
  const removeAllowedTool = (tool: string) => {
    setAllowedTools(allowedTools.filter(t => t !== tool));
  };

  /**
   * 添加禁止的工具
   * 验证工具不为空且不存在于列表中
   */
  const addDisallowedTool = (tool: string) => {
    if (tool && !disallowedTools.includes(tool)) {
      setDisallowedTools([...disallowedTools, tool]);
      setNewDisallowedTool('');  // 清空输入框
    }
  };

  /**
   * 移除禁止的工具
   */
  const removeDisallowedTool = (tool: string) => {
    setDisallowedTools(disallowedTools.filter(t => t !== tool));
  };

  return (
    <div className="space-y-6">
      {/* 跳过权限确认区域 */}
      <SkipPermissionsSection
        skipPermissions={skipPermissions}
        setSkipPermissions={setSkipPermissions}
      />
      {/* 允许工具列表区域 */}
      <AllowedToolsSection
        allowedTools={allowedTools}
        newAllowedTool={newAllowedTool}
        setNewAllowedTool={setNewAllowedTool}
        onAddTool={addAllowedTool}
        onRemoveTool={removeAllowedTool}
      />
      {/* 禁止工具列表区域 */}
      <DisallowedToolsSection
        disallowedTools={disallowedTools}
        newDisallowedTool={newDisallowedTool}
        setNewDisallowedTool={setNewDisallowedTool}
        onAddTool={addDisallowedTool}
        onRemoveTool={removeDisallowedTool}
      />
      {/* 帮助说明区域 */}
      <HelpSection />
    </div>
  );
};

// 导出主组件
export default AgentPermissions;
