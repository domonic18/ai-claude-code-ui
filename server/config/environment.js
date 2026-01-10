/**
 * Environment Configuration Module
 *
 * Handles environment variable loading, ANSI color definitions,
 * and container mode status logging.
 *
 * @module config/environment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logContainerModeStatus } from './container-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ANSI color codes for terminal output
 */
export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    dim: '\x1b[2m',
};

/**
 * Colored console output utilities
 */
export const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    ok: (text) => `${colors.green}${text}${colors.reset}`,
    warn: (text) => `${colors.yellow}${text}${colors.reset}`,
    tip: (text) => `${colors.blue}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

/**
 * Load environment variables from .env file
 * Sets environment variables if they don't already exist
 */
export function loadEnvironment() {
    try {
        const envPath = path.join(__dirname, '../../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0 && !process.env[key]) {
                    process.env[key] = valueParts.join('=').trim();
                }
            }
        });
    } catch (e) {
        console.log('No .env file found or error reading it:', e.message);
    }

    // Debug logging
    console.log('PORT from env:', process.env.PORT);
    console.log('DATABASE_PATH from env:', process.env.DATABASE_PATH);

    // Log container mode status
    logContainerModeStatus();
}
