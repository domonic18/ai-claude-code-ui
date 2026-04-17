/**
 * TaskMaster 模块统一导出
 */

export { detectTaskMasterFolder } from './detector.js';
export {
    checkTaskMasterInstallation,
    getNextTask,
    initTaskMaster,
    addTask,
    setTaskStatus,
    updateTask,
    parsePRD
} from './cli.js';
export {
    loadTasks,
    findNextPendingTask
} from './task-service.js';
export {
    getAvailableTemplates,
    getTemplateById,
    applyCustomizations,
    listPrdFiles,
    readPrdFile,
    writePrdFile,
    deletePrdFile,
    isValidPrdFileName,
    prdFileExists,
    ensureDocsDir
} from './prd-service.js';
