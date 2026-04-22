/**
 * 凭据设置组件 - API 密钥管理与版本信息显示
 *
 * 该组件负责：
 * - 显示和管理用户的 API 密钥列表
 * - 创建新的 API 密钥
 * - 切换 API 密钥的激活状态
 * - 删除 API 密钥
 * - 显示新创建的密钥提示（仅一次）
 * - 显示应用版本信息
 *
 * @module features/settings/components/CredentialsSettings
 */

// 导入 React Hooks：状态管理、副作用、回调函数
import { useState, useEffect, useCallback } from 'react';
// 导入国际化 Hook
import { useTranslation } from 'react-i18next';
// 导入外部链接图标
import { ExternalLink } from 'lucide-react';
// 导入应用配置（包含仓库地址等信息）
import { APP_CONFIG } from '@/config/app.config';
// 导入认证请求服务
import { authenticatedFetch } from '@/shared/services';
// 导入日志工具
import { logger } from '@/shared/utils/logger';
// 导入新密钥提示组件
import { NewKeyAlert } from './api-keys/NewKeyAlert';
// 导入 API 密钥区域组件
import { ApiKeySection } from './api-keys/ApiKeySection';

// 应用版本常量
const APP_VERSION = '1.13.6';

/**
 * 自定义 Hook：管理 API 密钥的增删改查操作
 * 封装了 API 密钥的数据获取和状态管理逻辑
 */
function useCredentialsApiKeys() {
  // API 密钥列表状态
  const [apiKeys, setApiKeys] = useState([]);
  // 加载状态标志
  const [loading, setLoading] = useState(true);
  // 新创建的密钥对象（用于显示一次性提示）
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  /**
   * 从后端获取 API 密钥列表
   * 处理响应类型检查和错误状态
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 请求后端 API 获取密钥列表
      const res = await authenticatedFetch('/api/settings/api-keys');
      if (res.ok) {
        // 检查响应内容类型，确保是 JSON 格式
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await res.json();
          setApiKeys(data.apiKeys || []);
        } else {
          setApiKeys([]);
        }
      } else {
        setApiKeys([]);
      }
    } catch (error) {
      logger.error('Error fetching settings:', error);
      setApiKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 组件挂载时自动获取数据
  useEffect(() => { fetchData(); }, [fetchData]);

  /**
   * 创建新的 API 密钥
   * @param {string} keyName - 密钥名称
   * @param {Function} onSuccess - 创建成功后的回调函数
   */
  const createApiKey = useCallback(async (keyName: string, onSuccess: () => void) => {
    // 验证密钥名称非空
    if (!keyName.trim()) return;
    try {
      const res = await authenticatedFetch('/api/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ keyName })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // 保存新创建的密钥对象，用于显示提示
          setNewlyCreatedKey(data.apiKey);
          onSuccess();
          fetchData();  // 刷新列表
        }
      }
    } catch (error) {
      logger.error('Error creating API key:', error);
    }
  }, [fetchData]);

  /**
   * 删除指定的 API 密钥
   * @param {string} keyId - 要删除的密钥 ID
   * @param {string} confirmMsg - 确认对话框的消息
   */
  const deleteApiKey = useCallback(async (keyId: string, confirmMsg: string) => {
    // 显示确认对话框
    if (!confirm(confirmMsg)) return;
    try {
      const res = await authenticatedFetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' });
      if (res.ok) fetchData();  // 删除成功后刷新列表
    } catch (error) {
      logger.error('Error deleting API key:', error);
    }
  }, [fetchData]);

  /**
   * 切换 API 密钥的激活状态
   * @param {string} keyId - 密钥 ID
   * @param {boolean} isActive - 当前激活状态
   */
  const toggleApiKey = useCallback(async (keyId: string, isActive: boolean) => {
    try {
      const res = await authenticatedFetch(`/api/settings/api-keys/${keyId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive })  // 反转状态
      });
      if (res.ok) fetchData();  // 切换成功后刷新列表
    } catch (error) {
      logger.error('Error toggling API key:', error);
    }
  }, [fetchData]);

  // 返回所有状态和操作函数
  return { apiKeys, loading, newlyCreatedKey, setNewlyCreatedKey, createApiKey, deleteApiKey, toggleApiKey };
}

/**
 * 凭据设置主组件
 * 渲染 API 密钥管理界面和版本信息
 */
function CredentialsSettings() {
  // 国际化翻译函数
  const { t } = useTranslation();
  // 使用自定义 Hook 获取所有状态和操作函数
  const { apiKeys, loading, newlyCreatedKey, setNewlyCreatedKey, createApiKey, deleteApiKey, toggleApiKey } =
    useCredentialsApiKeys();

  // 加载状态显示
  if (loading) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {/* 新密钥提示：只在刚创建后显示一次 */}
      {newlyCreatedKey && (
        <NewKeyAlert apiKey={newlyCreatedKey.apiKey} onDismiss={() => setNewlyCreatedKey(null)} />
      )}

      {/* API 密钥管理区域 */}
      <div>
        <ApiKeySection
          apiKeys={apiKeys}
          onCreate={createApiKey}
          onDelete={deleteApiKey}
          onToggle={toggleApiKey}
        />
        {/* API 文档链接 */}
        <div className="mb-4 mt-2">
          <a
            href="/api-docs.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {t('credentials.documentation')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* 应用版本信息区域 */}
      <div className="pt-6 border-t border-border/50">
        <div className="flex items-center justify-between text-xs italic text-muted-foreground/60">
          {/* 版本号链接，指向 GitHub releases 页面 */}
          <a
            href={`${APP_CONFIG.repository}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            v{APP_VERSION}
          </a>
        </div>
      </div>
    </div>
  );
}

export default CredentialsSettings;
