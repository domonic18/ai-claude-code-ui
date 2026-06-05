/**
 * Skill 分类元数据
 *
 * 优先从 API 获取后端下发的分类配置（单一定义源），
 * 本地 DEFAULT 作为 API 不可用时的兜底。
 *
 * @module features/chat/hooks/skillCategories
 */

/** 本地兜底分类配置（仅在 API 未返回时使用） */
const FALLBACK_CATEGORY_META = {
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

/**
 * 根据后端下发的分类元数据构建排序后的配置
 *
 * @param {Object} apiCategories - API 返回的分类元数据（可为 null）
 * @returns {{ meta: Object, order: string[] }}
 */
export function resolveCategoryConfig(apiCategories) {
  const meta = apiCategories || FALLBACK_CATEGORY_META;
  const order = Object.entries(meta)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key);
  return { meta, order };
}
