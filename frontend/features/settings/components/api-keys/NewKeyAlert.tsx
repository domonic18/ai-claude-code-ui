/**
 * NewKeyAlert - Alert displayed after creating a new API key
 *
 * @module features/settings/components/api-keys/NewKeyAlert
 */

import { Check, Copy } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface NewKeyAlertProps {
  apiKey: string;
  onDismiss: () => void;
}

/** Shows newly created API key with copy button and dismissal */
export function NewKeyAlert({ apiKey, onDismiss }: NewKeyAlertProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
      <h4 className="font-semibold text-yellow-500 mb-2">{t('credentials.saveKeyAlert.title')}</h4>
      <p className="text-sm text-muted-foreground mb-3">{t('credentials.saveKeyAlert.message')}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-background/50 rounded font-mono text-sm break-all">
          {apiKey}
        </code>
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="mt-3" onClick={onDismiss}>
        {t('credentials.saveKeyAlert.saved')}
      </Button>
    </div>
  );
}
