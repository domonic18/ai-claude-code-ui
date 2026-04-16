import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';
import { CURSOR_MODELS } from '../../../../shared/modelConstants.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('routes/integrations/ai-providers/cursor');

const router = express.Router();

// GET /api/cursor/config - 读取 Cursor CLI 配置
router.get('/config', async (req, res) => {
  try {
    const configPath = path.join(os.homedir(), '.cursor', 'cli-config.json');
    
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      res.json({
        success: true,
        config: config,
        path: configPath
      });
    } catch (error) {
      // 配置不存在或无效
      logger.info('Cursor config not found or invalid:', error.message);

      // 返回默认配置
      res.json({
        success: true,
        config: {
          version: 1,
          model: {
            modelId: CURSOR_MODELS.DEFAULT,
            displayName: "GPT-5"
          },
          permissions: {
            allow: [],
            deny: []
          }
        },
        isDefault: true
      });
    }
  } catch (error) {
    logger.error('Error reading Cursor config:', error);
    res.status(500).json({ 
      error: 'Failed to read Cursor configuration', 
      details: error.message 
    });
  }
});

// POST /api/cursor/config - 更新 Cursor CLI 配置
router.post('/config', async (req, res) => {
  try {
    const { permissions, model } = req.body;
    const configPath = path.join(os.homedir(), '.cursor', 'cli-config.json');
    
    // 读取现有配置或创建默认配置
    let config = {
      version: 1,
      editor: {
        vimMode: false
      },
      hasChangedDefaultModel: false,
      privacyCache: {
        ghostMode: false,
        privacyMode: 3,
        updatedAt: Date.now()
      }
    };
    
    try {
      const existing = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(existing);
    } catch (error) {
      // 配置不存在，使用默认值
      logger.info('Creating new Cursor config');
    }

    // 如果提供了权限，则更新
    if (permissions) {
      config.permissions = {
        allow: permissions.allow || [],
        deny: permissions.deny || []
      };
    }

    // 如果提供了模型，则更新
    if (model) {
      config.model = model;
      config.hasChangedDefaultModel = true;
    }

    // 确保目录存在
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });

    // 写入更新后的配置
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    res.json({
      success: true,
      config: config,
      message: 'Cursor configuration updated successfully'
    });
  } catch (error) {
    logger.error('Error updating Cursor config:', error);
    res.status(500).json({ 
      error: 'Failed to update Cursor configuration', 
      details: error.message 
    });
  }
});

// GET /api/cursor/mcp - 读取 Cursor MCP 服务器配置
router.get('/mcp', async (req, res) => {
  try {
    const mcpPath = path.join(os.homedir(), '.cursor', 'mcp.json');
    
    try {
      const mcpContent = await fs.readFile(mcpPath, 'utf8');
      const mcpConfig = JSON.parse(mcpContent);
      
      // 转换为 UI 友好格式
      const servers = [];
      if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
        for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
          const server = {
            id: name,
            name: name,
            type: 'stdio',
            scope: 'cursor',
            config: {},
            raw: config
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
      
      res.json({
        success: true,
        servers: servers,
        path: mcpPath
      });
    } catch (error) {
      // MCP 配置不存在
      logger.info('Cursor MCP config not found:', error.message);
      res.json({
        success: true,
        servers: [],
        isDefault: true
      });
    }
  } catch (error) {
    logger.error('Error reading Cursor MCP config:', error);
    res.status(500).json({ 
      error: 'Failed to read Cursor MCP configuration', 
      details: error.message 
    });
  }
});

// POST /api/cursor/mcp/add - 添加 MCP 服务器到 Cursor 配置
router.post('/mcp/add', async (req, res) => {
  try {
    const { name, type = 'stdio', command, args = [], url, headers = {}, env = {} } = req.body;
    const mcpPath = path.join(os.homedir(), '.cursor', 'mcp.json');

    logger.info(`➕ Adding MCP server to Cursor config: ${name}`);

    // 读取现有配置或创建新配置
    let mcpConfig = { mcpServers: {} };
    
    try {
      const existing = await fs.readFile(mcpPath, 'utf8');
      mcpConfig = JSON.parse(existing);
      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {};
      }
    } catch (error) {
      logger.info('Creating new Cursor MCP config');
    }

    // 根据类型构建服务器配置
    let serverConfig = {};
    
    if (type === 'stdio') {
      serverConfig = {
        command: command,
        args: args,
        env: env
      };
    } else if (type === 'http' || type === 'sse') {
      serverConfig = {
        url: url,
        transport: type,
        headers: headers
      };
    }

    // 将服务器添加到配置
    mcpConfig.mcpServers[name] = serverConfig;

    // 确保目录存在
    const mcpDir = path.dirname(mcpPath);
    await fs.mkdir(mcpDir, { recursive: true });

    // 写入更新后的配置
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));
    
    res.json({
      success: true,
      message: `MCP server "${name}" added to Cursor configuration`,
      config: mcpConfig
    });
  } catch (error) {
    logger.error('Error adding MCP server to Cursor:', error);
    res.status(500).json({ 
      error: 'Failed to add MCP server', 
      details: error.message 
    });
  }
});

