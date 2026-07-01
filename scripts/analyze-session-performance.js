#!/usr/bin/env node
/**
 * Session Performance Analyzer
 *
 * 从 docker compose logs 提取会话各阶段耗时，输出 MECE 分解表格与统计报告。
 *
 * Usage:
 *   node scripts/analyze-session-performance.js [minutes-ago]
 *
 * Example:
 *   node scripts/analyze-session-performance.js 30    # 分析最近 30 分钟
 */

import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// 阶段定义（MECE 顺序）
// ---------------------------------------------------------------------------
const STAGES = [
  {
    key: 'p1_request',
    label: '① 请求前置',
    desc: 'buildClaudeCommand + readme 读取',
    pattern: /Command built/,
    field: 'cost',
  },
  {
    key: 'p2_container',
    label: '② 容器获取',
    desc: 'getOrCreateContainer（热/冷启动）',
    pattern: /Container obtained/,
    field: 'cost',
  },
  {
    key: 'p3_script_build',
    label: '③ 脚本构建',
    desc: 'filterSDKOptions + buildSDKScript',
    pattern: /Script prepared/,
    field: 'cost',
  },
  {
    key: 'p4_script_upload',
    label: '④ 脚本上传',
    desc: 'writeFileViaPutArchive（options + script）',
    pattern: /Script files uploaded/,
    field: 'cost',
  },
  {
    key: 'p5_exec_spawn',
    label: '⑤ Docker exec',
    desc: 'containerManager.execInContainer',
    pattern: /Docker exec stream obtained/,
    field: 'cost',
  },
  {
    key: 'p6_sdk_init',
    label: '⑥ SDK 初始化',
    desc: '容器内 script_start → api_call_start',
    pattern: /\[SDK_PERF\] Container SDK init/,
    field: 'cost',
  },
  {
    key: 'p7_ttft',
    label: '⑦ TTFT（首字节）',
    desc: 'api_call_start → first_chunk',
    pattern: /First token received \(TTFT\)/,
    field: 'cost',
  },
  {
    key: 'p8_stream',
    label: '⑧ 流式传输',
    desc: 'first_chunk → done',
    pattern: /Stream duration ended/,
    field: 'cost',
  },
  {
    key: 'p9_teardown',
    label: '⑨ 结束清理',
    desc: 'done → stream destroy',
    pattern: /Teardown completed/,
    field: 'cost',
  },
];

const TOTAL_STAGES = [
  {
    key: 'total_query',
    label: 'Query 总耗时',
    pattern: /Claude query completed/,
    field: 'cost',
  },
  {
    key: 'total_exec',
    label: 'Exec 总耗时',
    pattern: /Docker exec completed/,
    field: 'cost',
  },
];

