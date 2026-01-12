/**
 * services/files/index.js
 *
 * 文件操作层统一导出
 */

// 文件适配器
export {
  BaseFileAdapter,
  NativeFileAdapter,
  ContainerFileAdapter
} from './adapters/index.js';

// 文件操作服务
export {
  FileOperationsService
} from './operations/FileOperationsService.js';

// 默认导出单例服务
export { default as default } from './operations/FileOperationsService.js';
