/**
 * TestRefactoredSettings Component
 *
 * 测试组件：用于验证重构后的 Settings
 *
 * 访问路径：/test-settings
 *
 * 用途：
 * - 验证新的 Settings 架构
 * - 确认 AppearanceTab 功能正常
 * - 测试标签页切换
 * - 验证 Tasks 集成
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Settings } from '../features/settings/components';

function TestRefactoredSettings() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const response = await api.projects();
      if (response.ok) {
        const responseData = await response.json();
        setProjects(responseData.data || []);
      }
    } catch (error) {
      console.error('[TestSettings] Error fetching projects:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      {/* 测试环境横幅 */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🧪</span>
            <div>
              <div className="font-bold">Settings 重构测试环境</div>
              <div className="text-sm opacity-75">访问路由: /test-settings</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors text-sm"
            >
              返回主页
            </a>
          </div>
        </div>
      </div>

      {/* 功能说明 */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="bg-green-100 dark:bg-green-900/30 px-4 py-3 rounded-lg border border-green-200 dark:border-green-800">
          <div className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ 已迁移的功能:</div>
          <div className="flex flex-wrap gap-2 text-sm text-green-700 dark:text-green-300">
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">Appearance 标签页</span>
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">Agents 标签页</span>
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">API Keys 标签页</span>
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">Tasks 标签页</span>
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">代码编辑器设置</span>
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">主题切换</span>
            <span className="px-2 py-1 bg-white dark:bg-green-900/50 rounded">Agent 选择导航</span>
          </div>
        </div>
      </div>

      {/* 测试说明 */}
      {!user && (
        <div className="max-w-4xl mx-auto mb-4">
          <div className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              ⚠️ 请先登录以访问测试环境。
            </p>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">测试操作:</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setIsOpen(false);
                setTimeout(() => setIsOpen(true), 100);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              打开 Settings (Agents 标签页)
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setTimeout(() => setIsOpen(true), 100);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              打开 Settings (Appearance 标签页)
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setTimeout(() => setIsOpen(true), 100);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              重新打开 Settings
            </button>
            <button
              onClick={fetchProjects}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              刷新项目列表
            </button>
          </div>

          {/* 测试清单 */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">验证清单:</h4>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                Settings 模态框能正常打开
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                标签页导航正常工作
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                Appearance 标签页显示正常
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                Agents 标签页显示正常
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                Agent 切换（Claude/OpenCode）正常
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                分类标签页（Permissions/MCP）正常
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                OpenCode 显示 "Coming Soon" 占位
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                API Keys 标签页正常工作
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                Tasks 标签页正常工作
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                深色模式切换功能正常
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded" />
                代码编辑器设置保存到 localStorage
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 状态信息 */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">当前状态:</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600 dark:text-gray-400">用户状态:</div>
            <div className="text-gray-900 dark:text-white font-medium">
              {user ? '✅ 已登录' : '❌ 未登录'}
            </div>
            <div className="text-gray-600 dark:text-gray-400">项目数量:</div>
            <div className="text-gray-900 dark:text-white font-medium">{projects.length}</div>
            <div className="text-gray-600 dark:text-gray-400">Settings 状态:</div>
            <div className="text-gray-900 dark:text-white font-medium">
              {isOpen ? '✅ 打开' : '❌ 关闭'}
            </div>
          </div>
        </div>
      </div>

      {/* 重构后的 Settings 组件 */}
      <Settings
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialTab="agents"
      />
    </div>
  );
}

export default TestRefactoredSettings;
