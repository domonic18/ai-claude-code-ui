/**
 * VersionBanner Component
 *
 * Banner displaying version update availability.
 *
 * Features:
 * - Shows when update is available
 * - Displays current and latest version
 * - Link to view details
 */

import React, { memo } from 'react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import type { VersionBannerProps } from '../types/sidebar.types';

/**
 * VersionBanner Component
 */
export const VersionBanner = memo(function VersionBanner({
  updateAvailable,
  latestVersion,
  currentVersion,
  onShowVersionModal,
}: VersionBannerProps) {
  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-border bg-primary/5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="shrink-0">
            New Version
          </Badge>
          <span className="text-sm text-foreground truncate">
            {latestVersion} available
            {currentVersion && ` (you have ${currentVersion})`}
          </span>
        </div>
        {onShowVersionModal && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShowVersionModal}
            className="shrink-0 h-7 text-xs"
          >
            View
          </Button>
        )}
      </div>
    </div>
  );
});

export default VersionBanner;
