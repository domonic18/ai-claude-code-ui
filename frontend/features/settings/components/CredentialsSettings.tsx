import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Key, Plus, Trash2, Copy, Check, ExternalLink } from 'lucide-react';
import { useVersionCheck } from '@/shared/hooks/useVersionCheck';
import { authenticatedFetch } from '@/shared/services';

// Version - will be displayed in UI
const APP_VERSION = '1.13.6';

function CredentialsSettings() {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  // Version check hook
  const { updateAvailable, latestVersion, releaseInfo } = useVersionCheck('siteboon', 'claudecodeui');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch API keys
      const apiKeysRes = await authenticatedFetch('/api/settings/api-keys');
      if (apiKeysRes.ok) {
        const contentType = apiKeysRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const apiKeysData = await apiKeysRes.json();
          setApiKeys(apiKeysData.apiKeys || []);
        } else {
          console.warn('[CredentialsSettings] API keys endpoint returned non-JSON response');
          setApiKeys([]);
        }
      } else {
        console.warn(`[CredentialsSettings] API keys endpoint returned status: ${apiKeysRes.status}`);
        setApiKeys([]);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setApiKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await authenticatedFetch('/api/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ keyName: newKeyName })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNewlyCreatedKey(data.apiKey);
          setNewKeyName('');
          setShowNewKeyForm(false);
          fetchData();
        }
      } else {
        console.error(`Error creating API key: ${res.status}`);
      }
    } catch (error) {
      console.error('Error creating API key:', error);
    }
  };

  const deleteApiKey = async (keyId) => {
    if (!confirm(t('apiKeys.confirmDeleteKey'))) return;

    try {
      const res = await authenticatedFetch(`/api/settings/api-keys/${keyId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        console.error(`Error deleting API key: ${res.status}`);
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const toggleApiKey = async (keyId, isActive) => {
    try {
      const res = await authenticatedFetch(`/api/settings/api-keys/${keyId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive })
      });
      if (res.ok) {
        fetchData();
      } else {
        console.error(`Error toggling API key: ${res.status}`);
      }
    } catch (error) {
      console.error('Error toggling API key:', error);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      {/* New API Key Alert */}
      {newlyCreatedKey && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <h4 className="font-semibold text-yellow-500 mb-2">{t('credentials.saveKeyAlert.title')}</h4>
          <p className="text-sm text-muted-foreground mb-3">
            {t('credentials.saveKeyAlert.message')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-background/50 rounded font-mono text-sm break-all">
              {newlyCreatedKey.apiKey}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(newlyCreatedKey.apiKey, 'new')}
            >
              {copiedKey === 'new' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => setNewlyCreatedKey(null)}
          >
            {t('credentials.saveKeyAlert.saved')}
          </Button>
        </div>
      )}

      {/* API Keys Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <h3 className="text-lg font-semibold">{t('credentials.title')}</h3>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNewKeyForm(!showNewKeyForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('credentials.newKey')}
          </Button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">
            {t('credentials.description')}
          </p>
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

        {showNewKeyForm && (
          <div className="mb-4 p-4 border rounded-lg bg-card">
            <Input
              placeholder={t('credentials.keyNamePlaceholder')}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="mb-2"
            />
            <div className="flex gap-2">
              <Button onClick={createApiKey}>{t('credentials.create')}</Button>
              <Button variant="outline" onClick={() => setShowNewKeyForm(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t('credentials.noKeys')}</p>
          ) : (
            apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{key.key_name}</div>
                  <code className="text-xs text-muted-foreground">{key.api_key}</code>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('apiKeys.created')}: {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used && ` • ${t('apiKeys.lastUsed')}: ${new Date(key.last_used).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={key.is_active ? 'outline' : 'secondary'}
                    onClick={() => toggleApiKey(key.id, key.is_active)}
                  >
                    {key.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteApiKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Version Information */}
      <div className="pt-6 border-t border-border/50">
        <div className="flex items-center justify-between text-xs italic text-muted-foreground/60">
          <a
            href={releaseInfo?.htmlUrl || 'https://github.com/domonic18/ai-claude-code-ui/releases'}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            v{APP_VERSION}
          </a>
          {updateAvailable && latestVersion && (
            <a
              href={releaseInfo?.htmlUrl || 'https://github.com/domonic18/ai-claude-code-ui/releases'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full hover:bg-green-500/20 transition-colors not-italic font-medium"
            >
              <span className="text-[10px]">{t('credentials.updateAvailable')}: v{latestVersion}</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default CredentialsSettings;
