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

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';

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
          <p>组件路径: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">features/chat/components/ChatInterface.tsx</code></p>
          <p>用户状态: {user ? '✅ 已登录' : '❌ 未登录'}</p>
          <p>项目: {selectedProject ? selectedProject.name : '未选择'}</p>
          <p>会话: {selectedSession ? selectedSession.id : '未选择'}</p>
        </div>
      </div>
    </div>
  );
}

export default TestRefactoredChat;
