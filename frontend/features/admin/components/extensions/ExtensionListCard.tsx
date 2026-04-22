/**
 * ExtensionListCard - Reusable card for displaying a list of extension items
 *
 * @module features/admin/components/extensions/ExtensionListCard
 */

import React from 'react';

/**
 * ExtensionListCard 组件属性
 */
interface ExtensionListCardProps {
  /** 卡片标题 */
  title: string;
  /** 可用数量标签文案 */
  availableLabel: string;
  /** 空态提示文案 */
  emptyMessage: string;
  /** 待渲染的扩展条目列表 */
  items: Array<Record<string, string>>;
  /** 用作列表 key 的字段名 */
  keyField: string;
  /** 自定义渲染函数：接收单个条目，返回 React 节点 */
  renderItem: (item: Record<string, string>) => React.ReactNode;
}

/**
 * 通用扩展列表卡片组件
 * 包含标题头（显示类型名和可用数量）和可滚动的条目列表，条目为空时展示空态提示
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
    // 外层卡片容器：带边框和圆角
    <div className="bg-card border border-border rounded-lg">
      {/* 卡片头部：标题 + 可用数量 */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{items.length} {availableLabel}</p>
      </div>
      {/* 卡片内容：可滚动列表区域，最大高度 96 单位 */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          // 空态：居中显示提示文案
          <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
        ) : (
          // 非空：遍历 items 渲染自定义内容
          <ul className="space-y-2">
            {items.map((item) => (
              // 使用 keyField 指定的字段作为列表项 key
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
