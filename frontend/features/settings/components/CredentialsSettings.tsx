/**
 * CredentialsSettings - API key management with version info
 *
 * @module features/settings/components/CredentialsSettings
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { authenticatedFetch } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import { NewKeyAlert } from './api-keys/NewKeyAlert';
import { ApiKeySection } from './api-keys/ApiKeySection';

const APP_VERSION = '1.13.6';

/** Custom hook for credentials-specific API key operations */
function useCredentialsApiKeys() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch('/api/settings/api-keys');
      if (res.ok) {
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const createApiKey = useCallback(async (keyName: string, onSuccess: () => void) => {
    if (!keyName.trim()) return;
    try {
      const res = await authenticatedFetch('/api/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ keyName })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) { setNewlyCreatedKey(data.apiKey); onSuccess(); fetchData(); }
      }
    } catch (error) {
      logger.error('Error creating API key:', error);
    }
  }, [fetchData]);

  const deleteApiKey = useCallback(async (keyId: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    try {
      const res = await authenticatedFetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (error) {
      logger.error('Error deleting API key:', error);
    }
  }, [fetchData]);

  const toggleApiKey = useCallback(async (keyId: string, isActive: boolean) => {
    try {
      const res = await authenticatedFetch(`/api/settings/api-keys/${keyId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive })
      });
      if (res.ok) fetchData();
    } catch (error) {
      logger.error('Error toggling API key:', error);
    }
  }, [fetchData]);

  return { apiKeys, loading, newlyCreatedKey, setNewlyCreatedKey, createApiKey, deleteApiKey, toggleApiKey };
}

function CredentialsSettings() {
  const { t } = useTranslation();
  const { apiKeys, loading, newlyCreatedKey, setNewlyCreatedKey, createApiKey, deleteApiKey, toggleApiKey } =
    useCredentialsApiKeys();

  if (loading) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {newlyCreatedKey && (
        <NewKeyAlert apiKey={newlyCreatedKey.apiKey} onDismiss={() => setNewlyCreatedKey(null)} />
      )}

      <div>
        <ApiKeySection
          apiKeys={apiKeys}
          onCreate={createApiKey}
          onDelete={deleteApiKey}
          onToggle={toggleApiKey}
        />
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

      <div className="pt-6 border-t border-border/50">
        <div className="flex items-center justify-between text-xs italic text-muted-foreground/60">
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