// DELETE /api/cursor/mcp/:name - 从 Cursor 配置中删除 MCP 服务器
router.delete('/mcp/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const mcpPath = path.join(os.homedir(), '.cursor', 'mcp.json');

    logger.info(`🗑️ Removing MCP server from Cursor config: ${name}`);

    // 读取现有配置
    let mcpConfig = { mcpServers: {} };
    
    try {
      const existing = await fs.readFile(mcpPath, 'utf8');
      mcpConfig = JSON.parse(existing);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Cursor MCP configuration not found' 
      });
    }

    // 检查服务器是否存在
    if (!mcpConfig.mcpServers || !mcpConfig.mcpServers[name]) {
      return res.status(404).json({ 
        error: `MCP server "${name}" not found in Cursor configuration` 
      });
    }

    // 从配置中删除服务器
    delete mcpConfig.mcpServers[name];

    // 写入更新后的配置
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));
    
    res.json({
      success: true,
      message: `MCP server "${name}" removed from Cursor configuration`,
      config: mcpConfig
    });
  } catch (error) {
    logger.error('Error removing MCP server from Cursor:', error);
    res.status(500).json({ 
      error: 'Failed to remove MCP server', 
      details: error.message 
    });
  }
});

// POST /api/cursor/mcp/add-json - 使用 JSON 格式添加 MCP 服务器
router.post('/mcp/add-json', async (req, res) => {
  try {
    const { name, jsonConfig } = req.body;
    const mcpPath = path.join(os.homedir(), '.cursor', 'mcp.json');

    logger.info(`➕ Adding MCP server to Cursor config via JSON: ${name}`);

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

    // 读取现有配置或创建新配置
    let mcpConfig = { mcpServers: {} };
    
    try {
      const existing = await fs.readFile(mcpPath, 'utf8');
      mcpConfig = JSON.parse(existing);
      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {};
      }
    } catch (error) {
      logger.info('Creating new Cursor MCP config');
    }

    // 将服务器添加到配置
    mcpConfig.mcpServers[name] = parsedConfig;

    // 确保目录存在
    const mcpDir = path.dirname(mcpPath);
    await fs.mkdir(mcpDir, { recursive: true });

    // 写入更新后的配置
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));
    
    res.json({
      success: true,
      message: `MCP server "${name}" added to Cursor configuration via JSON`,
      config: mcpConfig
    });
  } catch (error) {
    logger.error('Error adding MCP server to Cursor via JSON:', error);
    res.status(500).json({ 
      error: 'Failed to add MCP server', 
      details: error.message 
    });
  }
});

