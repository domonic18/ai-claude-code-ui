/**
 * canUseTool Callback Template
 *
 * Generates the canUseTool callback code that intercepts AskUserQuestion
 * in the container SDK script. Communicates with the main container
 * via stdout (questions) and stdin (answers).
 *
 * 回答注入协议（反编译 Claude CLI 0.3.206 确认，字段名必须精确匹配；
 * 0.3.207 起 allow+updatedInput 成为官方文档化契约，当前锁定 0.3.252）：
 * - 自由文本回答：updatedInput.response = 文本 → tool_result "The user responded: ..."
 * - 选项回答：updatedInput.answers = { [问题文本]: 选项label（多选逗号分隔） }
 *   → tool_result "Your questions have been answered: ..."
 * - 跳过：返回 { behavior: 'deny', message: 'User declined to answer questions' }
 *   → tool_result "User declined to answer questions"，任务继续由模型自行决策
 * 注意：顶层 answer 字段不在 CLI 协议中（历史 bug：注入后 CLI 判定"没人回答"）。
 *
 * AFK 超时自动采用：超过 QUESTION_AUTO_ANSWER_MS 未回复时，自动注入推荐选项
 * （label 含"推荐/Recommended"，无则第一个选项）并输出 agent-question-auto-answered
 * （reason:'afk_timeout'，主容器转发前端渲染终态）；CLAUDE_AFK_TIMEOUT_MS 调得更大，
 * 仅作 CLI 侧兜底（正常应在自动采用前收到 control_response）。
 *
 * In bypassPermissions mode, AskUserQuestion is auto-answered with "继续"
 * to prevent the AI from pausing long-running tasks to ask the user.
 *
 * @module container/claude/templates/canUseToolTemplate
 */

/** bypassPermissions 模式下自动回答的内容 */
const AUTO_ANSWER_TEXT = '继续';

/** 跳过提问时 CLI 渲染的语义文案（deny message 会进入 tool_result） */
const DECLINED_MESSAGE = 'User declined to answer questions';

/**
 * Generate canUseTool callback code for intercepting AskUserQuestion
 *
 * When the SDK calls AskUserQuestion, this callback:
 * - In bypassPermissions mode: auto-answers "继续" immediately (no user interaction)
 * - In other modes: outputs question via stdout, waits for user answer via stdin
 *
 * @param {boolean} autoAnswer - Whether to auto-answer questions without user interaction
 * @returns {string} canUseTool callback code to embed in SDK script
 */
