/**
 * Express Configuration Module
 *
 * Configures Express app with middleware, routes, and static file serving.
 *
 * @module config/express-config
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import mime from 'mime-types';

// Route imports
import gitRoutes from '../routes/git.js';
import authRoutes from '../routes/auth.js';
import mcpRoutes from '../routes/mcp.js';
import cursorRoutes from '../routes/cursor.js';
import taskmasterRoutes from '../routes/taskmaster.js';
import mcpUtilsRoutes from '../routes/mcp-utils.js';
import commandsRoutes from '../routes/commands.js';
import settingsRoutes from '../routes/settings.js';
import agentRoutes from '../routes/agent.js';
import projectsRoutes from '../routes/projects.js';
import cliAuthRoutes from '../routes/cli-auth.js';
import userRoutes from '../routes/user.js';
import codexRoutes from '../routes/codex.js';
import filesRoutes from '../routes/files.js';
import sessionsRoutes from '../routes/sessions.js';
import uploadsRoutes from '../routes/uploads.js';
import systemRoutes from '../routes/system.js';

// Middleware imports
import { validateApiKey, authenticateToken } from '../middleware/auth.js';

/**
 * Configure Express application with middleware and routes
 * @param {express.Application} app - The Express application to configure
 * @param {WebSocketServer} wss - The WebSocket server (attached to app.locals)
 */
export function configureExpress(app, wss) {
    // Make WebSocket server available to routes
    app.locals.wss = wss;

    // CORS middleware
    app.use(cors());

    // JSON body parser with custom type checking
    app.use(express.json({
        limit: '50mb',
        type: (req) => {
            // Skip multipart/form-data requests (for file uploads like images)
            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('multipart/form-data')) {
                return false;
            }
            return contentType.includes('json');
        }
    }));

    // URL-encoded parser
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Public health check endpoint (no authentication required)
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });

    // Optional API key validation (if configured)
    app.use('/api', validateApiKey);

    // ===== Public Routes =====
    app.use('/api/auth', authRoutes);

    // ===== Protected Routes =====
    app.use('/api/projects', authenticateToken, projectsRoutes);
    app.use('/api/git', authenticateToken, gitRoutes);
    app.use('/api/mcp', authenticateToken, mcpRoutes);
    app.use('/api/cursor', authenticateToken, cursorRoutes);
    app.use('/api/taskmaster', authenticateToken, taskmasterRoutes);
    app.use('/api/mcp-utils', authenticateToken, mcpUtilsRoutes);
    app.use('/api/commands', authenticateToken, commandsRoutes);
    app.use('/api/settings', authenticateToken, settingsRoutes);
    app.use('/api/cli', authenticateToken, cliAuthRoutes);
    app.use('/api/user', authenticateToken, userRoutes);
    app.use('/api/codex', authenticateToken, codexRoutes);
    app.use('/api/system', authenticateToken, systemRoutes);

    // ===== Special Routes =====
    // Agent API Routes (uses API key authentication, not token auth)
    app.use('/api/agent', agentRoutes);

    // File API Routes (protected)
    app.use('/api/projects', authenticateToken, filesRoutes);

    // Session API Routes (protected)
    app.use('/api/projects', authenticateToken, sessionsRoutes);

    // Upload API Routes (protected)
    app.use('/api', authenticateToken, uploadsRoutes);

    // ===== Static Files =====
    // Serve public files (like api-docs.html)
    app.use(express.static(path.join(process.cwd(), 'server', '../public')));

    // Static files served after API routes
    // Add cache control: HTML files should not be cached, but assets can be cached
    app.use(express.static(path.join(process.cwd(), 'server', '../dist'), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                // Prevent HTML caching to avoid service worker issues after builds
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            } else if (filePath.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
                // Cache static assets for 1 year (they have hashed names)
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

    // ===== SPA Fallback =====
    // Serve React app for all other routes (excluding static files)
    app.get('*', (req, res) => {
        // Skip requests for static assets (files with extensions)
        if (path.extname(req.path)) {
            return res.status(404).send('Not found');
        }

        // Only serve index.html for HTML routes, not for static assets
        const indexPath = path.join(process.cwd(), 'server', '../dist/index.html');

        // Check if dist/index.html exists (production build available)
        if (require('fs').existsSync(indexPath)) {
            // Set no-cache headers for HTML to prevent service worker issues
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.sendFile(indexPath);
        } else {
            // In development, redirect to Vite dev server only if dist doesn't exist
            res.redirect(`http://localhost:${process.env.VITE_PORT || 5173}`);
        }
    });
}
