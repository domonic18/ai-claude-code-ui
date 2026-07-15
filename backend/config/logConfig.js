/**
 * 日志配置（纯叶子模块）。
 *
 * 只读环境变量 + 提供默认值，不 import 任何模块——尤其不 import logger，
 * 避免被 logger 依赖时形成循环（logger 是最底层基础设施，被 config 及所有业务模块依赖）。
 * logger.js 及其他需要日志配置的模块统一从此处读取，实现"配置与代码分离"。
 *
 * 覆盖方式：在项目根 .env 配置同名变量（见 .env.example 的 LOGGING 段）。
 *
 * @module config/logConfig
 */

/** 日志级别: trace/debug/info/warn/error/fatal */
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/** 文件日志(app.log)单文件大小，超过即滚动。rotating-file-stream 原生格式：正整数+单位 B/K/M/G
 *  （默认 50M；测试可配 "512K"/"1M" 快速触发。注：不支持小数，0.5M 会报错，用 512K 代替） */
export const LOG_FILE_SIZE = process.env.LOG_FILE_SIZE || '50M';

/** 保留的轮转文件份数 */
export const LOG_MAX_FILES = Number(process.env.LOG_MAX_FILES) || 5;

/** [API #seq] 记录的 thinking 预览字符数（前 N 字，所有 turn 都记）。
 *  平衡可观测性与体积：能看到每轮"在想什么"的开头，又不是全文落盘。0 = 关闭预览。 */
export const LOG_THINKING_PREVIEW_CHARS = Number(process.env.LOG_THINKING_PREVIEW_CHARS) || 500;
