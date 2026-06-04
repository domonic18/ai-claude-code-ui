/**
 * Skill 分类元数据常量
 *
 * 定义 skill 分类的显示名称、图标和排序权重。
 * 与后端 extension-reader.js 的 SKILL_CATEGORIES 映射保持一致。
 *
 * @module features/chat/hooks/skillCategories
 */

/**
 * Skill 分类显示元数据
 * @typedef {Object} CategoryMeta
 * @property {string} label - 分类中文显示名
 * @property {string} icon - lucide-react 图标名
 * @property {string} color - Tailwind 颜色类（用于图标和文字）
 * @property {number} order - 排序权重（越小越靠前）
 */
export const SKILL_CATEGORY_META = {
  'Patent Document': {
    label: '专利文档',
    icon: 'FileText',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    order: 1,
  },
  'Business & Strategy': {
    label: '商业战略',
    icon: 'Briefcase',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    order: 2,
  },
  'Technical Documents': {
    label: '技术文档',
    icon: 'Code',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    order: 3,
  },
  'Academic Papers': {
    label: '学术论文',
    icon: 'GraduationCap',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    order: 4,
  },
  'Utility': {
    label: '工具',
    icon: 'Wrench',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    order: 5,
  },
};

/** 分类排序后的键列表 */
export const CATEGORY_ORDER = Object.entries(SKILL_CATEGORY_META)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key]) => key);
