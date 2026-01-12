/**
 * CommandController.js
 *
 * 命令工具控制器
 * 处理命令系统相关的请求
 *
 * @module controllers/CommandController
 */

import { BaseController } from '../core/BaseController.js';
import { validateCommand } from '../../utils/commandParser.js';
import { ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * 命令控制器
 */
export class CommandController extends BaseController {
  /**
   * 验证命令
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async validateCommand(req, res, next) {
    try {
      const { command } = req.body;

      if (!command) {
        throw new ValidationError('Command is required');
      }

      const result = validateCommand(command);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取允许的命令列表
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getAllowedCommands(req, res, next) {
    try {
      // 返回允许的命令列表
      const allowedCommands = [
        'ls', 'cd', 'pwd', 'cat', 'head', 'tail',
        'grep', 'find', 'sed', 'awk',
        'git', 'npm', 'yarn', 'pnpm',
        'node', 'python', 'python3', 'ruby', 'go',
        'mkdir', 'rm', 'cp', 'mv', 'touch',
        'chmod', 'chown', 'tar', 'zip', 'unzip',
        'curl', 'wget', 'ssh', 'scp', 'rsync'
      ];

      this._success(res, { allowedCommands });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 执行命令（通过容器或主机）
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async executeCommand(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { command } = req.body;
      const { cwd } = req.body;

      if (!command) {
        throw new ValidationError('Command is required');
      }

      // 验证命令
      const validation = validateCommand(command);
      if (!validation.allowed) {
        throw new ValidationError(validation.error || 'Command not allowed');
      }

      // 执行命令
      const { ExecutionEngineService } = await import('../../services/execution/index.js');
      const engineService = new ExecutionEngineService();

      const writer = {
        write: (data) => {
          if (!res.data) res.data = [];
          res.data.push(data);
        },
        isStreaming: false
      };

      const result = await engineService.execute(command, {
        userId,
        cwd,
        writer,
        containerMode: req.containerMode
      });

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default CommandController;
