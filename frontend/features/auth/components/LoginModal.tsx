// Lucide React 图标库
import { X } from 'lucide-react';
// 独立终端 Shell 组件
import { StandaloneShell } from '@/features/terminal';

// 支持的 CLI 提供商类型
export type Provider = 'claude' | 'cursor' | 'codex';

// 常量定义：不同提供商的登录命令
const LOGIN_COMMANDS = {
  claude: 'claude setup-token --dangerously-skip-permissions',
  cursor: 'cursor-agent login',
  // Codex 命令根据环境变量决定是否使用设备认证模式
  codex: import.meta.env.VITE_IS_PLATFORM === 'true'
    ? 'codex login --device-auth'
    : 'codex login'
};

// 常量定义：模态框标题
const MODAL_TITLES = {
  claude: 'Claude CLI Login',
  cursor: 'Cursor CLI Login',
  codex: 'Codex CLI Login',
  default: 'CLI Login'
};

/**
 * 登录模态框组件的属性接口
 */
export interface LoginModalProps {
  /** 模态框是否打开 */
  isOpen?: boolean;
  /** 关闭模态框的回调函数 */
  onClose?: () => void;
  /** CLI 提供商类型 */
  provider?: Provider;
  /** 项目信息（可选） */
  project?: {
    /** 项目名称 */
    name: string;
    /** 项目路径 */
    path: string;
    /** 项目显示名称（可选） */
    displayName?: string;
  } | null;
  /** 命令执行完成时的回调函数，接收退出码 */
  onComplete?: (exitCode: number) => void;
  /** 自定义命令（可选） */
  customCommand?: string;
}

/**
 * 可复用的登录模态框组件，用于 Claude、Cursor 和 Codex CLI 认证
 *
 * 该组件封装了一个模态对话框，内部运行独立的终端 Shell 来执行登录命令。
 * 支持 CLI 提供商的登录流程，并在命令执行成功后自动关闭。
 */
function LoginModal({
  isOpen,
  onClose,
  provider = 'claude',
  project,
  onComplete,
  customCommand
}: LoginModalProps) {
  // 如果模态框未打开，不渲染任何内容
  if (!isOpen) return null;

  /**
   * 根据提供商类型获取对应的登录命令
   * @returns {string} CLI 登录命令
   */
  const getCommand = (): string => {
    // 如果提供了自定义命令，优先使用自定义命令
    if (customCommand) return customCommand;

    // 根据提供商返回预设的登录命令
    return LOGIN_COMMANDS[provider] || LOGIN_COMMANDS.claude;
  };

  /**
   * 根据提供商类型获取模态框标题
   * @returns {string} 模态框标题文本
   */
  const getTitle = (): string => {
    return MODAL_TITLES[provider] || MODAL_TITLES.default;
  };

  /**
   * 处理命令执行完成事件
   * @param {number} exitCode - 命令的退出码（0 表示成功）
   */
  const handleComplete = (exitCode: number) => {
    // 调用完成回调函数，通知父组件命令执行结果
    if (onComplete) {
      onComplete(exitCode);
    }
    // 如果命令成功执行（退出码为 0）且存在关闭回调，则关闭模态框
    if (exitCode === 0 && onClose) {
      onClose();
    }
  };

  // 关闭按钮点击处理函数
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    // 外层遮罩层：固定定位，半透明黑色背景，最高层级
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] max-md:items-stretch max-md:justify-stretch">
      {/* 模态框主体：白色背景，圆角阴影，响应式尺寸 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col md:max-w-4xl md:h-3/4 md:rounded-lg md:m-4 max-md:max-w-none max-md:h-full max-md:rounded-none max-md:m-0">
        {/* 模态框头部：包含标题和关闭按钮 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {/* 动态标题，根据提供商类型显示 */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getTitle()}
          </h3>
          {/* 关闭按钮：仅在提供了 onClose 回调时显示 */}
          {onClose && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close login modal"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
        {/* 终端 Shell 容器：占据剩余空间，允许内部滚动 */}
        <div className="flex-1 overflow-hidden">
          <StandaloneShell
            project={project}
            command={getCommand()}
            onComplete={handleComplete}
            minimal={true}
          />
        </div>
      </div>
    </div>
  );
}

export default LoginModal;
