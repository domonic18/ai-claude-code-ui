import { useState, useEffect } from 'react';

export interface ReleaseInfo {
  title: string;
  body: string;
  htmlUrl: string;
  publishedAt?: string;
}

export interface UseVersionCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
  currentVersion: string;
  releaseInfo: ReleaseInfo | null;
}

/**
 * Hook to check for updates from GitHub releases
 *
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @returns Version check result
 */
export function useVersionCheck(owner: string, repo: string): UseVersionCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);

  // Get current version from package.json
  const currentVersion: string = ''; // Will be set from package.json

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
        const data = await response.json();

        if (data.tag_name) {
          const latest = data.tag_name.replace(/^v/, '');
          setLatestVersion(latest);
          setUpdateAvailable(currentVersion !== latest);

          setReleaseInfo({
            title: data.name || data.tag_name,
            body: data.body || '',
            htmlUrl: data.html_url || `https://github.com/${owner}/${repo}/releases/latest`,
            publishedAt: data.published_at
          });
        } else {
          setUpdateAvailable(false);
          setLatestVersion(null);
          setReleaseInfo(null);
        }
      } catch (error) {
        console.error('Version check failed:', error);
        setUpdateAvailable(false);
        setLatestVersion(null);
        setReleaseInfo(null);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [owner, repo, currentVersion]);

  return { updateAvailable, latestVersion, currentVersion, releaseInfo };
}
