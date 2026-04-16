import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/integrations/mcp');
const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Claude CLI 命令路由

// GET /api/mcp/cli/list - 使用 Claude CLI 列出 MCP 服务器
router.get('/cli/list', async (req, res) => {
  try {
    logger.info('📋 Listing MCP servers using Claude CLI');

    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(spawn);

    const process = spawn('claude', ['mcp', 'list'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, output: stdout, servers: parseClaudeListOutput(stdout) });
      } else {
        logger.error('Claude CLI error:', stderr);
        res.status(500).json({ error: 'Claude CLI command failed', details: stderr });
      }
    });

    process.on('error', (error) => {
      logger.error('Error running Claude CLI:', error);
      res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
    });
  } catch (error) {
    logger.error('Error listing MCP servers via CLI:', error);
    res.status(500).json({ error: 'Failed to list MCP servers', details: error.message });
  }
});

// POST /api/mcp/cli/add - 使用 Claude CLI 添加 MCP 服务器
router.post('/cli/add', async (req, res) => {
  try {
    const { name, type = 'stdio', command, args = [], url, headers = {}, env = {}, scope = 'user', projectPath } = req.body;

    logger.info(`➕ Adding MCP server using Claude CLI (${scope} scope):`, name);

    const { spawn } = await import('child_process');

    let cliArgs = ['mcp', 'add'];

    // 添加作用域标志
    cliArgs.push('--scope', scope);

    if (type === 'http') {
      cliArgs.push('--transport', 'http', name, url);
      // 如果提供了请求头，则添加
      Object.entries(headers).forEach(([key, value]) => {
        cliArgs.push('--header', `${key}: ${value}`);
      });
    } else if (type === 'sse') {
      cliArgs.push('--transport', 'sse', name, url);
      // 如果提供了请求头，则添加
      Object.entries(headers).forEach(([key, value]) => {
        cliArgs.push('--header', `${key}: ${value}`);
      });
    } else {
      // stdio（默认）：claude mcp add --scope user <name> <command> [args...]
      cliArgs.push(name);
      // 添加环境变量
      Object.entries(env).forEach(([key, value]) => {
        cliArgs.push('-e', `${key}=${value}`);
      });
      cliArgs.push(command);
      if (args && args.length > 0) {
        cliArgs.push(...args);
      }
    }

    logger.info('🔧 Running Claude CLI command:', 'claude', cliArgs.join(' '));

    // 对于本地作用域，需要在项目目录中运行命令
    const spawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe']
    };

    if (scope === 'local' && projectPath) {
      spawnOptions.cwd = projectPath;
      logger.info('📁 Running in project directory:', projectPath);
    }

    const process = spawn('claude', cliArgs, spawnOptions);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, output: stdout, message: `MCP server "${name}" added successfully` });
      } else {
        logger.error('Claude CLI error:', stderr);
        res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
      }
    });

    process.on('error', (error) => {
      logger.error('Error running Claude CLI:', error);
      res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
    });
  } catch (error) {
    logger.error('Error adding MCP server via CLI:', error);
    res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
  }
});

// POST /api/mcp/cli/add-json - 使用 JSON 格式添加 MCP 服务器
router.post('/cli/add-json', async (req, res) => {
  try {
    const { name, jsonConfig, scope = 'user', projectPath } = req.body;

    logger.info('➕ Adding MCP server using JSON format:', name);

    // 验证并解析 JSON 配置
    let parsedConfig;
    try {
      parsedConfig = typeof jsonConfig === 'string' ? JSON.parse(jsonConfig) : jsonConfig;
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid JSON configuration',
        details: parseError.message
      });
    }

    // 验证必填字段
    if (!parsedConfig.type) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: 'Missing required field: type'
      });
    }

    if (parsedConfig.type === 'stdio' && !parsedConfig.command) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: 'stdio type requires a command field'
      });
    }

    if ((parsedConfig.type === 'http' || parsedConfig.type === 'sse') && !parsedConfig.url) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: `${parsedConfig.type} type requires a url field`
      });
    }

    const { spawn } = await import('child_process');

    // 构建命令：claude mcp add-json --scope <scope> <name> '<json>'
    const cliArgs = ['mcp', 'add-json', '--scope', scope, name];

    // 将 JSON 配置作为正确格式化的字符串添加
    const jsonString = JSON.stringify(parsedConfig);
    cliArgs.push(jsonString);

    logger.info('🔧 Running Claude CLI command:', 'claude', cliArgs[0], cliArgs[1], cliArgs[2], cliArgs[3], cliArgs[4], jsonString);

    // 对于本地作用域，需要在项目目录中运行命令
    const spawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe']
    };

    if (scope === 'local' && projectPath) {
      spawnOptions.cwd = projectPath;
      logger.info('📁 Running in project directory:', projectPath);
    }

    const process = spawn('claude', cliArgs, spawnOptions);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, output: stdout, message: `MCP server "${name}" added successfully via JSON` });
      } else {
        logger.error('Claude CLI error:', stderr);
        res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
      }
    });

    process.on('error', (error) => {
      logger.error('Error running Claude CLI:', error);
      res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
    });
  } catch (error) {
    logger.error('Error adding MCP server via JSON:', error);
    res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
  }
});

