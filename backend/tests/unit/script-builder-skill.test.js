/**
 * ScriptBuilder Skill Tests
 *
 * 验证 skill 选择功能的端到端集成：
 * - 用户选了 skill → options.skill 传入 → command 前是否拼上 skill 指令
 *
 * buildSDKScript 将 command base64 编码后嵌入 scriptContent 字符串：
 *   `Buffer.from("${commandBase64}", "base64").toString("utf-8")`
 * 通过正则从 scriptContent 中提取 commandBase64 并解码验证。
 *
 * @module tests/unit/script-builder-skill
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSDKScript } from '../../services/container/claude/ScriptBuilder.js';

/** 从 scriptContent 中提取并解码 command */
function decodeCommand(result) {
  const match = result.scriptContent.match(/Buffer\.from\("([^"]+)",\s*"base64"\)/);
  assert.ok(match, 'scriptContent 中未找到 commandBase64');
  return Buffer.from(match[1], 'base64').toString('utf-8');
}

describe('ScriptBuilder — skill 注入', () => {
  const baseOptions = {
    sessionId: 'test-session',
    projectPath: '/workspace/test',
    permissionMode: 'default',
    model: 'sonnet',
  };

  it('options.skill 存在时，command 前应拼上 skill 调用指令', async () => {
    const result = await buildSDKScript('写一份专利交底书', {
      ...baseOptions,
      skill: 'patent-disclosure',
    }, 1);

    const command = decodeCommand(result);
    assert.ok(
      command.startsWith('请使用 "patent-disclosure" skill 完成此任务。'),
      `command 应以 skill 指令开头，实际: ${command.substring(0, 60)}...`
    );
    assert.ok(command.includes('写一份专利交底书'), 'command 应保留原始用户输入');
  });

  it('options.skill 不存在时，command 保持原样', async () => {
    const result = await buildSDKScript('普通聊天消息', baseOptions, 1);

    const command = decodeCommand(result);
    assert.strictEqual(command, '普通聊天消息');
  });

  it('options.skill 为空字符串时，command 保持原样', async () => {
    const result = await buildSDKScript('普通聊天消息', {
      ...baseOptions,
      skill: '',
    }, 1);

    const command = decodeCommand(result);
    assert.strictEqual(command, '普通聊天消息');
  });
});
