/**
 * TestRefactoredChat Component
 *
 * 测试组件：用于验证重构后的 ChatInterface
 *
 * 访问路径：/test-refactored
 *
 * 用途：
 * - 对比新旧版本功能
 * - 验证重构后代码是否正常工作
 * - 确认所有新功能已实现
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import { api, authenticatedFetch } from '../utils/api';

// 导入重构后的 ChatInterface
import { ChatInterface } from '../features/chat/components/ChatInterface';

function TestRefactoredChat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ws, sendMessage, messages } = useWebSocketContext();

  // 模拟项目数据（实际应该从 API 获取）
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [projects, setProjects] = useState([]);

  // Fetch projects when user logs in
  useEffect(() => {
    if (user) {
      console.log('[TestRefactored] User logged in, fetching projects...');
      fetchProjects();
    }
  }, [user]);

  // Handle URL-based session loading
  useEffect(() => {
    if (sessionId && projects.length > 0) {
      // Find the session across all projects
      for (const project of projects) {
        let session = project.sessions?.find(s => s.id === sessionId);
        if (session) {
          setSelectedProject(project);
          setSelectedSession({ ...session, __provider: 'claude' });
          return;
        }
        // Also check Cursor sessions
        const cSession = project.cursorSessions?.find(s => s.id === sessionId);
        if (cSession) {
          setSelectedProject(project);
          setSelectedSession({ ...cSession, __provider: 'cursor' });
          return;
        }
      }
    }
  }, [sessionId, projects]);

  // Auto-select first project if no project is selected
  useEffect(() => {
    if (projects.length > 0 && !selectedProject && !sessionId) {
      console.log('[TestRefactored] Auto-selecting first project:', projects[0].name);
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject, sessionId]);

  /**
   * Fetch projects from API
   */
  const fetchProjects = async () => {
    try {
      const response = await api.projects();
      if (!response.ok) {
        console.error('[TestRefactored] Failed to fetch projects:', response.status);
        setProjects([]);
        return;
      }
      const responseData = await response.json();
      const data = responseData.data || [];
      setProjects(data);
      console.log('[TestRefactored] Projects loaded:', data.length);
    } catch (error) {
      console.error('[TestRefactored] Error fetching projects:', error);
      setProjects([]);
    }
  };

  // Session protection callbacks
  const handleSessionActive = useCallback((sessionId) => {
    console.log('[TestRefactored] Session active:', sessionId);
  }, []);

  const handleSessionInactive = useCallback((sessionId) => {
    console.log('[TestRefactored] Session inactive:', sessionId);
  }, []);

  const handleSessionProcessing = useCallback((sessionId) => {
    console.log('[TestRefactored] Session processing:', sessionId);
  }, []);

  const handleSessionNotProcessing = useCallback((sessionId) => {
    console.log('[TestRefactored] Session not processing:', sessionId);
  }, []);

  const handleReplaceTemporarySession = useCallback((tempId, realId) => {
    console.log('[TestRefactored] Replace temp session:', tempId, '->', realId);
  }, []);

  const handleNavigateToSession = useCallback((sessionId) => {
    navigate(`/test-refactored/session/${sessionId}`);
  }, [navigate]);

  const handleFileOpen = useCallback((filePath, diffData) => {
    console.log('[TestRefactored] File open:', filePath, diffData);
  }, []);

  const handleInputFocusChange = useCallback((isFocused) => {
    console.log('[TestRefactored] Input focus:', isFocused);
  }, []);

  const handleShowSettings = useCallback(() => {
    console.log('[TestRefactored] Show settings');
  }, []);

  const handleTaskClick = useCallback((taskId) => {
    console.log('[TestRefactored] Task click:', taskId);
  }, []);

  const handleShowAllTasks = useCallback(() => {
    console.log('[TestRefactored] Show all tasks');
  }, []);

  const handleSetTokenBudget = useCallback((budget) => {
    console.log('[TestRefactored] Token budget:', budget);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 测试环境横幅 */}
      <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-bold">🧪 重构版本测试环境</span>
          <span className="opacity-75">|</span>
          <span>访问路由: /test-refactored</span>
          <span className="opacity-75">|</span>
          <span>新组件: features/chat/components/ChatInterface.tsx</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
          >
            返回旧版本
          </a>
        </div>
      </div>

      {/* 功能清单 */}
      <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 text-sm border-b border-green-200 dark:border-green-800">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-green-800 dark:text-green-200">✅ 已实现的新功能:</span>
          <span className="text-green-700 dark:text-green-300">命令系统 (/)</span>
          <span className="text-green-700 dark:text-green-300">文件引用 (@)</span>
          <span className="text-green-700 dark:text-green-300">任务集成</span>
          <span className="text-green-700 dark:text-green-300">Token UI</span>
          <span className="text-green-700 dark:text-green-300">Model选择</span>
        </div>
      </div>

      {/* 测试说明 */}
      {!user && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-3 text-sm">
          <p className="text-yellow-800 dark:text-yellow-200">
            ⚠️ 请先登录以访问测试环境。登录后将自动加载项目和会话。
          </p>
        </div>
      )}

      {/* 项目选择器 */}
      {user && projects.length > 0 && (
        <div className="bg-purple-100 dark:bg-purple-900/30 px-4 py-2 text-sm border-b border-purple-200 dark:border-purple-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-purple-800 dark:text-purple-200">📁 项目选择:</span>
            <select
              value={selectedProject?.name || ''}
              onChange={(e) => {
                const project = projects.find(p => p.name === e.target.value);
                if (project) {
                  setSelectedProject(project);
                  setSelectedSession(null); // Clear session when switching projects
                  console.log('[TestRefactored] Project selected:', project.name);
                }
              }}
              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- 选择项目 --</option>
              {projects.map(project => (
                <option key={project.name} value={project.name}>
                  {project.name} ({project.sessions?.length || 0} 个会话)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchProjects}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            刷新项目
          </button>
        </div>
      )}

      {/* 重构后的 ChatInterface */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          ws={ws}
          sendMessage={sendMessage}
          wsMessages={messages}
          onFileOpen={handleFileOpen}
          onInputFocusChange={handleInputFocusChange}
          onSessionActive={handleSessionActive}
          onSessionInactive={handleSessionInactive}
          onSessionProcessing={handleSessionProcessing}
          onSessionNotProcessing={handleSessionNotProcessing}
          onReplaceTemporarySession={handleReplaceTemporarySession}
          onNavigateToSession={handleNavigateToSession}
          onShowSettings={handleShowSettings}
          onTaskClick={handleTaskClick}
          onShowAllTasks={handleShowAllTasks}
          onSetTokenBudget={handleSetTokenBudget}
          autoExpandTools={false}
          showRawParameters={false}
          showThinking={true}
          autoScrollToBottom={true}
          sendByCtrlEnter={false}
        />
      </div>

      {/* 调试信息面板 */}
      <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-xs max-w-sm">
        <h3 className="font-bold mb-2 text-gray-900 dark:text-white">🔍 调试信息</h3>
        <div className="space-y-1 text-gray-700 dark:text-gray-300">
          <p>组件: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ChatInterface.tsx</code></p>
          <p>用户: {user ? '✅ 已登录' : '❌ 未登录'}</p>
          <p>项目数: {projects.length}</p>
          <p>当前项目: {selectedProject ? selectedProject.name : '未选择'}</p>
          <p>当前会话: {selectedSession ? selectedSession.id : '未选择'}</p>
          <p>WebSocket: {ws ? '✅ 已连接' : '❌ 未连接'}</p>
        </div>
      </div>
    </div>
  );
}

export default TestRefactoredChat;
