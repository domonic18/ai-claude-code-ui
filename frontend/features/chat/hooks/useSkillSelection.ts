/**
 * useSkillSelection Hook
 *
 * 管理 skill 的获取、分组和选择状态。
 * 从 GET /api/extensions 获取 skills 列表，按 category 分组。
 *
 * @module features/chat/hooks/useSkillSelection
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/shared/utils/logger';
import { CATEGORY_ORDER } from './skillCategories';

/**
 * @typedef {Object} SkillOption
 * @property {string} name - 技能标识符
 * @property {string} title - 短中文名称
 * @property {string} description - 功能描述
 * @property {string} category - 分类名
 */

/** Skills API 缓存（模块级，跨 hook 实例共享） */
let skillsCache = null;
let skillsCacheTime = 0;
const SKILLS_CACHE_TTL_MS = 30_000;

/**
 * Skill 选择状态管理 Hook
 *
 * @param {Function} authenticatedFetch - 带认证的 fetch 函数
 * @returns {Object} Skill 选择状态和操作
 */
export function useSkillSelection(authenticatedFetch) {
  /** @type {[SkillOption|null, Function]} */
  const [selectedSkill, setSelectedSkill] = useState(null);

  /** @type {[SkillOption[], Function]} */
  const [skills, setSkills] = useState([]);

  /** @type {[boolean, Function]} */
  const [isLoading, setIsLoading] = useState(false);

  /** 清除已选 skill */
  const clearSelectedSkill = useCallback(() => {
    setSelectedSkill(null);
  }, []);

  /** 按 category 分组的 skills（保持排序） */
  const groupedSkills = useMemo(() => {
    const groups = {};
    for (const skill of skills) {
      const cat = skill.category || 'Utility';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
    }
    // 按 CATEGORY_ORDER 排序
    const ordered = {};
    for (const cat of CATEGORY_ORDER) {
      if (groups[cat]) ordered[cat] = groups[cat];
    }
    // 追加未在映射中的分类
    for (const cat of Object.keys(groups)) {
      if (!ordered[cat]) ordered[cat] = groups[cat];
    }
    return ordered;
  }, [skills]);

  /** 挂载时获取 skills 列表 */
  useEffect(() => {
    const loadSkills = async () => {
      // 使用模块级缓存
      const now = Date.now();
      if (skillsCache && (now - skillsCacheTime) < SKILLS_CACHE_TTL_MS) {
        setSkills(skillsCache);
        return;
      }

      setIsLoading(true);
      try {
        const response = await (authenticatedFetch || fetch)('/api/extensions');
        const data = await response.json();

        if (data.success && Array.isArray(data.data?.skills)) {
          skillsCache = data.data.skills;
          skillsCacheTime = Date.now();
          setSkills(data.data.skills);
        }
      } catch (error) {
        logger.error('[useSkillSelection] Error loading skills:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSkills();
  }, [authenticatedFetch]);

  return {
    selectedSkill,
    setSelectedSkill,
    clearSelectedSkill,
    groupedSkills,
    isLoading,
  };
}
