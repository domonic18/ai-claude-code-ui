/**
 * ScopeSelector Component
 *
 * Allows users to select between User (Global) and Project (Local) scope for MCP servers.
 * When Project scope is selected, shows a project selector dropdown.
 *
 * Note: UI uses "local" terminology but backend uses "project"
 */

// 导入 React 核心库
import React from 'react';
// 导入图标组件
import { Globe, FolderOpen } from 'lucide-react';
// 导入类型定义
import { McpScope } from '../../types/settings.types';

// UI 面向的类型（用户术语）
type UiScope = 'user' | 'local';

// 项目接口定义
export interface Project {
  name: string;       // 项目名称
  path?: string;      // 项目路径
  fullPath?: string;  // 完整路径
  displayName?: string; // 显示名称
}

// Scope 选择器组件属性接口
interface ScopeSelectorProps {
  scope: McpScope;                                      // 当前 scope
  projectPath: string;                                 // 项目路径
  projects: Project[];                                 // 项目列表
  readonly?: boolean;                                  // 是否只读模式
  onChange: (scope: McpScope, projectPath: string) => void;  // 变更回调
}

// 将后端 scope 转换为 UI scope 的辅助函数
const toUiScope = (scope: McpScope): UiScope => {
  return scope === 'project' ? 'local' : scope;
};

// 将 UI scope 转换为后端 scope 的辅助函数
const fromUiScope = (scope: UiScope): McpScope => {
  return scope === 'local' ? 'project' : scope;
};

/**
 * ScopeSelector - Provides scope selection UI for MCP servers
 */
export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  scope,
  projectPath,
  projects,
  readonly = false,
  onChange
}) => {
  // 转换为 UI scope
  const uiScope = toUiScope(scope);

  // 处理 scope 变更
  const handleChange = (newUiScope: UiScope, newProjectPath: string) => {
    onChange(fromUiScope(newUiScope), newProjectPath);
  };

  if (readonly) {
    // 只读模式：用于编辑现有服务器时显示 scope 信息
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <label className="block text-sm font-medium text-foreground mb-2">
          Scope
        </label>
        <div className="flex items-center gap-2">
          {/* 根据 scope 类型显示对应图标 */}
          {scope === 'user' ? <Globe className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
          <span className="text-sm">
            {scope === 'user' ? 'User (Global)' : 'Project (Local)'}
          </span>
          {scope === 'project' && projectPath && (
            <span className="text-xs text-muted-foreground">
              - {projectPath}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Scope cannot be changed when editing an existing server
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderScopeButtons(uiScope, handleChange)}
      {uiScope === 'local' && renderProjectSelector(projectPath, projects, handleChange)}
    </div>
  );
};

/**
 * Render scope selection buttons
 *
 * @param uiScope - Current UI scope
 * @param handleChange - Change handler
 * @returns Scope buttons JSX
 */
function renderScopeButtons(
  uiScope: UiScope,
  handleChange: (scope: UiScope, projectPath: string) => void
): JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        Scope *
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleChange('user', '')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            uiScope === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-4 h-4" />
            <span>User (Global)</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleChange('local', '')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            uiScope === 'local'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FolderOpen className="w-4 h-4" />
            <span>Project (Local)</span>
          </div>
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {uiScope === 'user'
          ? 'User scope: Available across all projects on your machine'
          : 'Local scope: Only available in the selected project'
        }
      </p>
    </div>
  );
}

/**
 * Render project selector dropdown
 *
 * @param projectPath - Current project path
 * @param projects - List of projects
 * @param handleChange - Change handler
 * @returns Project selector JSX
 */
function renderProjectSelector(
  projectPath: string,
  projects: Project[],
  handleChange: (scope: UiScope, projectPath: string) => void
): JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        Project *
      </label>
      <select
        value={projectPath}
        onChange={(e) => handleChange('local', e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        required
      >
        <option value="">Select a project...</option>
        {projects.map(project => (
          <option key={project.name} value={project.path || project.fullPath}>
            {project.displayName || project.name}
          </option>
        ))}
      </select>
      {projectPath && (
        <p className="text-xs text-muted-foreground mt-1">
          Path: {projectPath}
        </p>
      )}
    </div>
  );
}

export default ScopeSelector;
