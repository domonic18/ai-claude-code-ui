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
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'user-answer' && msg.toolUseID) {
          const resolve = pendingAnswers.get(msg.toolUseID);
          if (resolve) {
            console.error("[SDK] Received user answer for toolUseID:", msg.toolUseID);
            resolve(msg.answer || '');
            pendingAnswers.delete(msg.toolUseID);
          }
        }
      } catch (e) {
        console.error("[SDK] Failed to parse stdin line:", e.message);
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
