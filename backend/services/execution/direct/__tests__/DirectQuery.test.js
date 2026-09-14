/**
 * DirectQuery.test.js
 *
 * queryDirect 边界校验单测：sessionId 白名单（防 jsonl 路径遍历——
 * sessionId 直接拼进 readDirectSessionEntries / appendDirectTurn 的容器路径）。
 * 拒绝路径在容器拉起之前返回，无 IO 副作用；完整编排链路留集成与端到端验收。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDirectSessionId, queryDirect } from '../DirectQuery.js';

describe('isValidDirectSessionId', () => {
  it('应接受 UUID（后端分配的真实会话 ID）', () => {
    assert.equal(isValidDirectSessionId('3ebac33e-7922-eea0-073d-3f9e1f9f6b1c'), true);
  });

  it('应接受 temp- 时间戳形态（前端新会话 temp-${Date.now()}）', () => {
    assert.equal(isValidDirectSessionId('temp-1697123456789'), true);
  });

  it('应接受 temp- UUID 形态（跨 provider 守卫降级 temp-${uuid}）', () => {
    assert.equal(isValidDirectSessionId('temp-3ebac33e-7922-eea0-073d-3f9e1f9f6b1c'), true);
  });

  it('应拒绝路径遍历与非法形态', () => {
    assert.equal(isValidDirectSessionId('../../etc/passwd'), false);
    assert.equal(isValidDirectSessionId('temp-../../x'), false);
    assert.equal(isValidDirectSessionId('a/b/c'), false);
    assert.equal(isValidDirectSessionId('abc'), false);
    assert.equal(isValidDirectSessionId('session;rm -rf'), false);
    assert.equal(isValidDirectSessionId('3ebac33e-7922-eea0-073d-3f9e1f9f6b1c.jsonl'), false);
  });

  it('应拒绝空值与非字符串', () => {
    assert.equal(isValidDirectSessionId(''), false);
    assert.equal(isValidDirectSessionId(null), false);
    assert.equal(isValidDirectSessionId(undefined), false);
    assert.equal(isValidDirectSessionId(123), false);
  });
});

describe('queryDirect sessionId 边界拦截', () => {
  it('非法 sessionId 应 direct-error 拒绝且不进入编排（容器拉起前返回）', async () => {
    const sent = [];
    const fakeWriter = { send: (msg) => sent.push(msg) };
    await queryDirect(
      'hi',
      { userId: 1, projectPath: 'p', model: 'm', sessionId: '../../etc/passwd' },
      [],
      fakeWriter,
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, 'direct-error');
    assert.match(sent[0].error, /非法会话 ID/);
  });
});