// GET /api/cursor/sessions - 从 SQLite 数据库获取 Cursor 会话
router.get('/sessions', async (req, res) => {
  try {
    const { projectPath } = req.query;

    // 计算项目路径的 cwdID 哈希（Cursor 使用 MD5 哈希）
    const cwdId = crypto.createHash('md5').update(projectPath || process.cwd()).digest('hex');
    const cursorChatsPath = path.join(os.homedir(), '.cursor', 'chats', cwdId);


    // 检查目录是否存在
    try {
      await fs.access(cursorChatsPath);
    } catch (error) {
      // 此项目没有会话
      return res.json({ 
        success: true, 
        sessions: [],
        cwdId: cwdId,
        path: cursorChatsPath
      });
    }

    // 列出所有会话目录
    const sessionDirs = await fs.readdir(cursorChatsPath);
    const sessions = [];
    
    for (const sessionId of sessionDirs) {
      const sessionPath = path.join(cursorChatsPath, sessionId);
      const storeDbPath = path.join(sessionPath, 'store.db');
      let dbStatMtimeMs = null;

      try {
        // 检查 store.db 是否存在
        await fs.access(storeDbPath);

        // 捕获 store.db 的 mtime 作为可靠的回退时间戳（最后活动时间）
        try {
          const stat = await fs.stat(storeDbPath);
          dbStatMtimeMs = stat.mtimeMs;
        } catch (_) {}

        // 打开 SQLite 数据库
        const db = await open({
          filename: storeDbPath,
          driver: sqlite3.Database,
          mode: sqlite3.OPEN_READONLY
        });

        // 从 meta 表获取元数据
        const metaRows = await db.all(`
          SELECT key, value FROM meta
        `);
        
        let sessionData = {
          id: sessionId,
          name: 'Untitled Session',
          createdAt: null,
          mode: null,
          projectPath: projectPath,
          lastMessage: null,
          messageCount: 0
        };

        // 解析 meta 表条目
        for (const row of metaRows) {
          if (row.value) {
            try {
              // 尝试解码为十六进制编码的 JSON
              const hexMatch = row.value.toString().match(/^[0-9a-fA-F]+$/);
              if (hexMatch) {
                const jsonStr = Buffer.from(row.value, 'hex').toString('utf8');
                const data = JSON.parse(jsonStr);

                if (row.key === 'agent') {
                  sessionData.name = data.name || sessionData.name;
                  // 将 createdAt 标准化为毫秒级的 ISO 字符串
                  let createdAt = data.createdAt;
                  if (typeof createdAt === 'number') {
                    if (createdAt < 1e12) {
                      createdAt = createdAt * 1000; // seconds -> ms
                    }
                    sessionData.createdAt = new Date(createdAt).toISOString();
                  } else if (typeof createdAt === 'string') {
                    const n = Number(createdAt);
                    if (!Number.isNaN(n)) {
                      const ms = n < 1e12 ? n * 1000 : n;
                      sessionData.createdAt = new Date(ms).toISOString();
                    } else {
                      // Assume it's already an ISO/date string
                      const d = new Date(createdAt);
                      sessionData.createdAt = isNaN(d.getTime()) ? null : d.toISOString();
                    }
                  } else {
                    sessionData.createdAt = sessionData.createdAt || null;
                  }
                  sessionData.mode = data.mode;
                  sessionData.agentId = data.agentId;
                  sessionData.latestRootBlobId = data.latestRootBlobId;
                }
              } else {
                // 如果不是十六进制，则对简单键使用原始值
                if (row.key === 'name') {
                  sessionData.name = row.value.toString();
                }
              }
            } catch (e) {
              logger.info(`Could not parse meta value for key ${row.key}:`, e.message);
            }
          }
        }

        // 仅从 JSON blob 获取消息计数（实际消息，而非 DAG 结构）
        try {
          const blobCount = await db.get(`
            SELECT COUNT(*) as count 
            FROM blobs 
            WHERE substr(data, 1, 1) = X'7B'
          `);
          sessionData.messageCount = blobCount.count;

          // 获取最新的 JSON blob 用于预览（实际消息，而非 DAG 结构）
          const lastBlob = await db.get(`
            SELECT data FROM blobs 
            WHERE substr(data, 1, 1) = X'7B'
            ORDER BY rowid DESC 
            LIMIT 1
          `);

          if (lastBlob && lastBlob.data) {
            try {
              // 尝试从 blob 中提取可读预览（可能包含嵌入式 JSON 的二进制数据）
              const raw = lastBlob.data.toString('utf8');
              let preview = '';
              // 尝试直接解析 JSON
              try {
                const parsed = JSON.parse(raw);
                if (parsed?.content) {
                  if (Array.isArray(parsed.content)) {
                    const firstText = parsed.content.find(p => p?.type === 'text' && p.text)?.text || '';
                    preview = firstText;
                  } else if (typeof parsed.content === 'string') {
                    preview = parsed.content;
                  }
                }
              } catch (_) {}
              if (!preview) {
                // 去除不可打印字符并尝试查找 JSON 块
                const cleaned = raw.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
                const s = cleaned;
                const start = s.indexOf('{');
                const end = s.lastIndexOf('}');
                if (start !== -1 && end > start) {
                  const jsonStr = s.slice(start, end + 1);
                  try {
                    const parsed = JSON.parse(jsonStr);
                    if (parsed?.content) {
                      if (Array.isArray(parsed.content)) {
                        const firstText = parsed.content.find(p => p?.type === 'text' && p.text)?.text || '';
                        preview = firstText;
                      } else if (typeof parsed.content === 'string') {
                        preview = parsed.content;
                      }
                    }
                  } catch (_) {
                    preview = s;
                  }
                } else {
                  preview = s;
                }
              }
              if (preview && preview.length > 0) {
                sessionData.lastMessage = preview.substring(0, 100) + (preview.length > 100 ? '...' : '');
              }
            } catch (e) {
              logger.info('Could not parse blob data:', e.message);
            }
          }
        } catch (e) {
          logger.info('Could not read blobs:', e.message);
        }

        await db.close();

        // 完成 createdAt：当有效时使用解析的 meta 值，否则回退到 store.db 的 mtime
        if (!sessionData.createdAt) {
          if (dbStatMtimeMs && Number.isFinite(dbStatMtimeMs)) {
            sessionData.createdAt = new Date(dbStatMtimeMs).toISOString();
          }
        }
        
        sessions.push(sessionData);
        
      } catch (error) {
        logger.info(`Could not read session ${sessionId}:`, error.message);
      }
    }

    // 回退：确保 createdAt 是有效的 ISO 字符串（使用会话目录的 mtime 作为最后手段）
    for (const s of sessions) {
      if (!s.createdAt) {
        try {
          const sessionDir = path.join(cursorChatsPath, s.id);
          const st = await fs.stat(sessionDir);
          s.createdAt = new Date(st.mtimeMs).toISOString();
        } catch {
          s.createdAt = new Date().toISOString();
        }
      }
    }
    // 按创建日期排序会话（最新的在前）
    sessions.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    res.json({ 
      success: true, 
      sessions: sessions,
      cwdId: cwdId,
      path: cursorChatsPath
    });
    
  } catch (error) {
    logger.error('Error reading Cursor sessions:', error);
    res.status(500).json({ 
      error: 'Failed to read Cursor sessions', 
      details: error.message 
    });
  }
});

