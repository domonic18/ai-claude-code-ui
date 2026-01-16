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

  // 调试面板位置状态
  const [panelPosition, setPanelPosition] = useState({ x: 16, y: 16 }); // bottom-4 right-4 = 16px
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  // 拖拽处理函数
  const handleMouseDown = useCallback((e) => {
    // 只有点击头部时才能拖动
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      const panel = e.currentTarget;
      const rect = panel.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      setPanelPosition({ x, y });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

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
        <div className="bg-purple-100 dark:bg-purple-900/30 px-4 py-2 text-sm border-b border-purple-200 dark:border-purple-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-purple-800 dark:text-purple-200">📁 项目:</span>
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

      {/* 会话选择器 */}
      {user && selectedProject && (
        <div className="bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 text-sm border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="font-semibold text-indigo-800 dark:text-indigo-200 flex-shrink-0">💬 会话:</span>
            <select
              value={selectedSession?.id || ''}
              onChange={(e) => {
                const sessionId = e.target.value;
                if (sessionId) {
                  // Find session in Claude sessions
                  let session = selectedProject.sessions?.find(s => s.id === sessionId);
                  if (session) {
                    setSelectedSession({ ...session, __provider: 'claude' });
                    navigate(`/test-refactored/session/${sessionId}`);
                    return;
                  }
                  // Find session in Cursor sessions
                  const cSession = selectedProject.cursorSessions?.find(s => s.id === sessionId);
                  if (cSession) {
                    setSelectedSession({ ...cSession, __provider: 'cursor' });
                    navigate(`/test-refactored/session/${sessionId}`);
                    return;
                  }
                } else {
                  setSelectedSession(null);
                }
              }}
              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-0"
            >
              <option value="">-- 新建会话 --</option>
              {selectedProject.sessions?.length > 0 && (
                <optgroup label="Claude 会话">
                  {selectedProject.sessions.map(session => {
                    // Parse date safely
                    let dateStr = 'Unknown';
                    try {
                      const date = new Date(session.createdAt || session.timestamp || session.modifiedAt || Date.now());
                      if (!isNaN(date.getTime())) {
                        dateStr = date.toLocaleDateString();
                      }
                    } catch (e) {
                      dateStr = 'Unknown';
                    }
                    return (
                      <option key={session.id} value={session.id}>
                        {session.title || session.id.slice(0, 8)} ({dateStr})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {selectedProject.cursorSessions?.length > 0 && (
                <optgroup label="Cursor 会话">
                  {selectedProject.cursorSessions.map(session => {
                    // Parse date safely
                    let dateStr = 'Unknown';
                    try {
                      const date = new Date(session.createdAt || session.timestamp || session.modifiedAt || Date.now());
                      if (!isNaN(date.getTime())) {
                        dateStr = date.toLocaleDateString();
                      }
                    } catch (e) {
                      dateStr = 'Unknown';
                    }
                    return (
                      <option key={session.id} value={session.id}>
                        {session.title || session.id.slice(0, 8)} ({dateStr})
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {selectedProject.sessions?.length || 0} 个 Claude 会话, {selectedProject.cursorSessions?.length || 0} 个 Cursor 会话
          </div>
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
      <div
        onMouseDown={handleMouseDown}
        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-xs max-w-sm max-h-96 overflow-y-auto"
        style={{
          position: 'fixed',
          left: `${panelPosition.x}px`,
          top: `${panelPosition.y}px`,
          cursor: isDragging ? 'grabbing' : 'auto',
          userSelect: isDragging ? 'none' : 'auto',
          zIndex: 9999,
        }}
      >
        {/* 可拖动的标题栏 */}
        <div className="drag-handle bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600 cursor-grab active:cursor-grabbing flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">🔍 调试信息</h3>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs">拖动移动</span>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
        </div>

        <div className="p-4 space-y-1 text-gray-700 dark:text-gray-300">
          <p>组件: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ChatInterface.tsx</code></p>
          <p>用户: {user ? '✅ 已登录' : '❌ 未登录'}</p>
          <p>项目数: {projects.length}</p>
          <p>当前项目: {selectedProject ? selectedProject.name : '未选择'}</p>
          <p>会话数: {selectedProject ? (selectedProject.sessions?.length || 0) + ' Claude, ' + (selectedProject.cursorSessions?.length || 0) + ' Cursor' : '-'}</p>
          <p>当前会话: {selectedSession ? (selectedSession.title || selectedSession.id.slice(0, 8)) : '未选择'}</p>
          <p>Provider: {selectedSession?.__provider || 'claude'}</p>
          <p>WebSocket: {ws ? '✅ 已连接' : '❌ 未连接'}</p>
          <p>消息数: {messages.length}</p>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 px-4 pb-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">📋 快速操作:</p>
          <div className="space-y-1">
            <button
              onClick={() => {
                setSelectedSession(null);
                console.log('[TestRefactored] Cleared session - ready for new conversation');
              }}
              className="w-full px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-left"
            >
              🆕 新建会话测试
            </button>
            <button
              onClick={() => {
                console.log('[TestRefactored] Current state:', {
                  projects: projects.length,
                  selectedProject: selectedProject?.name,
                  selectedSession: selectedSession?.id,
                  messages: messages.length
                });
              }}
              className="w-full px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
            >
              📊 打印状态到控制台
            </button>
            <button
              onClick={() => {
                setPanelPosition({ x: 16, y: 16 });
              }}
              className="w-full px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-left"
            >
              🔄 重置位置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TestRefactoredChat;