export function generateCanUseToolCallback(autoAnswer = false) {
  if (autoAnswer) {
    return `
    // --- AskUserQuestion 自动回答回调（bypassPermissions 模式）---
    // 在无限制模式下，AI 不应主动询问用户，自动回复"${AUTO_ANSWER_TEXT}"以保持任务连续性
    async function canUseTool(toolName, input, canUseToolOptions) {
      try {
        if (toolName === 'AskUserQuestion') {
          const toolUseID = canUseToolOptions.toolUseID;
          console.error("[SDK] canUseTool auto-answer: AskUserQuestion, toolUseID:", toolUseID, "(bypassPermissions mode, auto-answering)");

          // 仍然通知前端 AI 尝试了提问（便于调试和审计），但不等待回答
          console.log(JSON.stringify({
            type: "agent-question-auto-answered",
            toolUseID: toolUseID,
            questions: input?.questions || [],
            prompt: input?.prompt || '',
            autoAnswer: "${AUTO_ANSWER_TEXT}"
          }));

          return {
            behavior: 'allow',
            updatedInput: { ...(input || {}), response: "${AUTO_ANSWER_TEXT}" },
            toolUseID: toolUseID
          };
        }
        // 其他工具默认放行，必须返回 updatedInput 以满足 SDK Zod schema 验证
        return { behavior: 'allow', updatedInput: input };
      } catch (err) {
        console.error("[SDK] canUseTool auto-answer error:", err.message);
        return { behavior: 'allow', updatedInput: input };
      }
    }`;
  }

  return `
    // --- AskUserQuestion 交互回调 ---
    // 通过 stdout/stdin 与主容器通信，实现 Agent 向用户提问并等待回答
    const pendingAnswers = new Map();

    // 将 stdin 消息解析为 canUseTool 的 PermissionResult。
    // 协议（与 CLI 0.3.252 对齐）：
    //   { mode:'text',    response } → allow + updatedInput.response（自由文本回答）
    //   { mode:'options', answers  } → allow + updatedInput.answers（{问题文本:选项label}）
    //   { mode:'skip' }             → deny（用户跳过，任务继续）
    //   { answer }（旧协议）        → 等价 text 模式，部署窗口期兼容
    function resolvePermissionResult(input, payload) {
      const mode = payload.mode || (payload.answer !== undefined ? 'text' : payload.response !== undefined ? 'text' : payload.answers !== undefined ? 'options' : 'skip');
      if (mode === 'options') {
        return {
          behavior: 'allow',
          updatedInput: { ...(input || {}), answers: payload.answers || {} },
          toolUseID: payload._toolUseID
        };
      }
      if (mode === 'skip') {
        return { behavior: 'deny', message: ${JSON.stringify(DECLINED_MESSAGE)}, toolUseID: payload._toolUseID };
      }
      const text = payload.response !== undefined ? payload.response : payload.answer;
      return {
        behavior: 'allow',
        updatedInput: { ...(input || {}), response: String(text || '') },
        toolUseID: payload._toolUseID
      };
    }

    // AFK 超时自动采用的推荐选项构造：每题取 label 含"推荐/Recommended"的选项
    //（AskUserQuestion 惯例推荐项放首位/标注），无匹配取第一个；multiSelect 取全部
    // 匹配项逗号 join（与用户手动多选的协议一致）；无 options 的题跳过。
    // 返回值可能为空对象（全部问题无选项），由调用方降级 text 通道
    function pickRecommendedAnswers(questions) {
      const answers = {};
      for (const q of (questions || [])) {
        const opts = (q.options || []).filter((o) => o && typeof o.label === 'string' && o.label);
        if (opts.length === 0) continue;
        const recommended = opts.filter((o) => /推荐|recommended/i.test(o.label));
        answers[q.question] = (q.multiSelect && recommended.length > 1)
          ? recommended.map((o) => o.label).join(', ')
          : (recommended[0] || opts[0]).label;
      }
      return answers;
    }

    // 从 stdin 读取主容器转发过来的用户回答
    const readline = await import('readline');
    // 非 TTY 模式下 stdin 默认处于暂停状态，必须显式 resume 才能 read line
    process.stdin.resume();
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return; // skip empty lines
      try {
        const msg = JSON.parse(trimmed);
        if (msg.type === 'user-answer' && msg.toolUseID) {
          const resolve = pendingAnswers.get(msg.toolUseID);
          if (resolve) {
            console.error("[SDK] Received user answer for toolUseID:", msg.toolUseID, "mode:", msg.mode || 'legacy-text');
            resolve({ ...msg, _toolUseID: msg.toolUseID });
            pendingAnswers.delete(msg.toolUseID);
          } else {
            // 该 toolUseID 没有等待中的 ask（会话已推进/结束/卡死，或用户回答了一个已失效的提问）。
            // 此前这里直接静默丢弃，前端表现为"输入了却没反应"（连容器日志都没有）。
            // 现在输出明确反馈，经主容器 MessageTransformer 转发前端，提示用户重新发送。
            const pending = Array.from(pendingAnswers.keys());
            console.error("[SDK] user-answer dropped: no pending ask for toolUseID:", msg.toolUseID, "(pending:", pending, ")");
            console.log(JSON.stringify({
              type: "agent-answer-dropped",
              toolUseID: msg.toolUseID,
              reason: pending.length === 0 ? "no_active_ask" : "toolUseID_mismatch",
              pendingToolUseIDs: pending
            }));
          }
        }
      } catch (e) {
        // 非 JSON 行可能是其他 stdout 输出干扰，仅 debug 级别记录
        console.error("[SDK] Skipping non-JSON stdin line:", trimmed.substring(0, 80));
      }
    });

    async function canUseTool(toolName, input, canUseToolOptions) {
      try {
        if (toolName === 'AskUserQuestion') {
          const toolUseID = canUseToolOptions.toolUseID;
          console.error("[SDK] canUseTool intercepted: AskUserQuestion, toolUseID:", toolUseID);

          // 通过 stdout 输出问题消息，主容器会转发给前端。
          // timeoutMs 优先取 QUESTION_AUTO_ANSWER_MS（用户回答窗口，超时自动采用推荐选项），
          // 兜底 CLAUDE_AFK_TIMEOUT_MS（该值为 CLI 兜底线，大于回答窗口，仅在旧部署
          // 未注入新 env 时使用）；前端据此渲染倒计时进度线；皆缺省时不输出该字段
          const answerWindowMs = Number(process.env.QUESTION_AUTO_ANSWER_MS) || Number(process.env.CLAUDE_AFK_TIMEOUT_MS) || 0;
          console.log(JSON.stringify({
            type: "agent-question",
            toolUseID: toolUseID,
            questions: input?.questions || [],
            prompt: input?.prompt || '',
            ...(answerWindowMs > 0 && { timeoutMs: answerWindowMs })
          }));

          // 等待用户通过 stdin 回答（主容器会写入），按协议注入 response/answers 或 deny。
          // 超过回答窗口未回复：自动采用推荐选项继续执行（必须先于 CLI 的
          // CLAUDE_AFK_TIMEOUT_MS 兜底线注入，因此 DockerExecutor 把该 env 调得更大）
          return new Promise((resolve) => {
            let autoAnswerTimer = null;
            // 统一结算入口：先清定时器再注入（用户先答 / 超时自动采用共用，防双触发）
            const settle = (payload) => {
              if (autoAnswerTimer) { clearTimeout(autoAnswerTimer); autoAnswerTimer = null; }
              try {
                resolve(resolvePermissionResult(input, payload));
              } catch (err) {
                console.error("[SDK] resolve answer error:", err.message);
                resolve({ behavior: 'allow', updatedInput: input, toolUseID: toolUseID });
              }
            };
            pendingAnswers.set(toolUseID, settle);
            const timeoutMs = Number(process.env.QUESTION_AUTO_ANSWER_MS) || 0;
            // env 缺省（旧镜像/手工 exec）时不 arm 定时器：退化为 CLI AFK 现状行为
            if (timeoutMs > 0) {
              autoAnswerTimer = setTimeout(() => {
                autoAnswerTimer = null;
                // 用户已回答或已被消费，不再自动采用
                if (!pendingAnswers.has(toolUseID)) return;
                pendingAnswers.delete(toolUseID);
                try {
                  const answers = pickRecommendedAnswers(input?.questions);
                  if (Object.keys(answers).length > 0) {
                    console.log(JSON.stringify({ type: "agent-question-auto-answered", reason: "afk_timeout", toolUseID: toolUseID, answers: answers }));
                    settle({ mode: 'options', answers: answers, _toolUseID: toolUseID });
                  } else {
                    // 全部问题均无选项：降级自由文本回答，保持任务连续性
                    console.log(JSON.stringify({ type: "agent-question-auto-answered", reason: "afk_timeout", toolUseID: toolUseID, response: ${JSON.stringify(AUTO_ANSWER_TEXT)} }));
                    settle({ mode: 'text', response: ${JSON.stringify(AUTO_ANSWER_TEXT)}, _toolUseID: toolUseID });
                  }
                } catch (err) {
                  // 构造/输出异常（如进程临死 EPIPE）时按跳过处理：deny 语义，任务仍继续
                  console.error("[SDK] auto-answer error:", err.message);
                  settle({ mode: 'skip', _toolUseID: toolUseID });
                }
              }, timeoutMs);
              // 不阻塞进程退出：query 自然结束后不应因残留 pending 挂活脚本进程
              if (typeof autoAnswerTimer.unref === 'function') autoAnswerTimer.unref();
            }
          });
        }
        // 其他工具默认放行，必须返回 updatedInput 以满足 SDK Zod schema 验证
        return { behavior: 'allow', updatedInput: input };
      } catch (err) {
        console.error("[SDK] canUseTool interactive error:", err.message);
        return { behavior: 'allow', updatedInput: input };
      }
    }`;
}
