/**
 * SkillSelector 组件
 *
 * 悬停式二级菜单：鼠标移入 → 分类列表 → 悬停分类 → 右侧弹出 skills。
 * 位于 ChatToolbar 中，PermissionModeSelector 左侧。
 *
 * @module features/chat/components/SkillSelector
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// ─── 延迟关闭配置 ──────────────────────────────────────
const CLOSE_DELAY_MS = 200;

/**
 * SkillSelectorButton — 工具栏按钮
 *
 * 无选择时显示 "Skill"，选中后显示 skill 中文标题。
 */
interface SkillSelectorButtonProps {
  selectedTitle: string | null;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClear?: (e: React.MouseEvent | React.KeyboardEvent) => void;
}

function SkillSelectorButton({ selectedTitle, isOpen, onMouseEnter, onMouseLeave, onClear }: SkillSelectorButtonProps) {
  const handleClearClick = onClear
    ? (e: React.MouseEvent) => { e.stopPropagation(); onClear(e); }
    : undefined;

  /** Fix #5: 只响应 Enter 和 Space 键，避免 Tab 导航误触发 */
  const handleClearKeyDown = onClear
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClear(e);
        }
      }
    : undefined;

  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
        ${selectedTitle
          ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
    >
      {/* 目标图标 */}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span className="max-w-[120px] truncate">
        {selectedTitle || 'Skill'}
      </span>
      {/* 选中状态显示清除按钮，未选中显示下拉箭头 */}
      {selectedTitle ? (
        <span
          role="button"
          tabIndex={0}
          onClick={handleClearClick}
          onKeyDown={handleClearKeyDown}
          className="ml-0.5 p-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-700/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      ) : (
        <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </button>
  );
}

/**
 * SkillFlyoutPanel — 二级 skill 弹出面板
 *
 * 悬停分类时右侧弹出，显示该分类下所有 skill 的中文 title。
 */
interface SkillFlyoutPanelProps {
  skills: Array<{ name: string; title: string; description: string }>;
  selectedSkillName: string | null;
  onSelect: (skill: { name: string; title: string }) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SkillFlyoutPanel({ skills, selectedSkillName, onSelect, onMouseEnter, onMouseLeave }: SkillFlyoutPanelProps) {
  if (!skills || skills.length === 0) return null;

  return (
    <div
      className="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {skills.map(skill => {
        const isSelected = skill.name === selectedSkillName;
        return (
          <button
            key={skill.name}
            type="button"
            onClick={() => onSelect({ name: skill.name, title: skill.title })}
            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2
              ${isSelected
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
          >
            <span className="flex-1 truncate">{skill.title || skill.name}</span>
            {isSelected && (
              <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 分类图标 SVG 映射
 */
const CATEGORY_ICONS = {
  FileText: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Briefcase: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Code: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  GraduationCap: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  Wrench: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

/**
 * SkillCategoryMenu — 一级分类列表
 *
 * 显示分类项，悬停某项时右侧弹出 SkillFlyoutPanel。
 * 分类元数据从 props 传入（由 API 下发），不再硬编码。
 */
interface SkillCategoryMenuProps {
  groupedSkills: Record<string, Array<{ name: string; title: string; description: string }>>;
  categoryMeta: Record<string, { label: string; icon: string; color: string }>;
  categoryOrder: string[];
  selectedSkillName: string | null;
  onSelect: (skill: { name: string; title: string }) => void;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SkillCategoryMenu({ groupedSkills, categoryMeta, categoryOrder, selectedSkillName, onSelect, onClose, onMouseEnter, onMouseLeave }: SkillCategoryMenuProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const flyoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCategoryEnter = useCallback((category: string) => {
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
    setHoveredCategory(category);
  }, []);

  const handleCategoryLeave = useCallback(() => {
    flyoutTimerRef.current = setTimeout(() => {
      setHoveredCategory(null);
    }, CLOSE_DELAY_MS);
  }, []);

  const handleFlyoutEnter = useCallback(() => {
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
  }, []);

  const handleFlyoutLeave = useCallback(() => {
    flyoutTimerRef.current = setTimeout(() => {
      setHoveredCategory(null);
    }, CLOSE_DELAY_MS);
  }, []);

  const handleSelect = useCallback((skill: { name: string; title: string }) => {
    onSelect(skill);
    onClose();
  }, [onSelect, onClose]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 一级分类列表 */}
      <div className="w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
        {categoryOrder.map(category => {
          const meta = categoryMeta[category];
          const skills = groupedSkills[category];
          if (!skills || skills.length === 0 || !meta) return null;

          return (
            <div
              key={category}
              onMouseEnter={() => handleCategoryEnter(category)}
              onMouseLeave={handleCategoryLeave}
              className={`relative flex items-center gap-2 px-3 py-2.5 cursor-pointer text-sm transition-colors
                ${hoveredCategory === category
                  ? 'bg-gray-50 dark:bg-gray-700/50'
                  : 'text-gray-700 dark:text-gray-300'
                }`}
            >
              <span className={meta.color}>
                {CATEGORY_ICONS[meta.icon as keyof typeof CATEGORY_ICONS] || CATEGORY_ICONS.Wrench}
              </span>
              <span className="flex-1">{meta.label}</span>
              {/* 右箭头 */}
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* 二级 skill 弹出面板 — 跟当前分类项对齐 */}
              {hoveredCategory === category && (
                <SkillFlyoutPanel
                  skills={skills}
                  selectedSkillName={selectedSkillName}
                  onSelect={handleSelect}
                  onMouseEnter={handleFlyoutEnter}
                  onMouseLeave={handleFlyoutLeave}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────

export interface SkillOption {
  name: string;
  title: string;
}

interface SkillSelectorProps {
  /** 当前选中的 skill */
  selectedSkill: SkillOption | null;
  /** 选择 skill 回调 */
  onSkillSelect: (skill: SkillOption | null) => void;
  /** 按 category 分组的 skills */
  groupedSkills: Record<string, Array<{ name: string; title: string; description: string }>>;
  /** 分类元数据（由 API 下发） */
  categoryMeta?: Record<string, { label: string; icon: string; color: string; order: number }>;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 加载错误信息 */
  error?: string | null;
  /** 重试加载回调 */
  onRetry?: () => void;
}

/**
 * SkillSelector — 悬停式二级菜单 skill 选择器
 *
 * 鼠标移入按钮 → 一级分类列表 → 悬停分类 → 右侧弹出 skills
 * 点击 skill → 选中，面板关闭
 */
export function SkillSelector({
  selectedSkill,
  onSkillSelect,
  groupedSkills,
  categoryMeta,
  isLoading = false,
  error,
  onRetry,
}: SkillSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 从 categoryMeta 派生排序后的分类列表 */
  const categoryOrder = categoryMeta
    ? Object.entries(categoryMeta)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([key]) => key)
    : Object.keys(groupedSkills);

  const handleButtonEnter = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsOpen(true);
  }, []);

  const handleButtonLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, CLOSE_DELAY_MS);
  }, []);

  const handleMenuEnter = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleMenuLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, CLOSE_DELAY_MS);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback((skill: SkillOption) => {
    // 如果点击已选中的 skill，取消选择
    if (selectedSkill?.name === skill.name) {
      onSkillSelect(null);
    } else {
      onSkillSelect(skill);
    }
  }, [selectedSkill, onSkillSelect]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <SkillSelectorButton
        selectedTitle={selectedSkill?.title || null}
        isOpen={isOpen}
        onMouseEnter={handleButtonEnter}
        onMouseLeave={handleButtonLeave}
        onClear={() => onSkillSelect(null)}
      />

      {isOpen && !isLoading && (
        <div className="absolute bottom-full mb-2 left-0">
          {/* Fix #3: 加载失败时显示错误提示和重试按钮 */}
          {error ? (
            <div className="w-56 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg shadow-xl p-3 z-50">
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
                >
                  重试
                </button>
              )}
            </div>
          ) : (
            <SkillCategoryMenu
              groupedSkills={groupedSkills}
              categoryMeta={categoryMeta || {}}
              categoryOrder={categoryOrder}
              selectedSkillName={selectedSkill?.name || null}
              onSelect={handleSelect}
              onClose={handleClose}
              onMouseEnter={handleMenuEnter}
              onMouseLeave={handleMenuLeave}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SkillSelector;
