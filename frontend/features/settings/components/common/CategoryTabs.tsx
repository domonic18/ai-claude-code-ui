/**
 * CategoryTabs Component
 *
 * Tab navigation for switching between Permissions and MCP Servers categories.
 */

import React from 'react';

export type CategoryType = 'permissions' | 'mcp';

interface CategoryTabsProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
}

/**
 * CategoryTabs - Provides category tab navigation
 */
export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  selectedCategory,
  onSelectCategory
}) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex px-2 md:px-4 overflow-x-auto">
        <button
          onClick={() => onSelectCategory('permissions')}
          className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            selectedCategory === 'permissions'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Permissions
        </button>
        <button
          onClick={() => onSelectCategory('mcp')}
          className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            selectedCategory === 'mcp'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          MCP Servers
        </button>
      </div>
    </div>
  );
};

export default CategoryTabs;
