/**
 * API 密钥设置页面组件
 *
 * 该组件负责：
 * - 管理 API 密钥的创建、删除、激活状态切换
 * - 管理 GitHub 令牌的创建、删除、激活状态切换
 * - 显示新创建密钥的一次性提示
 * - 提供外部 API 文档链接
 *
 * @module features/settings/components/ApiKeysSettings
 */

// 导入国际化 Hook
import { useTranslation } from 'react-i18next';
// 导入 API 密钥和 GitHub 令牌管理的自定义 Hook
import { useApiKeys } from './api-keys/useApiKeys';
// 导入新密钥提示组件
import { NewKeyAlert } from './api-keys/NewKeyAlert';
// 导入 API 密钥管理区域组件
import { ApiKeySection } from './api-keys/ApiKeySection';
// 导入 GitHub 令牌管理区域组件
import { GithubTokenSection } from './api-keys/GithubTokenSection';

/**
 * API 密钥设置主组件
 * 聚合了 API 密钥和 GitHub 令牌的管理功能
 */
function ApiKeysSettings() {
  // 国际化翻译函数
  const { t } = useTranslation();
  // 从自定义 Hook 中获取所有状态和操作函数
  const {
    apiKeys,              // API 密钥列表
    githubTokens,         // GitHub 令牌列表
    loading,              // 加载状态
    newlyCreatedKey,      // 新创建的密钥对象
    setNewlyCreatedKey,   // 设置新创建密钥的函数
    createApiKey,         // 创建 API 密钥函数
    deleteApiKey,         // 删除 API 密钥函数
    toggleApiKey,         // 切换 API 密钥状态函数
    createGithubToken,    // 创建 GitHub 令牌函数
    deleteGithubToken,    // 删除 GitHub 令牌函数
    toggleGithubToken,    // 切换 GitHub 令牌状态函数
  } = useApiKeys();

  // 加载状态显示
  if (loading) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {/* 新密钥提示：只在刚创建后显示一次 */}
      {newlyCreatedKey && (
        <NewKeyAlert
          apiKey={newlyCreatedKey.apiKey}
          onDismiss={() => setNewlyCreatedKey(null)}
        />
      )}

      {/* API 密钥管理区域 */}
      <ApiKeySection
        apiKeys={apiKeys}
        onCreate={createApiKey}
        onDelete={deleteApiKey}
        onToggle={toggleApiKey}
      />

      {/* GitHub 令牌管理区域 */}
      <GithubTokenSection
        tokens={githubTokens}
        onCreate={createGithubToken}
        onDelete={deleteGithubToken}
        onToggle={toggleGithubToken}
      />

      {/* 外部 API 文档链接区域 */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-semibold mb-2">{t('apiKeys.externalApiDocumentation')}</h4>
        <p className="text-sm text-muted-foreground mb-3">{t('apiKeys.externalApiDescription')}</p>
        <a
          href="/EXTERNAL_API.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          {t('apiKeys.externalApiDocumentation')} →
        </a>
      </div>
    </div>
  );
}

export default ApiKeysSettings;
