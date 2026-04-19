/**
 * useApiKeys - Custom hook for API key and GitHub token CRUD operations
 *
 * @module features/settings/components/api-keys/useApiKeys
 */

import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

/** Manages API keys and GitHub tokens data fetching */
export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState([]);
  const [githubTokens, setGithubTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const apiKeysRes = await authenticatedFetch('/api/settings/api-keys');
      const apiKeysData = await apiKeysRes.json();
      setApiKeys(apiKeysData.apiKeys || []);

      const githubRes = await authenticatedFetch('/api/settings/credentials?type=github_token');
      const githubData = await githubRes.json();
      setGithubTokens(githubData.credentials || []);
    } catch (error) {
      logger.error('Error fetching settings:', error);
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
      const data = await res.json();
      if (data.success) {
        setNewlyCreatedKey(data.apiKey);
        onSuccess();
        fetchData();
      }
    } catch (error) {
      logger.error('Error creating API key:', error);
    }
  }, [fetchData]);

  const deleteApiKey = useCallback(async (keyId: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    try {
      await authenticatedFetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      logger.error('Error deleting API key:', error);
    }
  }, [fetchData]);

  const toggleApiKey = useCallback(async (keyId: string, isActive: boolean) => {
    try {
      await authenticatedFetch(`/api/settings/api-keys/${keyId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive })
      });
      fetchData();
    } catch (error) {
      logger.error('Error toggling API key:', error);
    }
  }, [fetchData]);

  const createGithubToken = useCallback(async (name: string, value: string, onSuccess: () => void) => {
    if (!name.trim() || !value.trim()) return;
    try {
      const res = await authenticatedFetch('/api/settings/credentials', {
        method: 'POST',
        body: JSON.stringify({ credentialName: name, credentialType: 'github_token', credentialValue: value })
      });
      const data = await res.json();
      if (data.success) { onSuccess(); fetchData(); }
    } catch (error) {
      logger.error('Error creating GitHub token:', error);
    }
  }, [fetchData]);

  const deleteGithubToken = useCallback(async (tokenId: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    try {
      await authenticatedFetch(`/api/settings/credentials/${tokenId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      logger.error('Error deleting GitHub token:', error);
    }
  }, [fetchData]);

  const toggleGithubToken = useCallback(async (tokenId: string, isActive: boolean) => {
    try {
      await authenticatedFetch(`/api/settings/credentials/${tokenId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive })
      });
      fetchData();
    } catch (error) {
      logger.error('Error toggling GitHub token:', error);
    }
  }, [fetchData]);

  return {
    apiKeys, githubTokens, loading, newlyCreatedKey, setNewlyCreatedKey,
    createApiKey, deleteApiKey, toggleApiKey,
    createGithubToken, deleteGithubToken, toggleGithubToken,
  };
}
