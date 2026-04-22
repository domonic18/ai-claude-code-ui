/**
 * Extension Management Type Definitions
 *
 * @module features/admin/components/extensions/types
 */

/** Agent 扩展数据：对应 ~/.claude/agents/ 下的 YAML 配置文件 */
export interface Agent {
  /** 来源文件名（含扩展名） */
  filename: string;
  /** Agent 名称 */
  name: string;
  /** Agent 功能描述 */
  description: string;
}

/** Command 扩展数据：对应 ~/.claude/commands/ 下的斜杠命令文件 */
export interface Command {
  /** 来源文件名（含扩展名） */
  filename: string;
  /** 斜杠命令名称，用户在聊天中输入 /name 触发 */
  name: string;
}

/** Skill 扩展数据：对应 ~/.claude/skills/ 下的技能配置 */
export interface Skill {
  /** 技能名称 */
  name: string;
  /** 技能功能描述 */
  description: string;
}

/** Hook 扩展数据：对应 ~/.claude/hooks/ 下的生命周期钩子 */
export interface Hook {
  /** 来源文件名 */
  filename: string;
  /** 钩子名称 */
  name: string;
  /** 钩子触发时机类型 */
  type: string;
  /** 钩子功能描述 */
  description: string;
}

/** Knowledge 扩展数据：对应 ~/.claude/knowledge/ 下的知识库文件 */
export interface Knowledge {
  /** 来源文件名 */
  filename: string;
  /** 知识库名称 */
  name: string;
  /** 知识库类型（如 markdown、pdf 等） */
  type: string;
  /** 知识库内容描述 */
  description: string;
}

/** 聚合扩展数据：GET /api/extensions 返回的五类扩展集合 */
export interface ExtensionsData {
  /** Agent 列表 */
  agents: Agent[];
  /** Command 列表 */
  commands: Command[];
  /** Skill 列表 */
  skills: Skill[];
  /** Hook 列表（可选，可能为空） */
  hooks?: Hook[];
  /** Knowledge 列表（可选，可能为空） */
  knowledge?: Knowledge[];
}

/** 同步操作结果：POST /api/extensions/sync-all 返回的统计信息 */
export interface SyncResults {
  /** 参与同步的用户总数 */
  total: number;
  /** 同步成功的用户数 */
  synced: number;
  /** 同步失败的用户数 */
  failed: number;
  /** 失败用户的详细错误列表 */
  errors: Array<{ userId: number; username: string; error: string }>;
}
