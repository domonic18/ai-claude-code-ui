/**
 * Extension Management Type Definitions
 *
 * @module features/admin/components/extensions/types
 */

/** Agent extension data */
export interface Agent {
  filename: string;
  name: string;
  description: string;
}

/** Command extension data */
export interface Command {
  filename: string;
  name: string;
}

/** Skill extension data */
export interface Skill {
  name: string;
  description: string;
}

/** Hook extension data */
export interface Hook {
  filename: string;
  name: string;
  type: string;
  description: string;
}

/** Knowledge extension data */
export interface Knowledge {
  filename: string;
  name: string;
  type: string;
  description: string;
}

/** Aggregated extensions data from API */
export interface ExtensionsData {
  agents: Agent[];
  commands: Command[];
  skills: Skill[];
  hooks?: Hook[];
  knowledge?: Knowledge[];
}

/** Result of syncing extensions to all users */
export interface SyncResults {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ userId: number; username: string; error: string }>;
}