// DELETE /api/mcp/cli/remove/:name - 使用 Claude CLI 删除 MCP 服务器
router.delete('/cli/remove/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { scope } = req.query; // 从查询参数获取作用域

    // 处理 ID 格式（如果存在作用域前缀，则移除）
    let actualName = name;
    let actualScope = scope;

    // 如果名称包含作用域前缀，如 "local:test"，则提取它
    if (name.includes(':')) {
      const [prefix, serverName] = name.split(':');
      actualName = serverName;
      actualScope = actualScope || prefix; // 如果未在查询中提供，则使用前缀作为作用域
    }

    logger.info('🗑️ Removing MCP server using Claude CLI:', actualName, 'scope:', actualScope);

    const { spawn } = await import('child_process');

    // 根据作用域构建命令参数
    let cliArgs = ['mcp', 'remove'];

    // 如果是本地作用域，添加作用域标志
    if (actualScope === 'local') {
      cliArgs.push('--scope', 'local');
    } else if (actualScope === 'user' || !actualScope) {
      // 用户作用域是默认的，但我们可以明确指定
      cliArgs.push('--scope', 'user');
    }

    cliArgs.push(actualName);

    logger.info('🔧 Running Claude CLI command:', 'claude', cliArgs.join(' '));

    const process = spawn('claude', cliArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, output: stdout, message: `MCP server "${name}" removed successfully` });
      } else {
        logger.error('Claude CLI error:', stderr);
        res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
      }
    });

    process.on('error', (error) => {
      logger.error('Error running Claude CLI:', error);
      res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
    });
  } catch (error) {
    logger.error('Error removing MCP server via CLI:', error);
    res.status(500).json({ error: 'Failed to remove MCP server', details: error.message });
  }
});

// GET /api/mcp/cli/get/:name - 使用 Claude CLI 获取 MCP 服务器详情
router.get('/cli/get/:name', async (req, res) => {
  try {
    const { name } = req.params;

    logger.info('📄 Getting MCP server details using Claude CLI:', name);

    const { spawn } = await import('child_process');

    const process = spawn('claude', ['mcp', 'get', name], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, output: stdout, server: parseClaudeGetOutput(stdout) });
      } else {
        logger.error('Claude CLI error:', stderr);
        res.status(404).json({ error: 'Claude CLI command failed', details: stderr });
      }
    });

    process.on('error', (error) => {
      logger.error('Error running Claude CLI:', error);
      res.status(500).json({ error: 'Failed to run Claude CLI', details: error.message });
    });
  } catch (error) {
    logger.error('Error getting MCP server details via CLI:', error);
    res.status(500).json({ error: 'Failed to get MCP server details', details: error.message });
  }
});

