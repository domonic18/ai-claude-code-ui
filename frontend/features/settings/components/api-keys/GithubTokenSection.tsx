/**
 * GithubTokenSection - GitHub token list with create/toggle/delete actions
 *
 * @module features/settings/components/api-keys/GithubTokenSection
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Github, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';

interface GithubToken {
  id: string;
  credential_name: string;
  is_active: boolean;
  created_at: string;
}

interface GithubTokenSectionProps {
  tokens: GithubToken[];
  onCreate: (name: string, value: string, onSuccess: () => void) => void;
  onDelete: (id: string, confirmMsg: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

interface TokenCreateFormProps {
  tokenName: string;
  setTokenName: (name: string) => void;
  tokenValue: string;
  setTokenValue: (value: string) => void;
  showToken: boolean;
  setShowToken: (show: boolean) => void;
  onCreate: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}

/** Renders the token creation form */
function TokenCreateForm({
  tokenName,
  setTokenName,
  tokenValue,
  setTokenValue,
  showToken,
  setShowToken,
  onCreate,
  onCancel,
  t,
}: TokenCreateFormProps) {
  return (
    <div className="mb-4 p-4 border rounded-lg bg-card">
      <Input
        placeholder={t('apiKeys.tokenNamePlaceholder')}
        value={tokenName}
        onChange={(e) => setTokenName(e.target.value)}
        className="mb-2"
      />
      <div className="relative">
        <Input
          type={showToken ? 'text' : 'password'}
          placeholder={t('apiKeys.githubTokenPlaceholder')}
          value={tokenValue}
          onChange={(e) => setTokenValue(e.target.value)}
          className="mb-2 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowToken(!showToken)}
          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
        >
          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex gap-2">
        <Button onClick={onCreate}>{t('apiKeys.addToken')}</Button>
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

interface TokenListItemProps {
  token: GithubToken;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string, confirmMsg: string) => void;
  t: (key: string) => string;
}

/** Renders a single token item with toggle and delete actions */
function TokenListItem({ token, onToggle, onDelete, t }: TokenListItemProps) {
  return (
    <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1">
        <div className="font-medium">{token.credential_name}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {t('credentials.added')}: {new Date(token.created_at).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={token.is_active ? 'outline' : 'secondary'}
          onClick={() => onToggle(token.id, token.is_active)}
        >
          {token.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(token.id, t('apiKeys.confirmDeleteToken'))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Renders GitHub tokens section with create form and token list */
export function GithubTokenSection({ tokens, onCreate, onDelete, onToggle }: GithubTokenSectionProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleCreate = () => {
    onCreate(tokenName, tokenValue, () => {
      setTokenName('');
      setTokenValue('');
      setShowForm(false);
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setTokenName('');
    setTokenValue('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{t('apiKeys.githubTokens')}</h3>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('apiKeys.addToken')}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{t('apiKeys.githubTokensDescription')}</p>

      {showForm && (
        <TokenCreateForm
          tokenName={tokenName}
          setTokenName={setTokenName}
          tokenValue={tokenValue}
          setTokenValue={setTokenValue}
          showToken={showToken}
          setShowToken={setShowToken}
          onCreate={handleCreate}
          onCancel={handleCancel}
          t={t}
        />
      )}

      <div className="space-y-2">
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('apiKeys.noGithubTokens')}</p>
        ) : (
          tokens.map((token) => (
            <TokenListItem
              key={token.id}
              token={token}
              onToggle={onToggle}
              onDelete={onDelete}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}
