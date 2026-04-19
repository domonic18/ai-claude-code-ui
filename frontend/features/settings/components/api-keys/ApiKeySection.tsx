/**
 * ApiKeySection - API key list with create/toggle/delete actions
 *
 * @module features/settings/components/api-keys/ApiKeySection
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  last_used?: string;
}

interface ApiKeySectionProps {
  apiKeys: ApiKey[];
  onCreate: (name: string, onSuccess: () => void) => void;
  onDelete: (id: string, confirmMsg: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

/** Renders API keys section with create form and key list */
export function ApiKeySection({ apiKeys, onCreate, onDelete, onToggle }: ApiKeySectionProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const handleCreate = () => {
    onCreate(newKeyName, () => { setNewKeyName(''); setShowForm(false); });
  };

  return (
    <div>
      <SectionHeader
        icon={<Key className="h-5 w-5" />}
        title={t('apiKeys.title')}
        buttonLabel={t('apiKeys.newApiKey')}
        onToggleForm={() => setShowForm(!showForm)}
      />
      <p className="text-sm text-muted-foreground mb-4">{t('apiKeys.description')}</p>

      {showForm && (
        <div className="mb-4 p-4 border rounded-lg bg-card">
          <Input
            placeholder={t('credentials.keyNamePlaceholder')}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate}>{t('credentials.create')}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('apiKeys.noApiKeys')}</p>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{key.key_name}</div>
                <code className="text-xs text-muted-foreground">{key.api_key}</code>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('apiKeys.created')}: {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used && ` • ${t('apiKeys.lastUsed')}: ${new Date(key.last_used).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={key.is_active ? 'outline' : 'secondary'}
                  onClick={() => onToggle(key.id, key.is_active)}>
                  {key.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(key.id, t('apiKeys.confirmDeleteKey'))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Reusable section header with icon and add button */
function SectionHeader({ icon, title, buttonLabel, onToggleForm }: {
  icon: React.ReactNode;
  title: string;
  buttonLabel: string;
  onToggleForm: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <Button size="sm" onClick={onToggleForm}>
        <Plus className="h-4 w-4 mr-1" />
        {buttonLabel}
      </Button>
    </div>
  );
}
