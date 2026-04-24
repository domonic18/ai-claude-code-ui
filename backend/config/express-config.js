/**
 * Express 配置模块
 *
 * 使用中间件、路由和静态文件服务配置 Express 应用。
 *
 * @module config/express-config
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { FILES, SERVER, CORS } from './config.js';

import { auth, settings, modelsRouter, users, saml } from '../routes/core/index.js';
import { projects, sessions, files, git, userSettings, mcpServers, extensions, memory } from '../routes/api/index.js';
import { claude, cursor, codex, mcp, taskmaster, agent } from '../routes/integrations/index.js';
import { commands, system, uploads } from '../routes/tools/index.js';
import { cliAuth, customCommands } from '../routes/index.js';
import mcpUtilsRoutes from '../routes/mcp-utils.js';

import { validateApiKey, authenticateToken } from '../middleware/auth.js';
import { responseFormatter, responseHeaders } from '../middleware/response-formatter.middleware.js';
import { errorHandler, notFoundHandler } from '../middleware/error-handler.middleware.js';
import { requestTracker } from '../middleware/request-tracker.middleware.js';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('config/express-config');

function setupMiddleware(app) {
  app.locals.wss = app.locals.wss;
  app.use(requestTracker);
  app.use(cors({ origin: CORS.origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(cookieParser());
  app.use(responseFormatter);
  app.use(responseHeaders);
  app.use(express.json({
    limit: FILES.maxUploadSize,
    type: (req) => {
      const contentType = req.headers['content-type'] || '';
      return !contentType.includes('multipart/form-data') && contentType.includes('json');
    },
  }));
  app.use(express.urlencoded({ limit: FILES.maxUploadSize, extended: true }));
}

function setupPublicRoutes(app) {
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.use('/api/models', modelsRouter);
  logger.info('[CONFIG] Registering SAML routes...');
  app.use('/api/auth/saml', saml);
  logger.info('[CONFIG] SAML routes registered successfully');
  app.use('/api/auth', auth);
  app.use('/api', validateApiKey);
}

function setupProtectedRoutes(app) {
  app.use('/api/settings', authenticateToken, settings);
  app.use('/api/users', authenticateToken, users);
  app.use('/api/users', authenticateToken, userSettings);
  app.use('/api/users', authenticateToken, mcpServers);
  app.use('/api/extensions', authenticateToken, extensions);
  app.use('/api/files', authenticateToken, files);
  app.use('/api/projects', authenticateToken, files);
  app.use('/api/projects', authenticateToken, projects);
  app.use('/api/sessions', authenticateToken, sessions);
  app.use('/api/git', authenticateToken, git);
  app.use('/api/memory', authenticateToken, memory);
  app.use('/api/claude', authenticateToken, claude);
  app.use('/api/cursor', authenticateToken, cursor);
  app.use('/api/codex', authenticateToken, codex);
  app.use('/api/mcp', authenticateToken, mcp);
  app.use('/api/mcp-utils', authenticateToken, mcpUtilsRoutes);
  app.use('/api/taskmaster', authenticateToken, taskmaster);
  app.use('/api/agent', agent);
  app.use('/api/cli', authenticateToken, cliAuth);
  app.use('/api/tools/commands', authenticateToken, commands);
  app.use('/api/system', authenticateToken, system);
  app.use('/api/uploads', authenticateToken, uploads);
  app.use('/api/commands', authenticateToken, customCommands);
}

function setupStaticFiles(app) {
  app.use(express.static(path.join(process.cwd(), 'server', '../public')));
  app.use(express.static(path.join(process.cwd(), 'server', '../dist'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (filePath.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
}

function setupSpaFallback(app) {
  app.get('*', (req, res) => {
    if (path.extname(req.path)) return res.status(404).send('Not found');
    const indexPath = path.join(process.cwd(), 'server', '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexPath);
    } else {
      res.redirect(`http://localhost:${SERVER.vitePort}`);
    }
  });
}

export function configureExpress(app, wss) {
  app.locals.wss = wss;
  setupMiddleware(app);
  setupPublicRoutes(app);
  setupProtectedRoutes(app);
  setupStaticFiles(app);
  setupSpaFallback(app);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
}
