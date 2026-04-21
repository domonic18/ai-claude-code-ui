/**
 * canUseTool Callback Template
 *
 * Generates the canUseTool callback code that intercepts AskUserQuestion
 * in the container SDK script. Communicates with the main container
 * via stdout (questions) and stdin (answers).
 *
 * @module container/claude/templates/canUseToolTemplate
 */

/**
 * Generate canUseTool callback code for intercepting AskUserQuestion
 *
 * When the SDK calls AskUserQuestion, this callback:
 * 1. Outputs the question via stdout as an agent-question message
 * 2. Waits for user answer via stdin (JSON line protocol)
 * 3. Resolves with the user's answer as updatedInput
 *
 * @returns {string} canUseTool callback code to embed in SDK script
 */
export function generateCanUseToolCallback() {
  return `
    // --- AskUserQuestion 交互回调 ---
    // 通过 stdout/stdin 与主容器通信，实现 Agent 向用户提问并等待回答
    const pendingAnswers = new Map();

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
            console.error("[SDK] Received user answer for toolUseID:", msg.toolUseID);
            resolve(msg.answer || '');
            pendingAnswers.delete(msg.toolUseID);
          }
        }
      } catch (e) {
        // 非 JSON 行可能是其他 stdout 输出干扰，仅 debug 级别记录
        console.error("[SDK] Skipping non-JSON stdin line:", trimmed.substring(0, 80));
      }
    });

    async function canUseTool(toolName, input, canUseToolOptions) {
      if (toolName === 'AskUserQuestion') {
        const toolUseID = canUseToolOptions.toolUseID;
        console.error("[SDK] canUseTool intercepted: AskUserQuestion, toolUseID:", toolUseID);

        // 通过 stdout 输出问题消息，主容器会转发给前端
        console.log(JSON.stringify({
          type: "agent-question",
          toolUseID: toolUseID,
          questions: input.questions || [],
          prompt: input.prompt || ''
        }));

        // 等待用户通过 stdin 回答（主容器会写入）
        return new Promise((resolve) => {
          pendingAnswers.set(toolUseID, (answer) => {
            resolve({
              behavior: 'allow',
              updatedInput: { ...input, answer: answer },
              toolUseID: toolUseID
            });
          });
        });
      }
      // 其他工具默认放行
      return { behavior: 'allow' };
    }`;
}
