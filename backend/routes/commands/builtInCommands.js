/**
 * Built-in Commands
 *
 * Definitions and handlers for built-in slash commands.
 *
 * @module routes/commands/builtInCommands
 */

import { promises as fs } from 'fs';
import path from 'path';
import { CLAUDE_MODELS, CURSOR_MODELS, CODEX_MODELS } from '../../../shared/modelConstants.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('commands/builtIn');

/**
 * Always-available built-in command definitions
 * @type {Array<{name: string, description: string, namespace: string, metadata: object}>}
 */
export const builtInCommands = [
  {
    name: '/help',
    description: 'Show help documentation for Claude Code',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/clear',
    description: 'Clear the conversation history',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/model',
    description: 'Switch or view the current AI model',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/cost',
    description: 'Display token usage and cost information',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/memory',
    description: 'Open CLAUDE.md memory file for editing',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/config',
    description: 'Open settings and configuration',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/status',
    description: 'Show system status and version information',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  },
  {
    name: '/rewind',
    description: 'Rewind the conversation to a previous state',
    namespace: 'builtin',
    metadata: { type: 'builtin' }
  }
];

/**
 * Built-in command handlers
 * Each handler returns { type: 'builtin', action: string, data: any }
 * @type {Record<string, (args: string[], context: object) => Promise<object>>}
 */
export const builtInHandlers = {
  '/help': async (args, context) => {
    const helpText = `# Claude Code Commands

## Built-in Commands

${builtInCommands.map(cmd => `### ${cmd.name}
${cmd.description}
`).join('\n')}

## Custom Commands

Custom commands can be created in:
- Project: \`.claude/commands/\` (project-specific)
- User: \`~/.claude/commands/\` (available in all projects)

### Command Syntax

- **Arguments**: Use \`$ARGUMENTS\` for all args or \`$1\`, \`$2\`, etc. for positional
- **File Includes**: Use \`@filename\` to include file contents
- **Bash Commands**: Use \`!command\` to execute bash commands

### Examples

\`\`\`markdown
/mycommand arg1 arg2
\`\`\`
`;

    return {
      type: 'builtin',
      action: 'help',
      data: {
        content: helpText,
        format: 'markdown'
      }
    };
  },

  '/clear': async (args, context) => {
    return {
      type: 'builtin',
      action: 'clear',
      data: {
        message: 'Conversation history cleared'
      }
    };
  },

  '/model': async (args, context) => {
    const availableModels = {
      claude: CLAUDE_MODELS.OPTIONS.map(o => o.value),
      cursor: CURSOR_MODELS.OPTIONS.map(o => o.value),
      codex: CODEX_MODELS.OPTIONS.map(o => o.value)
    };

    const currentProvider = context?.provider || 'claude';
    const currentModel = context?.model || CLAUDE_MODELS.DEFAULT;

    return {
      type: 'builtin',
      action: 'model',
      data: {
        current: {
          provider: currentProvider,
          model: currentModel
        },
        available: availableModels,
        message: args.length > 0
          ? `Switching to model: ${args[0]}`
          : `Current model: ${currentModel}`
      }
    };
  },

  '/status': async (args, context) => {
    const packageJsonPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..', 'package.json');
    let version = 'unknown';
    let packageName = 'claude-code-ui';

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      version = packageJson.version;
      packageName = packageJson.name;
    } catch (err) {
      logger.error('Error reading package.json:', err);
    }

    const uptime = process.uptime();
    const uptimeMinutes = Math.floor(uptime / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeFormatted = uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes % 60}m`
      : `${uptimeMinutes}m`;

    return {
      type: 'builtin',
      action: 'status',
      data: {
        version,
        packageName,
        uptime: uptimeFormatted,
        uptimeSeconds: Math.floor(uptime),
        model: context?.model || 'claude-sonnet-4.5',
        provider: context?.provider || 'claude',
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  },

  '/memory': async (args, context) => {
    const projectPath = context?.projectPath;

    if (!projectPath) {
      return {
        type: 'builtin',
        action: 'memory',
        data: {
          error: 'No project selected',
          message: 'Please select a project to access its CLAUDE.md file'
        }
      };
    }

    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');

    let exists = false;
    try {
      await fs.access(claudeMdPath);
      exists = true;
    } catch (err) {
      // File does not exist
    }

    return {
      type: 'builtin',
      action: 'memory',
      data: {
        path: claudeMdPath,
        exists,
        message: exists
          ? `Opening CLAUDE.md at ${claudeMdPath}`
          : `CLAUDE.md not found at ${claudeMdPath}. Create it to store project-specific instructions.`
      }
    };
  },

  '/config': async (args, context) => {
    return {
      type: 'builtin',
      action: 'config',
      data: {
        message: 'Opening settings...'
      }
    };
  },

  '/rewind': async (args, context) => {
    const steps = args[0] ? parseInt(args[0]) : 1;

    if (isNaN(steps) || steps < 1) {
      return {
        type: 'builtin',
        action: 'rewind',
        data: {
          error: 'Invalid steps parameter',
          message: 'Usage: /rewind [number] - Rewind conversation by N steps (default: 1)'
        }
      };
    }

    return {
      type: 'builtin',
      action: 'rewind',
      data: {
        steps,
        message: `Rewinding conversation by ${steps} step${steps > 1 ? 's' : ''}...`
      }
    };
  }
};
