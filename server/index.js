#!/usr/bin/env node
/**
 * Claude Code UI Server - Main Entry Point
 *
 * Initializes and starts the Express server with WebSocket support.
 *
 * @module server/index
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';

// Configuration modules
import { loadEnvironment, c } from './config/environment.js';
import { configureExpress } from './config/express-config.js';
import { createWebSocketServer } from './websocket/server.js';

// Database and services
import { initializeDatabase } from './database/db.js';
import { setupProjectsWatcher } from './utils/project-watcher.js';

// Load environment variables and configuration
loadEnvironment();

// Connected WebSocket clients for project updates
const connectedClients = new Set();

// PTY sessions map for shell terminal management
const ptySessionsMap = new Map();

// Server configuration
const PORT = process.env.PORT || 3001;

// Initialize Express application and HTTP server
const app = express();
const server = http.createServer(app);

// Create and configure WebSocket server
const wss = createWebSocketServer(server, connectedClients, ptySessionsMap);

// Configure Express with middleware and routes
configureExpress(app, wss);

/**
 * Start the server
 */
async function startServer() {
    try {
        // Initialize authentication database
        await initializeDatabase();

        // Check if running in production mode (dist folder exists)
        const distIndexPath = path.join(process.cwd(), 'dist/index.html');
        const isProduction = fs.existsSync(distIndexPath);

        // Log Claude implementation mode
        console.log(`${c.info('[INFO]')} Using Claude Agents SDK for Claude integration`);
        console.log(`${c.info('[INFO]')} Running in ${c.bright(isProduction ? 'PRODUCTION' : 'DEVELOPMENT')} mode`);

        if (!isProduction) {
            console.log(`${c.warn('[WARN]')} Note: Requests will be proxied to Vite dev server at ${c.dim('http://localhost:' + (process.env.VITE_PORT || 5173))}`);
        }

        server.listen(PORT, '0.0.0.0', async () => {
            const appInstallPath = path.join(process.cwd());

            console.log('');
            console.log(c.dim('═'.repeat(63)));
            console.log(`  ${c.bright('Claude Code UI Server - Ready')}`);
            console.log(c.dim('═'.repeat(63)));
            console.log('');
            console.log(`${c.info('[INFO]')} Server URL:  ${c.bright('http://0.0.0.0:' + PORT)}`);
            console.log(`${c.info('[INFO]')} Installed at: ${c.dim(appInstallPath)}`);
            console.log(`${c.tip('[TIP]')}  Run "cloudcli status" for full configuration details`);
            console.log('');

            // Start watching the projects folder for changes
            await setupProjectsWatcher(connectedClients);
        });
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
