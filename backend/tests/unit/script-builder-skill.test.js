/**
 * ScriptBuilder Skill / 系统上下文注入测试
 *
 * 验证注入策略的端到端集成：
 * - skill 触发行：放回 command（用 <ccui-inject> 包裹，与用户原话同处以便指代），前端显示时剥掉
 * - 其它 ambient 上下文（cwd/索引/文件/用户提示词等）→ systemContextParts → systemPrompt.append，且不透传给 SDK
 *
 * buildSDKScript 将 command、sdkOptions 各自 base64 编码后嵌入：
 *   command    → scriptContent 中的 `Buffer.from("${commandBase64}", "base64")`
 *   sdkOptions → result.optionsBase64
 * 分别解码后验证。
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

/** 从 optionsBase64 解码出最终 sdkOptions */
function decodeOptions(result) {
  return JSON.parse(Buffer.from(result.optionsBase64, 'base64').toString('utf-8'));
}

describe('ScriptBuilder — skill / 系统上下文注入', () => {
  const baseOptions = {
    sessionId: 'test-session',
    projectPath: '/workspace/test',
    permissionMode: 'default',
    model: 'sonnet',
  };

  it('options.skill 存在时，skill 触发行进 command（<ccui-inject> 包裹），不进 append', async () => {
    const result = await buildSDKScript('写一份专利交底书', {
      ...baseOptions,
      skill: 'patent-disclosure',
    }, 1);

    const command = decodeCommand(result);
    // skill 触发行回到 command（用 <ccui-inject> 包裹），与用户原话同处以便指代（如"这个技能"）
    assert.ok(
      command.startsWith('<ccui-inject type="skill">请使用 "patent-disclosure" skill 完成此任务。</ccui-inject>'),
      `command 应以 skill 包裹块开头，实际: ${command.substring(0, 80)}...`
    );
    assert.ok(command.includes('写一份专利交底书'), 'command 应保留原始用户输入');

    // skill 指令不应进入 systemPrompt.append（仅 ambient 上下文才进 append）
    const append = decodeOptions(result).systemPrompt?.append || '';
    assert.ok(!append.includes('请使用'), 'skill 指令不应出现在 systemPrompt.append');
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

  it('options.skill 含非法字符时应抛出错误', async () => {
    await assert.rejects(
      () => buildSDKScript('test', {
        ...baseOptions,
        skill: 'bad;skill${injection}',
      }, 1),
      { message: /Invalid skill name/ },
      '非法 skill 名称应被拒绝'
    );
  });

  it('systemContextParts 透传时装配为 systemPrompt.append，command 不受影响', async () => {
    const result = await buildSDKScript('用户输入', {
      ...baseOptions,
      systemContextParts: [
        '【系统提示】当前工作目录：/workspace/test。所有文件必须写入此目录或其子目录中。',
        '[项目文档索引 — 摘要目录]',
      ],
    }, 1);

    const command = decodeCommand(result);
    assert.strictEqual(command, '用户输入');

    const sdkOptions = decodeOptions(result);
    assert.ok(
      sdkOptions.systemPrompt.append.includes('【系统提示】当前工作目录：/workspace/test'),
      'append 应含 cwd 提示'
    );
    assert.ok(
      sdkOptions.systemPrompt.append.includes('[项目文档索引 — 摘要目录]'),
      'append 应含文档索引'
    );
    assert.ok(!('systemContextParts' in sdkOptions), 'systemContextParts 不应透传给 SDK');
  });
});
