/**
 * TaskMaster PRD 文件管理服务
 *
 * 负责 PRD 文件的 CRUD 操作和模板管理：
 * - PRD 文件的创建、读取、删除
 * - 内置模板定义和应用
 * - 模板占位符替换
 *
 * @module services/projects/taskmaster/prd-service
 */

import path from 'path';
import { promises as fsPromises, constants as fsConstants, default as fs } from 'fs';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/projects/taskmaster/prd-service');

/**
 * 内置 PRD 模板定义
 * 每个模板包含 id、name、description、category 和 content
 * @type {Array<Object>}
 */
const TEMPLATES = [
    {
        id: 'web-app',
        name: 'Web Application',
        description: 'Template for web application projects with frontend and backend components',
        category: 'web',
        content: `# Product Requirements Document - Web Application

## Overview
**Product Name:** [Your App Name]
**Version:** 1.0
**Date:** [Date]
**Author:** [Your Name]

## Executive Summary
Brief description of what this web application will do and why it's needed.

## Product Goals
- Goal 1: [Specific measurable goal]
- Goal 2: [Specific measurable goal]
- Goal 3: [Specific measurable goal]

## User Stories
### Core Features
1. **User Registration & Authentication**
   - As a user, I want to create an account so I can access personalized features
   - As a user, I want to log in securely so my data is protected
   - As a user, I want to reset my password if I forget it

2. **Main Application Features**
   - As a user, I want to [core feature 1] so I can [benefit]
   - As a user, I want to [core feature 2] so I can [benefit]
   - As a user, I want to [core feature 3] so I can [benefit]

3. **User Interface**
   - As a user, I want a responsive design so I can use the app on any device
   - As a user, I want intuitive navigation so I can easily find features

## Technical Requirements
### Frontend
- Framework: React/Vue/Angular or vanilla JavaScript
- Styling: CSS framework (Tailwind, Bootstrap, etc.)
- State Management: Redux/Vuex/Context API
- Build Tools: Webpack/Vite
- Testing: Jest/Vitest for unit tests

### Backend
- Runtime: Node.js/Python/Java
- Database: PostgreSQL/MySQL/MongoDB
- API: RESTful API or GraphQL
- Authentication: JWT tokens
- Testing: Integration and unit tests

### Infrastructure
- Hosting: Cloud provider (AWS, Azure, GCP)
- CI/CD: GitHub Actions/GitLab CI
- Monitoring: Application monitoring tools
- Security: HTTPS, input validation, rate limiting

## Success Metrics
- User engagement metrics
- Performance benchmarks (load time < 2s)
- Error rates < 1%
- User satisfaction scores

## Timeline
- Phase 1: Core functionality (4-6 weeks)
- Phase 2: Advanced features (2-4 weeks)
- Phase 3: Polish and launch (2 weeks)

## Constraints & Assumptions
- Budget constraints
- Technical limitations
- Team size and expertise
- Timeline constraints`
    },
    {
        id: 'api',
        name: 'REST API',
        description: 'Template for REST API development projects',
        category: 'backend',
        content: `# Product Requirements Document - REST API

## Overview
**API Name:** [Your API Name]
**Version:** v1.0
**Date:** [Date]
**Author:** [Your Name]

## Executive Summary
Description of the API's purpose, target users, and primary use cases.

## API Goals
- Goal 1: Provide secure data access
- Goal 2: Ensure scalable architecture
- Goal 3: Maintain high availability (99.9% uptime)

## Functional Requirements
### Core Endpoints
1. **Authentication Endpoints**
   - POST /api/auth/login - User authentication
   - POST /api/auth/logout - User logout
   - POST /api/auth/refresh - Token refresh
   - POST /api/auth/register - User registration

2. **Data Management Endpoints**
   - GET /api/resources - List resources with pagination
   - GET /api/resources/{id} - Get specific resource
   - POST /api/resources - Create new resource
   - PUT /api/resources/{id} - Update existing resource
   - DELETE /api/resources/{id} - Delete resource

3. **Administrative Endpoints**
   - GET /api/admin/users - Manage users (admin only)
   - GET /api/admin/analytics - System analytics
   - POST /api/admin/backup - Trigger system backup

## Technical Requirements
### API Design
- RESTful architecture following OpenAPI 3.0 specification
- JSON request/response format
- Consistent error response format
- API versioning strategy

### Authentication & Security
- JWT token-based authentication
- Role-based access control (RBAC)
- Rate limiting (100 requests/minute per user)
- Input validation and sanitization
- HTTPS enforcement

### Performance Requirements
- Response time: < 200ms for 95% of requests
- Throughput: 1000+ requests/second
- Concurrent users: 10,000+

## Error Handling
- Standardized error codes and messages
- Proper HTTP status codes
- Detailed error logging
- Graceful degradation strategies

## Success Metrics
- API uptime > 99.9%
- Average response time < 200ms
- Zero critical security vulnerabilities
- Developer adoption metrics`
    },
    {
        id: 'mobile-app',
        name: 'Mobile Application',
        description: 'Template for mobile app development projects (iOS/Android)',
        category: 'mobile',
        content: `# Product Requirements Document - Mobile Application

## Overview
**App Name:** [Your App Name]
**Platform:** iOS / Android / Cross-platform
**Version:** 1.0
**Date:** [Date]
**Author:** [Your Name]

## Executive Summary
Brief description of the mobile app's purpose, target audience, and key value proposition.

## User Stories
### Core Features
1. **Onboarding & Authentication**
   - As a new user, I want a simple onboarding process
   - As a user, I want to sign up with email or social media
   - As a user, I want biometric authentication for security

2. **Main App Features**
   - As a user, I want [core feature 1] accessible from home screen
   - As a user, I want [core feature 2] to work offline
   - As a user, I want to sync data across devices

### Performance Requirements
- App launch time < 3 seconds
- Screen transition animations < 300ms
- Memory usage optimization
- Battery usage optimization

## Technical Requirements
### Mobile Development
- Cross-platform: React Native / Flutter
- State Management: Redux / MobX / Provider
- Offline data synchronization

### Backend Integration
- REST API or GraphQL integration
- Real-time features (WebSockets/Push notifications)
- Background processing

## Success Metrics
- App store ratings > 4.0
- User retention rates
- Daily/Monthly active users
- App performance metrics`
    },
    {
        id: 'data-analysis',
        name: 'Data Analysis Project',
        description: 'Template for data analysis and visualization projects',
        category: 'data',
        content: `# Product Requirements Document - Data Analysis Project

## Overview
**Project Name:** [Your Analysis Project]
**Analysis Type:** [Descriptive/Predictive/Prescriptive]
**Date:** [Date]
**Author:** [Your Name]

## Executive Summary
Description of the business problem, data sources, and expected insights.

## Business Requirements
### Key Questions
1. What patterns exist in the current data?
2. What factors influence [target variable]?
3. What predictions can be made for [future outcome]?

## Data Requirements
### Data Sources
- Source: [Database/API/Files]
- Format: [CSV/JSON/SQL]
- Size: [Volume estimate]
- Update frequency: [Real-time/Daily/Monthly]

## Technical Requirements
### Analysis Tools
- Programming: Python/R/SQL
- Libraries: pandas, numpy, scikit-learn, matplotlib
- Visualization: Tableau, PowerBI, or custom dashboards

## Deliverables
- Executive summary for stakeholders
- Technical analysis report
- Interactive dashboards
- Reproducible analysis scripts

## Timeline
- Phase 1: Data collection and exploration (2 weeks)
- Phase 2: Analysis and modeling (3 weeks)
- Phase 3: Reporting and visualization (1 week)
- Phase 4: Stakeholder presentation (1 week)

## Success Metrics
- Stakeholder satisfaction with insights
- Accuracy of predictions (if applicable)
- Business impact of recommendations
- Reproducibility of results`
    }
];

