/**
 * ProjectSearch Component
 *
 * Search input field for filtering projects by name or path.
 *
 * Features:
 * - Search icon
 * - Clear button when filter has value
 * - Debounced search (handled by parent)
 * - Responsive design
 */

import React, { memo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import type { ProjectSearchProps } from '../types/sidebar.types';

/**
 * ProjectSearch Component
 */
export const ProjectSearch = memo(function ProjectSearch({
  searchFilter,
  onSearchChange,
  onClearSearch,
}: ProjectSearchProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const handleClear = useCallback(() => {
    onClearSearch();
    onSearchChange('');
  }, [onClearSearch, onSearchChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder="Search projects..."
        value={searchFilter}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-10 h-9"
      />
      {searchFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-accent"
          onClick={handleClear}
          title="Clear search"
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
});

export default ProjectSearch;