// GET /api/mcp/config/read - 直接从 Claude 配置文件读取 MCP 服务器
router.get('/config/read', async (req, res) => {
  try {
    logger.info('📖 Reading MCP servers from Claude config files');

    const homeDir = os.homedir();
    const configPaths = [
      path.join(homeDir, '.claude.json'),
      path.join(homeDir, '.claude', 'settings.json')
    ];

    let configData = null;
    let configPath = null;

    // 尝试从任一配置文件读取
    for (const filepath of configPaths) {
      try {
        const fileContent = await fs.readFile(filepath, 'utf8');
        configData = JSON.parse(fileContent);
        configPath = filepath;
        logger.info(`✅ Found Claude config at: ${filepath}`);
        break;
      } catch (error) {
        // 文件不存在或不是有效的 JSON，尝试下一个
        logger.info(`ℹ️ Config not found or invalid at: ${filepath}`);
      }
    }

    if (!configData) {
      return res.json({
        success: false,
        message: 'No Claude configuration file found',
        servers: []
      });
    }

    // 从配置中提取 MCP 服务器
    const servers = [];

    // 检查用户作用域的 MCP 服务器（在根级别）
    if (configData.mcpServers && typeof configData.mcpServers === 'object' && Object.keys(configData.mcpServers).length > 0) {
      logger.info('🔍 Found user-scoped MCP servers:', Object.keys(configData.mcpServers));
      for (const [name, config] of Object.entries(configData.mcpServers)) {
        const server = {
          id: name,
          name: name,
          type: 'stdio', // 默认类型
          scope: 'user',  // 用户作用域 - 在所有项目中可用
          config: {},
          raw: config // 包含原始配置以获取完整详情
        };

        // 确定传输类型并提取配置
        if (config.command) {
          server.type = 'stdio';
          server.config.command = config.command;
          server.config.args = config.args || [];
          server.config.env = config.env || {};
        } else if (config.url) {
          server.type = config.transport || 'http';
          server.config.url = config.url;
          server.config.headers = config.headers || {};
        }

        servers.push(server);
      }
    }

    // 检查本地作用域的 MCP 服务器（项目特定）
    const currentProjectPath = process.cwd();

    // 检查 'projects' 键下
    if (configData.projects && configData.projects[currentProjectPath]) {
      const projectConfig = configData.projects[currentProjectPath];
      if (projectConfig.mcpServers && typeof projectConfig.mcpServers === 'object' && Object.keys(projectConfig.mcpServers).length > 0) {
        logger.info(`🔍 Found local-scoped MCP servers for ${currentProjectPath}:`, Object.keys(projectConfig.mcpServers));
        for (const [name, config] of Object.entries(projectConfig.mcpServers)) {
          const server = {
            id: `local:${name}`,  // 为唯一性添加作用域前缀
            name: name,           // 保留原始名称
            type: 'stdio', // 默认类型
            scope: 'local',  // 本地作用域 - 仅用于此项目
            projectPath: currentProjectPath,
            config: {},
            raw: config // 包含原始配置以获取完整详情
          };

          // 确定传输类型并提取配置
          if (config.command) {
            server.type = 'stdio';
            server.config.command = config.command;
            server.config.args = config.args || [];
            server.config.env = config.env || {};
          } else if (config.url) {
            server.type = config.transport || 'http';
            server.config.url = config.url;
            server.config.headers = config.headers || {};
          }

          servers.push(server);
        }
      }
    }

    logger.info(`📋 Found ${servers.length} MCP servers in config`);

    res.json({
      success: true,
      configPath: configPath,
      servers: servers
    });
  } catch (error) {
    logger.error('Error reading Claude config:', error);
    res.status(500).json({
      error: 'Failed to read Claude configuration',
      details: error.message
    });
  }
});

// 解析 Claude CLI 输出的辅助函数
function parseClaudeListOutput(output) {
  const servers = [];
  const lines = output.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // 跳过标题行
    if (line.includes('Checking MCP server health')) continue;

    // 解析类似 "test: test test - ✗ Failed to connect" 的行
    // 或 "server-name: command or description - ✓ Connected"
    if (line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const name = line.substring(0, colonIndex).trim();

      // 跳过空名称
      if (!name) continue;

      // 提取名称后的其余部分
      const rest = line.substring(colonIndex + 1).trim();

      // 尝试提取描述和状态
      let description = rest;
      let status = 'unknown';
      let type = 'stdio'; // 默认类型

      // 检查状态指示器
      if (rest.includes('✓') || rest.includes('✗')) {
        const statusMatch = rest.match(/(.*?)\s*-\s*([✓✗].*)$/);
        if (statusMatch) {
          description = statusMatch[1].trim();
          status = statusMatch[2].includes('✓') ? 'connected' : 'failed';
        }
      }

      // 尝试从描述中确定类型
      if (description.startsWith('http://') || description.startsWith('https://')) {
        type = 'http';
      }

      servers.push({
        name,
        type,
        status: status || 'active',
        description
      });
    }
  }

  logger.info('🔍 Parsed Claude CLI servers:', servers);
  return servers;
}

function parseClaudeGetOutput(output) {
  // 解析 'claude mcp get <name>' 命令的输出
  // 这是一个简单的解析器 - 可能需要根据实际输出格式进行调整
  try {
    // 尝试提取 JSON（如果存在）
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // 否则，解析为文本
    const server = { raw_output: output };
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('Name:')) {
        server.name = line.split(':')[1]?.trim();
      } else if (line.includes('Type:')) {
        server.type = line.split(':')[1]?.trim();
      } else if (line.includes('Command:')) {
        server.command = line.split(':')[1]?.trim();
      } else if (line.includes('URL:')) {
        server.url = line.split(':')[1]?.trim();
      }
    }

    return server;
  } catch (error) {
    return { raw_output: output, parse_error: error.message };
  }
}

export default router;