/**
 * 获取所有可用的 PRD 模板
 * @returns {Array<Object>} 模板列表
 */
export function getAvailableTemplates() {
    const today = new Date().toISOString().split('T')[0];
    return TEMPLATES.map(template => ({
        ...template,
        content: template.content.replace(/\[Date\]/g, today)
    }));
}

/**
 * 根据 ID 获取模板
 * @param {string} templateId - 模板 ID
 * @returns {Object|undefined} 模板对象，未找到返回 undefined
 */
export function getTemplateById(templateId) {
    return getAvailableTemplates().find(t => t.id === templateId);
}

/**
 * 将自定义值应用到模板占位符
 * @param {string} content - 模板内容
 * @param {Object} customizations - 自定义键值对
 * @returns {string} 替换后的内容
 */
export function applyCustomizations(content, customizations) {
    let result = content;
    for (const [key, value] of Object.entries(customizations)) {
        const placeholder = `[${key}]`;
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), value);
    }
    return result;
}

/**
 * 获取 PRD 文件的完整路径
 * @param {string} projectPath - 项目路径
 * @param {string} fileName - 文件名
 * @returns {string} PRD 文件完整路径
 */
export function getPrdFilePath(projectPath, fileName) {
    return path.join(projectPath, '.taskmaster', 'docs', fileName);
}

