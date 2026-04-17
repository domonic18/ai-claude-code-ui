/**
 * gitStatusParser.js
 *
 * Git 状态解析辅助函数 — 从 gitStatus.js 提取
 *
 * @module services/scm/gitStatusParser
 */

/**
 * 解析 git status --porcelain 输出
 * @param {string} statusOutput - porcelain 格式的状态输出
 * @returns {{modified: string[], added: string[], deleted: string[], untracked: string[]}}
 */
export function parseStatusOutput(statusOutput) {
    const modified = [];
    const added = [];
    const deleted = [];
    const untracked = [];

    statusOutput.split('\n').forEach(line => {
        if (!line.trim()) return;
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status === 'M ' || status === ' M' || status === 'MM') modified.push(file);
        else if (status === 'A ' || status === 'AM') added.push(file);
        else if (status === 'D ' || status === ' D') deleted.push(file);
        else if (status === '??') untracked.push(file);
    });

    return { modified, added, deleted, untracked };
}

/**
 * 去除 git diff 头部信息
 * @param {string} diff - 原始 diff 输出
 * @returns {string} 清理后的 diff
 */
export function stripDiffHeaders(diff) {
    if (!diff) return '';

    const lines = diff.split('\n');
    const filtered = [];
    let startIncluding = false;

    for (const line of lines) {
        if (line.startsWith('diff --git') || line.startsWith('index ') ||
            line.startsWith('new file mode') || line.startsWith('deleted file mode') ||
            line.startsWith('---') || line.startsWith('+++')) {
            continue;
        }
        if (line.startsWith('@@') || startIncluding) {
            startIncluding = true;
            filtered.push(line);
        }
    }

    return filtered.join('\n');
}
