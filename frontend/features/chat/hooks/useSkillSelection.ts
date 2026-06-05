/**
 * useSkillSelection Hook
 *
 * 管理 skill 的获取、分组和选择状态。
 * 从 GET /api/extensions 获取 skills 列表和分类元数据，按 category 分组。
 *
 * @module features/chat/hooks/useSkillSelection
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/shared/utils/logger';
import { resolveCategoryConfig } from './skillCategories';

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

  /** @type {[string|null, Function]} 错误信息，null 表示无错误 */
  const [error, setError] = useState(null);

  /** @type {Function} 重试加载 */
  const retryCountRef = useRef(0);

  /** 清除已选 skill */
  const clearSelectedSkill = useCallback(() => {
    setSelectedSkill(null);
  }, []);

  /** API 下发的分类元数据 */
  const [apiCategories, setApiCategories] = useState(null);

  /** 按 category 分组的 skills（保持排序） */
  const groupedSkills = useMemo(() => {
    const { meta, order: categoryOrder } = resolveCategoryConfig(apiCategories);

    const groups = {};
    for (const skill of skills) {
      const cat = skill.category || 'Utility';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
    }
    // 按 categoryOrder 排序
    const ordered = {};
    for (const cat of categoryOrder) {
      if (groups[cat]) ordered[cat] = groups[cat];
    }
    // 追加未在映射中的分类
    for (const cat of Object.keys(groups)) {
      if (!ordered[cat]) ordered[cat] = groups[cat];
    }
    return ordered;
  }, [skills, apiCategories]);

  /** 分类元数据（供 SkillSelector 使用） */
  const categoryMeta = useMemo(() => {
    return resolveCategoryConfig(apiCategories).meta;
  }, [apiCategories]);

  /** 获取 skills 列表 */
  const loadSkills = useCallback(async () => {
    // 使用模块级缓存
    const now = Date.now();
    if (skillsCache && (now - skillsCacheTime) < SKILLS_CACHE_TTL_MS) {
      setSkills(skillsCache.skills || []);
      setApiCategories(skillsCache.categories || null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await (authenticatedFetch || fetch)('/api/extensions');
      const data = await response.json();

      if (data.success && Array.isArray(data.data?.skills)) {
        skillsCache = data.data;
        skillsCacheTime = Date.now();
        setSkills(data.data.skills);
        // 使用后端下发的分类元数据，替代前端硬编码
        setApiCategories(data.data.categories || null);
        retryCountRef.current = 0;
      } else {
        setError('加载技能列表失败：服务端返回格式异常');
      }
    } catch (err) {
      logger.error('[useSkillSelection] Error loading skills:', err);
      setError('加载技能列表失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedFetch]);

  /** 挂载时获取 */
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  /** 重试加载 */
  const retryLoad = useCallback(() => {
    // 清除缓存强制重新请求
    skillsCache = null;
    skillsCacheTime = 0;
    retryCountRef.current++;
    loadSkills();
  }, [loadSkills]);

  return {
    selectedSkill,
    setSelectedSkill,
    clearSelectedSkill,
    groupedSkills,
    categoryMeta,
    isLoading,
    error,
    retryLoad,
  };
}