// ---------------------------------------------------------------------------
// 日志获取
// ---------------------------------------------------------------------------
function getLogs() {
  const logPath = '/var/lib/claude-code/logs/app.log';
  try {
    return readFileSync(logPath, 'utf-8');
  } catch (e) {
    console.error('读取日志失败:', e.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 日志解析
// ---------------------------------------------------------------------------
function parseLogs(logText) {
  const sessions = new Map();

  for (const line of logText.split('\n')) {
    // docker compose logs 前缀格式: "claude-code-app  | {"..."}"
    const jsonStart = line.indexOf('{');
    if (jsonStart === -1) continue;

    try {
      const entry = JSON.parse(line.substring(jsonStart));
      const sid = entry.sessionId;
      if (!sid || sid.startsWith('temp-')) {
        // 保留 temp- 前缀的 session，但尝试从后续日志中找到真实 sessionId
      }

      if (!sessions.has(sid)) {
        sessions.set(sid, { stages: {}, raw: [], toolResults: [] });
      }
      sessions.get(sid).raw.push(entry);

      const msg = entry.msg || '';

      for (const stage of STAGES) {
        if (stage.pattern.test(msg) && entry[stage.field] !== undefined) {
          sessions.get(sid).stages[stage.key] = entry[stage.field];
        }
      }

      for (const stage of TOTAL_STAGES) {
        if (stage.pattern.test(msg) && entry[stage.field] !== undefined) {
          sessions.get(sid).stages[stage.key] = entry[stage.field];
        }
      }

      // 解析工具结果耗时（用于 ⑧ 流式传输内部拆解：工具执行 vs API推理+loop）
      if (msg.includes('[ToolResult]') && typeof entry.durationMs === 'number') {
        sessions.get(sid).toolResults.push({
          toolName: entry.toolName || 'unknown',
          durationMs: entry.durationMs,
          isError: !!entry.isError,
        });
      }
    } catch {
      // 忽略解析失败的行
    }
  }

  // 过滤：只保留有 query completed 的完整会话
  const complete = [];
  for (const [sid, data] of sessions) {
    if (data.stages.total_query !== undefined) {
      complete.push({ sessionId: sid, ...data });
    }
  }

  // 按 query 总耗时排序（方便观察）
  complete.sort((a, b) => (a.stages.total_query || 0) - (b.stages.total_query || 0));

  return complete;
}

// ---------------------------------------------------------------------------
// 统计计算
// ---------------------------------------------------------------------------
function computeStats(values) {
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
  if (valid.length === 0) return { max: null, min: null, avg: null, count: 0 };
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return { max, min, avg, count: valid.length };
}

// ---------------------------------------------------------------------------
// 格式化
// ---------------------------------------------------------------------------
function fmtMs(ms) {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtMsRaw(ms) {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}`;
  return `${(ms / 1000).toFixed(1)}`;
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ---------------------------------------------------------------------------
// 渲染报告
// ---------------------------------------------------------------------------
function renderReport(sessions) {
  if (sessions.length === 0) {
    console.log('未找到完整的会话数据（缺少 Claude query completed 日志）。');
    console.log('请确认：1) 已发送请求并等待完成；2) 日志范围包含该次请求。');
    return;
  }

  const n = sessions.length;
  const colWidth = 14;
  const labelWidth = 22;

  // 计算每列数据
  const cols = sessions.map((s, idx) => ({
    idx: idx + 1,
    sessionId: s.sessionId.slice(0, 8),
    values: STAGES.map((st) => s.stages[st.key]),
    totalQuery: s.stages.total_query,
    totalExec: s.stages.total_exec,
  }));

  // 计算每阶段统计
  const stats = STAGES.map((st) => {
    const values = sessions.map((s) => s.stages[st.key]).filter((v) => v !== undefined);
    return computeStats(values);
  });

  // 总耗时统计
  const totalQueryStats = computeStats(sessions.map((s) => s.stages.total_query));
  const totalExecStats = computeStats(sessions.map((s) => s.stages.total_exec));

  // 计算"用户感知" = 请求前置 + 容器获取 + 脚本构建 + 脚本上传 + Docker exec + SDK 初始化 + TTFT + 流式传输
  const userPerceived = sessions.map((s) => {
    const keys = ['p1_request', 'p2_container', 'p3_script_build', 'p4_script_upload', 'p5_exec_spawn', 'p6_sdk_init', 'p7_ttft', 'p8_stream'];
    let sum = 0;
    let hasAny = false;
    for (const k of keys) {
      if (s.stages[k] !== undefined) {
        sum += s.stages[k];
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  });
  const userPerceivedStats = computeStats(userPerceived);

  // 计算"容器占用" = 容器获取 + 脚本构建 + 脚本上传 + Docker exec + SDK 初始化 + TTFT + 流式传输 + 结束清理
  const containerHold = sessions.map((s) => {
    const keys = ['p2_container', 'p3_script_build', 'p4_script_upload', 'p5_exec_spawn', 'p6_sdk_init', 'p7_ttft', 'p8_stream', 'p9_teardown'];
    let sum = 0;
    let hasAny = false;
    for (const k of keys) {
      if (s.stages[k] !== undefined) {
        sum += s.stages[k];
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  });
  const containerHoldStats = computeStats(containerHold);

  // ── 表头 ──
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  会话性能分析报告 — ${n} 个请求`);
  console.log(`${'='.repeat(80)}\n`);

  // ── MECE 阶段表格 ──
  console.log('  MECE 阶段耗时分解');
  console.log(`  ${'-'.repeat(76)}`);

  // 标题行
  let header = `  ${pad('阶段', labelWidth)}`;
  for (let i = 1; i <= n; i++) {
    header += `| ${pad(`#${i}`, colWidth)} `;
  }
  header += `| ${pad('最大', 10)} | ${pad('最小', 10)} | ${pad('平均', 10)}`;
  console.log(header);
  console.log(`  ${'-'.repeat(76)}`);

  // 数据行
  for (let i = 0; i < STAGES.length; i++) {
    const st = STAGES[i];
    const stat = stats[i];
    let row = `  ${pad(st.label, labelWidth)}`;
    for (const col of cols) {
      row += `| ${pad(fmtMs(col.values[i]), colWidth)} `;
    }
    row += `| ${pad(fmtMs(stat.max), 10)} | ${pad(fmtMs(stat.min), 10)} | ${pad(fmtMs(stat.avg), 10)}`;
    console.log(row);
  }

  // 汇总行
  console.log(`  ${'-'.repeat(76)}`);
  let sumRow = `  ${pad('Exec 总耗时', labelWidth)}`;
  for (const col of cols) {
    sumRow += `| ${pad(fmtMs(col.totalExec), colWidth)} `;
  }
  sumRow += `| ${pad(fmtMs(totalExecStats.max), 10)} | ${pad(fmtMs(totalExecStats.min), 10)} | ${pad(fmtMs(totalExecStats.avg), 10)}`;
  console.log(sumRow);

  // ── 关键指标表格 ──
  console.log(`\n  ${'-'.repeat(76)}`);
  console.log('  关键指标');
  console.log(`  ${'-'.repeat(76)}`);

  const metrics = [
    { label: '用户感知耗时（①→⑧）', stats: userPerceivedStats },
    { label: '容器实际占用（②→⑨）', stats: containerHoldStats },
  ];

  for (const m of metrics) {
    const s = m.stats;
    if (s.count === 0) {
      console.log(`  ${pad(m.label, 30)} 数据不足`);
      continue;
    }
    let line = `  ${pad(m.label, 30)} 最大=${pad(fmtMs(s.max), 8)} 最小=${pad(fmtMs(s.min), 8)} 平均=${pad(fmtMs(s.avg), 8)}`;
    if (m.note) line += `  (${m.note})`;
    console.log(line);
  }

  // ── ⑧ 流式传输内部拆解（agentic loop：工具执行 vs API推理+loop）──
  console.log(`\n  ${'-'.repeat(76)}`);
  console.log('  ⑧ 流式传输内部拆解');
  console.log(`  ${'-'.repeat(76)}`);

  const loopCols = sessions.map((s) => {
    const toolResults = s.toolResults || [];
    const toolTotalMs = toolResults.reduce((a, t) => a + (t.durationMs || 0), 0);
    const toolCount = toolResults.length;
    const streamMs = s.stages.p8_stream;
    const apiLoopMs = streamMs != null ? streamMs - toolTotalMs : null;
    const toolRatio = streamMs && streamMs > 0 ? toolTotalMs / streamMs : null;
    return { toolTotalMs, toolCount, streamMs, apiLoopMs, toolRatio, toolResults };
  });

  console.log(`  ${pad('会话', 8)}| ${pad('⑧流式', 12)} | ${pad('工具总耗时', 12)} | ${pad('工具次数', 10)} | ${pad('API+loop', 12)} | ${pad('工具占比', 10)}`);
  console.log(`  ${'-'.repeat(76)}`);
  sessions.forEach((s, idx) => {
    const c = loopCols[idx];
    const ratioStr = c.toolRatio != null ? `${(c.toolRatio * 100).toFixed(0)}%` : '-';
    console.log(`  ${pad('#' + (idx + 1), 8)}| ${pad(fmtMs(c.streamMs), 12)} | ${pad(fmtMs(c.toolTotalMs), 12)} | ${pad(c.toolCount, 10)} | ${pad(fmtMs(c.apiLoopMs), 12)} | ${pad(ratioStr, 10)}`);
  });

  // 工具耗时分布（按 toolName 聚合，降序）
  const byTool = new Map();
  for (const c of loopCols) {
    for (const t of c.toolResults) {
      if (!byTool.has(t.toolName)) byTool.set(t.toolName, { count: 0, totalMs: 0, maxMs: 0 });
      const agg = byTool.get(t.toolName);
      agg.count++;
      agg.totalMs += t.durationMs || 0;
      agg.maxMs = Math.max(agg.maxMs, t.durationMs || 0);
    }
  }
  if (byTool.size > 0) {
    console.log(`\n  工具耗时分布（按工具，降序）`);
    console.log(`  ${'-'.repeat(76)}`);
    console.log(`  ${pad('工具', 16)}| ${pad('次数', 8)} | ${pad('总耗时', 12)} | ${pad('平均', 10)} | ${pad('最大', 10)}`);
    console.log(`  ${'-'.repeat(76)}`);
    const toolRows = [...byTool.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
    for (const [name, agg] of toolRows) {
      const avg = agg.count > 0 ? agg.totalMs / agg.count : 0;
      console.log(`  ${pad(name, 16)}| ${pad(agg.count, 8)} | ${pad(fmtMs(agg.totalMs), 12)} | ${pad(fmtMs(avg), 10)} | ${pad(fmtMs(agg.maxMs), 10)}`);
    }
  }

  // ── 关键发现 ──
  console.log(`\n  ${'-'.repeat(76)}`);
  console.log('  关键发现');
  console.log(`  ${'-'.repeat(76)}`);

  const findings = [];

  // 冷启动检测
  const coldStarts = sessions.filter((s) => (s.stages.p2_container || 0) > 2000);
  if (coldStarts.length > 0) {
    findings.push(`冷启动: ${coldStarts.length} 次，耗时 ${coldStarts.map((s) => fmtMs(s.stages.p2_container)).join(', ')}`);
  } else {
    findings.push('冷启动: 未检测到（所有容器获取 < 2s）');
  }

  // TTFT 分析
  const ttftVals = sessions.map((s) => s.stages.p7_ttft).filter((v) => v !== undefined);
  if (ttftVals.length > 0) {
    const avg = ttftVals.reduce((a, b) => a + b, 0) / ttftVals.length;
    findings.push(`TTFT: 平均 ${fmtMs(avg)}，范围 ${fmtMs(Math.min(...ttftVals))} ~ ${fmtMs(Math.max(...ttftVals))}`);
  }

  // 流式传输占比
  const streamRatios = sessions
    .map((s) => {
      const stream = s.stages.p8_stream;
      const exec = s.stages.total_exec;
      if (stream && exec) return stream / exec;
      return null;
    })
    .filter((v) => v !== null);
  if (streamRatios.length > 0) {
    const avgRatio = streamRatios.reduce((a, b) => a + b, 0) / streamRatios.length;
    findings.push(`流式传输占 exec 比例: 平均 ${(avgRatio * 100).toFixed(1)}%`);
  }

  // 工具耗时占 ⑧ 比例 + 最慢工具
  const toolRatios = loopCols.map((c) => c.toolRatio).filter((v) => v != null);
  if (toolRatios.length > 0) {
    const avgRatio = toolRatios.reduce((a, b) => a + b, 0) / toolRatios.length;
    findings.push(`工具耗时占 ⑧ 平均 ${(avgRatio * 100).toFixed(0)}%（剩余为 API 推理 + loop 间隙）`);
  }
  if (byTool.size > 0) {
    const top = [...byTool.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs)[0];
    findings.push(`最耗时工具: ${top[0]}（${top[1].count} 次，共 ${fmtMs(top[1].totalMs)}，最大 ${fmtMs(top[1].maxMs)}）`);
  }

  for (const f of findings) {
    console.log(`  • ${f}`);
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const minutesAgo = process.argv[2];
const logs = getLogs();
const sessions = parseLogs(logs);
renderReport(sessions);