// GET /api/cursor/sessions/:sessionId - 从 SQLite 获取特定 Cursor 会话
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { projectPath } = req.query;

    // 计算项目路径的 cwdID 哈希
    const cwdId = crypto.createHash('md5').update(projectPath || process.cwd()).digest('hex');
    const storeDbPath = path.join(os.homedir(), '.cursor', 'chats', cwdId, sessionId, 'store.db');


    // 打开 SQLite 数据库
    const db = await open({
      filename: storeDbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY
    });

    // 获取所有 blob 以构建 DAG 结构
    const allBlobs = await db.all(`
      SELECT rowid, id, data FROM blobs
    `);

    // 从父子关系构建 DAG 结构
    const blobMap = new Map(); // id -> blob data
    const parentRefs = new Map(); // blob id -> [parent blob ids]
    const childRefs = new Map(); // blob id -> [child blob ids]
    const jsonBlobs = []; // 纯净的 JSON 消息
    
    for (const blob of allBlobs) {
      blobMap.set(blob.id, blob);

      // 检查这是 JSON blob（实际消息）还是 protobuf（DAG 结构）
      if (blob.data && blob.data[0] === 0x7B) { // 以 '{' 开头 - JSON blob
        try {
          const parsed = JSON.parse(blob.data.toString('utf8'));
          jsonBlobs.push({ ...blob, parsed });
        } catch (e) {
          logger.info('Failed to parse JSON blob:', blob.rowid);
        }
      } else if (blob.data) { // Protobuf blob - 提取父引用
        const parents = [];
        let i = 0;

        // 扫描父引用（0x0A 0x20 后跟 32 字节哈希）
        while (i < blob.data.length - 33) {
          if (blob.data[i] === 0x0A && blob.data[i+1] === 0x20) {
            const parentHash = blob.data.slice(i+2, i+34).toString('hex');
            if (blobMap.has(parentHash)) {
              parents.push(parentHash);
            }
            i += 34;
          } else {
            i++;
          }
        }

        if (parents.length > 0) {
          parentRefs.set(blob.id, parents);
          // 更新子引用
          for (const parentId of parents) {
            if (!childRefs.has(parentId)) {
              childRefs.set(parentId, []);
            }
            childRefs.get(parentId).push(blob.id);
          }
        }
      }
    }

    // 执行拓扑排序以获得时间顺序
    const visited = new Set();
    const sorted = [];

    // 基于深度优先搜索的拓扑排序
    function visit(nodeId) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // 首先访问所有父节点（依赖项）
      const parents = parentRefs.get(nodeId) || [];
      for (const parentId of parents) {
        visit(parentId);
      }

      // 在所有父节点之后添加此节点
      const blob = blobMap.get(nodeId);
      if (blob) {
        sorted.push(blob);
      }
    }

    // 从没有父节点的节点开始（根节点）
    for (const blob of allBlobs) {
      if (!parentRefs.has(blob.id)) {
        visit(blob.id);
      }
    }

    // 访问任何剩余的节点（断开连接的组件）
    for (const blob of allBlobs) {
      visit(blob.id);
    }

    // 现在按照它们在排序后的 DAG 中出现的顺序提取 JSON 消息
    const messageOrder = new Map(); // JSON blob id -> order index
    let orderIndex = 0;
    
    for (const blob of sorted) {
      // 检查此 blob 是否引用任何 JSON 消息
      if (blob.data && blob.data[0] !== 0x7B) { // Protobuf blob
        // 查找 JSON blob 引用
        for (const jsonBlob of jsonBlobs) {
          try {
            const jsonIdBytes = Buffer.from(jsonBlob.id, 'hex');
            if (blob.data.includes(jsonIdBytes)) {
              if (!messageOrder.has(jsonBlob.id)) {
                messageOrder.set(jsonBlob.id, orderIndex++);
              }
            }
          } catch (e) {
            // 如果无法转换 ID 则跳过
          }
        }
      }
    }

    // 按照它们在 DAG 中的出现顺序对 JSON blob 进行排序
    const sortedJsonBlobs = jsonBlobs.sort((a, b) => {
      const orderA = messageOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const orderB = messageOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      // 如果不在顺序映射中，则回退到 rowid
      return a.rowid - b.rowid;
    });

    // 使用排序后的 JSON blob
    const blobs = sortedJsonBlobs.map((blob, idx) => ({
      ...blob,
      sequence_num: idx + 1,
      original_rowid: blob.rowid
    }));

    // 从 meta 表获取元数据
    const metaRows = await db.all(`
      SELECT key, value FROM meta
    `);

    // 解析元数据
    let metadata = {};
    for (const row of metaRows) {
      if (row.value) {
        try {
          // 尝试解码为十六进制编码的 JSON
          const hexMatch = row.value.toString().match(/^[0-9a-fA-F]+$/);
          if (hexMatch) {
            const jsonStr = Buffer.from(row.value, 'hex').toString('utf8');
            metadata[row.key] = JSON.parse(jsonStr);
          } else {
            metadata[row.key] = row.value.toString();
          }
        } catch (e) {
          metadata[row.key] = row.value.toString();
        }
      }
    }

    // 从排序后的 JSON blob 中提取消息
    const messages = [];
    for (const blob of blobs) {
      try {
        // 我们之前已经解析了 JSON blob
        const parsed = blob.parsed;

        if (parsed) {
          // 仅在服务器级别过滤系统消息
          // 检查直接角色和嵌套的 message.role
          const role = parsed?.role || parsed?.message?.role;
          if (role === 'system') {
            continue; // 仅跳过系统消息
          }
          messages.push({ 
            id: blob.id, 
            sequence: blob.sequence_num,
            rowid: blob.original_rowid, 
            content: parsed 
          });
        }
      } catch (e) {
        // 跳过导致错误的 blob
        logger.info(`Skipping blob ${blob.id}: ${e.message}`);
      }
    }
    
    await db.close();
    
    res.json({ 
      success: true, 
      session: {
        id: sessionId,
        projectPath: projectPath,
        messages: messages,
        metadata: metadata,
        cwdId: cwdId
      }
    });
    
  } catch (error) {
    logger.error('Error reading Cursor session:', error);
    res.status(500).json({ 
      error: 'Failed to read Cursor session', 
      details: error.message 
    });
  }
});

export default router;