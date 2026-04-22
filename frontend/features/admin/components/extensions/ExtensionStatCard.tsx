/**
 * ExtensionStatCard - Reusable statistics card for extension types
 *
 * @module features/admin/components/extensions/ExtensionStatCard
 */

import React from 'react';

/**
 * ExtensionStatCard 组件属性
 */
interface ExtensionStatCardProps {
  /** 显示标签（如 "Agents"、"Commands"） */
  label: string;
  /** 扩展条目数量 */
  count: number;
  /** Emoji 图标字符 */
  icon: string;
  /** Tailwind 颜色主题名 */
  color: 'blue' | 'green' | 'purple' | 'orange' | 'teal';
}

// 五种扩展类型对应的 Tailwind 渐变/边框/文字/徽章样式映射表
// 每种颜色包含 gradient（背景渐变）、border（边框）、label（标签文字）、value（数值文字）、badge（图标背景）
const COLOR_CLASSES = {
  // Agent 专用蓝色系
  blue: {
    gradient: 'from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20',
    border: 'border-blue-500/20 dark:border-blue-500/30',
    label: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-500/20 dark:bg-blue-500/30',
  },
  // Command 专用绿色系
  green: {
    gradient: 'from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20',
    border: 'border-green-500/20 dark:border-green-500/30',
    label: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-500/20 dark:bg-green-500/30',
  },
  // Skill 专用紫色系
  purple: {
    gradient: 'from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20',
    border: 'border-purple-500/20 dark:border-purple-500/30',
    label: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-500/20 dark:bg-purple-500/30',
  },
  // Hook 专用橙色系
  orange: {
    gradient: 'from-orange-500/10 to-orange-600/10 dark:from-orange-500/20 dark:to-orange-600/20',
    border: 'border-orange-500/20 dark:border-orange-500/30',
    label: 'text-orange-600 dark:text-orange-400',
    value: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-500/20 dark:bg-orange-500/30',
  },
  // Knowledge 专用青色系
  teal: {
    gradient: 'from-teal-500/10 to-teal-600/10 dark:from-teal-500/20 dark:to-teal-600/20',
    border: 'border-teal-500/20 dark:border-teal-500/30',
    label: 'text-teal-600 dark:text-teal-400',
    value: 'text-teal-700 dark:text-teal-300',
    badge: 'bg-teal-500/20 dark:bg-teal-500/30',
  },
} as const;

/**
 * 扩展统计卡片组件
 * 根据颜色类型渲染渐变背景、图标和数量统计
 */
export function ExtensionStatCard({ label, count, icon, color }: ExtensionStatCardProps) {
  // 从预定义样式表中选取当前颜色对应的 Tailwind 类名
  const cls = COLOR_CLASSES[color];

  return (
    // 渐变背景 + 彩色边框的卡片容器
    <div className={`bg-gradient-to-br ${cls.gradient} ${cls.border} border rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        {/* 左侧：标签文字 + 数量 */}
        <div>
          <p className={`text-sm font-medium ${cls.label}`}>{label}</p>
          <p className={`text-3xl font-bold ${cls.value} mt-1`}>{count}</p>
        </div>
        {/* 右侧：Emoji 图标徽章 */}
        <div className={`w-12 h-12 ${cls.badge} rounded-full flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
