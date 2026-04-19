/**
 * ApiKeysSettings - Settings page for managing API keys and GitHub tokens
 *
 * @module features/settings/components/ApiKeysSettings
 */

import { useTranslation } from 'react-i18next';
import { useApiKeys } from './api-keys/useApiKeys';
import { NewKeyAlert } from './api-keys/NewKeyAlert';
import { ApiKeySection } from './api-keys/ApiKeySection';
import { GithubTokenSection } from './api-keys/GithubTokenSection';

function ApiKeysSettings() {
  const { t } = useTranslation();
  const {
    apiKeys, githubTokens, loading, newlyCreatedKey, setNewlyCreatedKey,
    createApiKey, deleteApiKey, toggleApiKey,
    createGithubToken, deleteGithubToken, toggleGithubToken,
  } = useApiKeys();

  if (loading) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {newlyCreatedKey && (
        <NewKeyAlert
          apiKey={newlyCreatedKey.apiKey}
          onDismiss={() => setNewlyCreatedKey(null)}
        />
      )}

      <ApiKeySection
        apiKeys={apiKeys}
        onCreate={createApiKey}
        onDelete={deleteApiKey}
        onToggle={toggleApiKey}
      />

      <GithubTokenSection
        tokens={githubTokens}
        onCreate={createGithubToken}
        onDelete={deleteGithubToken}
        onToggle={toggleGithubToken}
      />

      {/* Documentation Link */}
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