/**
 * 确保 .taskmaster/docs 目录存在
 * @param {string} projectPath - 项目路径
 * @returns {Promise<string>} docs 目录路径
 */
export async function ensureDocsDir(projectPath) {
    const docsPath = path.join(projectPath, '.taskmaster', 'docs');
    await fsPromises.mkdir(docsPath, { recursive: true });
    return docsPath;
}

/**
 * 列出项目的所有 PRD 文件
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array<Object>>} PRD 文件列表，按修改时间降序排列
 */
export async function listPrdFiles(projectPath) {
    const docsPath = path.join(projectPath, '.taskmaster', 'docs');

    try {
        await fsPromises.access(docsPath, fsConstants.R_OK);
    } catch {
        return [];
    }

    const files = await fsPromises.readdir(docsPath);

    // 并行 stat 所有文件，避免顺序 I/O
    const statResults = await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(docsPath, file);
            try {
                const stats = await fsPromises.stat(filePath);
                if (stats.isFile() && (file.endsWith('.txt') || file.endsWith('.md'))) {
                    return {
                        name: file,
                        path: path.relative(projectPath, filePath),
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        created: stats.birthtime.toISOString()
                    };
                }
            } catch { /* ignore individual stat errors */ }
            return null;
        })
    );

    const prdFiles = statResults.filter(Boolean);
    return prdFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

/**
 * 读取 PRD 文件内容
 * @param {string} projectPath - 项目路径
 * @param {string} fileName - 文件名
 * @returns {Promise<Object|null>} 文件信息，文件不存在返回 null
 */
export async function readPrdFile(projectPath, fileName) {
    const filePath = getPrdFilePath(projectPath, fileName);

    try {
        await fsPromises.access(filePath, fsConstants.R_OK);
    } catch {
        return null;
    }

    const content = await fsPromises.readFile(filePath, 'utf8');
    const stats = await fsPromises.stat(filePath);

    return {
        fileName,
        filePath: path.relative(projectPath, filePath),
        content,
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
    };
}

/**
 * 写入 PRD 文件
 * @param {string} projectPath - 项目路径
 * @param {string} fileName - 文件名
 * @param {string} content - 文件内容
 * @returns {Promise<Object>} 写入后的文件信息
 */
export async function writePrdFile(projectPath, fileName, content) {
    await ensureDocsDir(projectPath);
    const filePath = getPrdFilePath(projectPath, fileName);

    await fsPromises.writeFile(filePath, content, 'utf8');
    const stats = await fsPromises.stat(filePath);

    return {
        fileName,
        filePath: path.relative(projectPath, filePath),
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
    };
}

/**
 * 删除 PRD 文件
 * @param {string} projectPath - 项目路径
 * @param {string} fileName - 文件名
 * @returns {Promise<boolean>} 是否删除成功
 */
export async function deletePrdFile(projectPath, fileName) {
    const filePath = getPrdFilePath(projectPath, fileName);

    try {
        await fsPromises.access(filePath, fsConstants.F_OK);
    } catch {
        return false;
    }

    await fsPromises.unlink(filePath);
    return true;
}

/**
 * 验证 PRD 文件名是否合法
 * @param {string} fileName - 文件名
 * @returns {boolean} 是否合法
 */
export function isValidPrdFileName(fileName) {
    return /^[\w\-. ]+\.(txt|md)$/.test(fileName);
}

/**
 * 检查 PRD 文件是否存在
 * @param {string} projectPath - 项目路径
 * @param {string} fileName - 文件名
 * @returns {Promise<boolean>} 是否存在
 */
export async function prdFileExists(projectPath, fileName) {
    const filePath = getPrdFilePath(projectPath, fileName);
    try {
        await fsPromises.access(filePath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}
