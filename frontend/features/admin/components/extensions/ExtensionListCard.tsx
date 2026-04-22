/**
 * ExtensionListCard - Reusable card for displaying a list of extension items
 *
 * @module features/admin/components/extensions/ExtensionListCard
 */

import React from 'react';

interface ExtensionListCardProps {
  /** Card title */
  title: string;
  /** Available count label */
  availableLabel: string;
  /** Empty state message */
  emptyMessage: string;
  /** Items to render */
  items: Array<Record<string, string>>;
  /** Unique key field name */
  keyField: string;
  /** Render function for each item */
  renderItem: (item: Record<string, string>) => React.ReactNode;
}

// 由父组件调用，React 组件或常量：ExtensionListCard
/**
 * Displays a card with header and scrollable item list
 */
export function ExtensionListCard({
  title,
  availableLabel,
  emptyMessage,
  items,
  keyField,
  renderItem,
}: ExtensionListCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{items.length} {availableLabel}</p>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item[keyField]} className="text-sm">
                {renderItem(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
