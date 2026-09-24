/**
 * ChatInterfaceMainArea Component
 *
 * Renders the main chat area: message list + stage-aware streaming status line.
 * 思考块已内嵌消息列表（见 ThinkingBlock），此处只保留状态行。
 */

// 导入 React 核心依赖
import React, { useMemo, useState, useEffect } from 'react';
// 导入聊天消息列表组件、流式指示器
import { ChatMessageList, StreamingIndicator } from './index';
import { inferStreamStage, analyzingLabel } from '../utils/stageStatus';

interface ChatInterfaceMainAreaProps {
  // 聊天消息列表，包含用户消息、助手消息和工具调用消息
  messages: any[];
  // 任务是否进行中（isLoading：整轮会话级，直到 claude-complete 才结束。
  // 不用 isStreaming——它在每个 content_block_stop 翻 false，轮间空窗会隐藏状态行）
  isLoading: boolean;
  // 是否正在流式接收 AI 响应（轮级，仅用于消息列表滚动行为）
  isStreaming: boolean;
  // 流式接收的内容片段（未完成的响应文本）
  streamingContent: string | null;
  // 是否自动展开工具调用的详细参数和结果
  autoExpandTools: boolean;
  // 是否显示工具调用的原始 JSON 参数
  showRawParameters: boolean;
  // 是否显示 AI 的思考过程（Extended Thinking）
  showThinking: boolean;
  // 当前选中的项目名称，用于文件路径上下文
  selectedProject?: string;
  // 打开文件的回调函数，支持显示 diff 对比
  onFileOpen?: (filePath: string, diffData?: any) => void;
  // 显示设置对话框的回调函数
  onShowSettings?: () => void;
  // 创建 diff 对比数据的函数，用于文件修改展示
  createDiff: (oldStr: string, newStr: string) => any;
  // 是否自动滚动到底部（新消息到达时）
  autoScrollToBottom: boolean;
}

export function ChatInterfaceMainArea({
  messages,
  isLoading,
  isStreaming,
  streamingContent,
  autoExpandTools,
  showRawParameters,
  showThinking,
  selectedProject,
  onFileOpen,
  onShowSettings,
  createDiff,
  autoScrollToBottom,
}: ChatInterfaceMainAreaProps) {
  // 阶段推断：消息末尾反向扫描（思考中/工具执行中/响应中/分析中）
  const stage = useMemo(() => inferStreamStage(messages), [messages]);

  // 分析中的持续时间：用于文案升级（15s/60s）。空窗进入时计时，阶段变化时重置
  const [analyzingSince, setAnalyzingSince] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (isLoading && stage.stage === 'analyzing') {
      setAnalyzingSince(prev => prev ?? Date.now());
      // 每 5s 强制刷新以升级文案
      const timer = setInterval(() => forceTick(n => n + 1), 5000);
      return () => clearInterval(timer);
    }
    setAnalyzingSince(null);
    return undefined;
  }, [isLoading, stage.stage]);

  // 阶段文案：responding 沿用默认「正在响应...」，其余覆盖为具体状态
  let stageLabel: string | undefined;
  if (isLoading) {
    if (stage.stage === 'thinking') stageLabel = '深度思考中...';
    else if (stage.stage === 'tool-running') stageLabel = `正在执行：${stage.toolName || '工具'}...`;
    else if (stage.stage === 'analyzing') {
      stageLabel = analyzingLabel(analyzingSince ? Date.now() - analyzingSince : 0);
    }
    // responding：不覆盖，走默认文案 + 内容预览
  }

  return (
    <>
      {/* 消息列表组件 */}
      {/* 渲染所有历史消息，支持工具调用展开/折叠、文件打开等功能 */}
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        autoExpandTools={autoExpandTools}
        showRawParameters={showRawParameters}
        showThinking={showThinking}
        selectedProject={selectedProject}
        onFileOpen={onFileOpen}
        onShowSettings={onShowSettings}
        createDiff={createDiff}
        autoScrollToBottom={autoScrollToBottom}
      />

      {/* 流式状态行 */}
      {/* 阶段感知：深度思考中/正在执行工具/分析中（随时间升级）/正在响应。
          绑 isLoading（任务级）：思考折叠后的轮间空窗仍显示，任务结束即消失 */}
      {(isLoading || streamingContent) && (
        <div className="px-4 pb-2">
          <StreamingIndicator
            isStreaming={isLoading || isStreaming}
            content={streamingContent}
            stageLabel={stageLabel}
          />
        </div>
      )}
    </>
  );
}
