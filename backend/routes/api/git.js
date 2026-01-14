import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { extractProjectDirectory } from '../../services/projects/index.js';
import { queryClaudeSDK } from '../../services/execution/claude/index.js';
import { spawnCursor } from '../../services/execution/cursor/index.js';

const router = express.Router();
const execAsync = promisify(exec);

// 辅助函数：从编码的项目名称中获取实际项目路径
async function getActualProjectPath(projectName) {
  try {
    return await extractProjectDirectory(projectName);
  } catch (error) {
    console.error(`Error extracting project directory for ${projectName}:`, error);
    // 回退到旧方法
    return projectName.replace(/-/g, '/');
  }
}

// 辅助函数：去除 git diff 头部信息
function stripDiffHeaders(diff) {
  if (!diff) return '';

  const lines = diff.split('\n');
  const filteredLines = [];
  let startIncluding = false;

  for (const line of lines) {
    // 跳过所有头部行，包括 diff --git、index、文件模式和 --- / +++ 文件路径
    if (line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('new file mode') ||
        line.startsWith('deleted file mode') ||
        line.startsWith('---') ||
        line.startsWith('+++')) {
      continue;
    }

    // 从 @@ hunk 头部开始包含行
    if (line.startsWith('@@') || startIncluding) {
      startIncluding = true;
      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}

// 辅助函数：验证 git 仓库
async function validateGitRepository(projectPath) {
  try {
    // 检查目录是否存在
    await fs.access(projectPath);
  } catch {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // 使用 --show-toplevel 获取 git 仓库的根目录
    const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: projectPath });
    const normalizedGitRoot = path.resolve(gitRoot.trim());
    const normalizedProjectPath = path.resolve(projectPath);

    // 确保 git 根目录与我们的项目路径匹配（防止使用父级 git 仓库）
    if (normalizedGitRoot !== normalizedProjectPath) {
      throw new Error(`Project directory is not a git repository. This directory is inside a git repository at ${normalizedGitRoot}, but git operations should be run from the repository root.`);
    }
  } catch (error) {
    if (error.message.includes('Project directory is not a git repository')) {
      throw error;
    }
    throw new Error('Not a git repository. This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.');
  }
}

// 获取项目的 git 状态
router.get('/status', async (req, res) => {
  const { project } = req.query;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 验证 git 仓库
    await validateGitRepository(projectPath);

    // 获取当前分支 - 处理还没有提交的情况
    let branch = 'main';
    let hasCommits = true;
    try {
      const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      branch = branchOutput.trim();
    } catch (error) {
      // HEAD 不存在 - 仓库还没有提交
      if (error.message.includes('unknown revision') || error.message.includes('ambiguous argument')) {
        hasCommits = false;
        branch = 'main';
      } else {
        throw error;
      }
    }

    // 获取 git 状态
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });

    const modified = [];
    const added = [];
    const deleted = [];
    const untracked = [];

    statusOutput.split('\n').forEach(line => {
      if (!line.trim()) return;

      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status === 'M ' || status === ' M' || status === 'MM') {
        modified.push(file);
      } else if (status === 'A ' || status === 'AM') {
        added.push(file);
      } else if (status === 'D ' || status === ' D') {
        deleted.push(file);
      } else if (status === '??') {
        untracked.push(file);
      }
    });

    res.json({
      branch,
      hasCommits,
      modified,
      added,
      deleted,
      untracked
    });
  } catch (error) {
    console.error('Git status error:', error);
    res.json({
      error: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
        ? error.message
        : 'Git operation failed',
      details: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
        ? error.message
        : `Failed to get git status: ${error.message}`
    });
  }
});

// 获取特定文件的 diff
router.get('/diff', async (req, res) => {
  const { project, file } = req.query;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 验证 git 仓库
    await validateGitRepository(projectPath);

    // 检查文件是否未跟踪或已删除
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    const isUntracked = statusOutput.startsWith('??');
    const isDeleted = statusOutput.trim().startsWith('D ') || statusOutput.trim().startsWith(' D');

    let diff;
    if (isUntracked) {
      // 对于未跟踪的文件，将整个文件内容显示为添加
      const filePath = path.join(projectPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // 对于目录，显示简单消息
        diff = `Directory: ${file}\n(Cannot show diff for directories)`;
      } else {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` +
               lines.map(line => `+${line}`).join('\n');
      }
    } else if (isDeleted) {
      // 对于已删除的文件，将 HEAD 中的整个文件内容显示为删除
      const { stdout: fileContent } = await execAsync(`git show HEAD:"${file}"`, { cwd: projectPath });
      const lines = fileContent.split('\n');
      diff = `--- a/${file}\n+++ /dev/null\n@@ -1,${lines.length} +0,0 @@\n` +
             lines.map(line => `-${line}`).join('\n');
    } else {
      // 获取已跟踪文件的 diff
      // 首先检查未暂存的更改（工作树 vs 索引）
      const { stdout: unstagedDiff } = await execAsync(`git diff -- "${file}"`, { cwd: projectPath });

      if (unstagedDiff) {
        // 如果存在未暂存的更改，则显示
        diff = stripDiffHeaders(unstagedDiff);
      } else {
        // 如果没有未暂存的更改，则检查已暂存的更改（索引 vs HEAD）
        const { stdout: stagedDiff } = await execAsync(`git diff --cached -- "${file}"`, { cwd: projectPath });
        diff = stripDiffHeaders(stagedDiff) || '';
      }
    }

    res.json({ diff });
  } catch (error) {
    console.error('Git diff error:', error);
    res.json({ error: error.message });
  }
});

// 获取文件内容和 diff 信息，用于 CodeEditor
router.get('/file-with-diff', async (req, res) => {
  const { project, file } = req.query;

  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 验证 git 仓库
    await validateGitRepository(projectPath);

    // 检查文件状态
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    const isUntracked = statusOutput.startsWith('??');
    const isDeleted = statusOutput.trim().startsWith('D ') || statusOutput.trim().startsWith(' D');

    let currentContent = '';
    let oldContent = '';

    if (isDeleted) {
      // 对于已删除的文件，从 HEAD 获取内容
      const { stdout: headContent } = await execAsync(`git show HEAD:"${file}"`, { cwd: projectPath });
      oldContent = headContent;
      currentContent = headContent; // 在编辑器中显示已删除的内容
    } else {
      // 获取当前文件内容
      const filePath = path.join(projectPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // 无法显示目录的内容
        return res.status(400).json({ error: 'Cannot show diff for directories' });
      }

      currentContent = await fs.readFile(filePath, 'utf-8');

      if (!isUntracked) {
        // 从 HEAD 获取已跟踪文件的旧内容
        try {
          const { stdout: headContent } = await execAsync(`git show HEAD:"${file}"`, { cwd: projectPath });
          oldContent = headContent;
        } catch (error) {
          // 文件可能是新添加到 git 的（已暂存但未提交）
          oldContent = '';
        }
      }
    }

    res.json({
      currentContent,
      oldContent,
      isDeleted,
      isUntracked
    });
  } catch (error) {
    console.error('Git file-with-diff error:', error);
    res.json({ error: error.message });
  }
});

// 创建初始提交
router.post('/initial-commit', async (req, res) => {
  const { project } = req.body;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 验证 git 仓库
    await validateGitRepository(projectPath);

    // 检查是否已经有提交
    try {
      await execAsync('git rev-parse HEAD', { cwd: projectPath });
      return res.status(400).json({ error: 'Repository already has commits. Use regular commit instead.' });
    } catch (error) {
      // 没有 HEAD - 这很好，我们可以创建初始提交
    }

    // 添加所有文件
    await execAsync('git add .', { cwd: projectPath });

    // 创建初始提交
    const { stdout } = await execAsync('git commit -m "Initial commit"', { cwd: projectPath });

    res.json({ success: true, output: stdout, message: 'Initial commit created successfully' });
  } catch (error) {
    console.error('Git initial commit error:', error);

    // 处理没有任何内容可提交的情况
    if (error.message.includes('nothing to commit')) {
      return res.status(400).json({
        error: 'Nothing to commit',
        details: 'No files found in the repository. Add some files first.'
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// 提交更改
router.post('/commit', async (req, res) => {
  const { project, message, files } = req.body;
  
  if (!project || !message || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name, commit message, and files are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 验证 git 仓库
    await validateGitRepository(projectPath);

    // 暂存选定的文件
    for (const file of files) {
      await execAsync(`git add "${file}"`, { cwd: projectPath });
    }

    // 提交并附带消息
    const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error('Git commit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取分支列表
router.get('/branches', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 验证 git 仓库
    await validateGitRepository(projectPath);

    // 获取所有分支
    const { stdout } = await execAsync('git branch -a', { cwd: projectPath });

    // 解析分支
    const branches = stdout
      .split('\n')
      .map(branch => branch.trim())
      .filter(branch => branch && !branch.includes('->')) // 移除空行和 HEAD 指针
      .map(branch => {
        // 移除当前分支的星号
        if (branch.startsWith('* ')) {
          return branch.substring(2);
        }
        // 移除 remotes/ 前缀
        if (branch.startsWith('remotes/origin/')) {
          return branch.substring(15);
        }
        return branch;
      })
      .filter((branch, index, self) => self.indexOf(branch) === index); // 移除重复项
    
    res.json({ branches });
  } catch (error) {
    console.error('Git branches error:', error);
    res.json({ error: error.message });
  }
});

// 切换分支
router.post('/checkout', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 切换分支
    const { stdout } = await execAsync(`git checkout "${branch}"`, { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error('Git checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建新分支
router.post('/create-branch', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch name are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 创建并切换到新分支
    const { stdout } = await execAsync(`git checkout -b "${branch}"`, { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error('Git create branch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取最近的提交
router.get('/commits', async (req, res) => {
  const { project, limit = 10 } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 获取带有统计信息的提交日志
    const { stdout } = await execAsync(
      `git log --pretty=format:'%H|%an|%ae|%ad|%s' --date=relative -n ${limit}`,
      { cwd: projectPath }
    );
    
    const commits = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, author, email, date, ...messageParts] = line.split('|');
        return {
          hash,
          author,
          email,
          date,
          message: messageParts.join('|')
        };
      });

    // 获取每个提交的统计信息
    for (const commit of commits) {
      try {
        const { stdout: stats } = await execAsync(
          `git show --stat --format='' ${commit.hash}`,
          { cwd: projectPath }
        );
        commit.stats = stats.trim().split('\n').pop(); // 获取摘要行
      } catch (error) {
        commit.stats = '';
      }
    }
    
    res.json({ commits });
  } catch (error) {
    console.error('Git commits error:', error);
    res.json({ error: error.message });
  }
});

// 获取特定提交的 diff
router.get('/commit-diff', async (req, res) => {
  const { project, commit } = req.query;
  
  if (!project || !commit) {
    return res.status(400).json({ error: 'Project name and commit hash are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 获取提交的 diff
    const { stdout } = await execAsync(
      `git show ${commit}`,
      { cwd: projectPath }
    );
    
    res.json({ diff: stdout });
  } catch (error) {
    console.error('Git commit diff error:', error);
    res.json({ error: error.message });
  }
});

// 使用 AI 根据暂存的更改生成提交消息
router.post('/generate-commit-message', async (req, res) => {
  const { project, files, provider = 'claude' } = req.body;

  if (!project || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name and files are required' });
  }

  // 验证提供者
  if (!['claude', 'cursor'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be "claude" or "cursor"' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    // 获取选定文件的 diff
    let diffContext = '';
    for (const file of files) {
      try {
        const { stdout } = await execAsync(
          `git diff HEAD -- "${file}"`,
          { cwd: projectPath }
        );
        if (stdout) {
          diffContext += `\n--- ${file} ---\n${stdout}`;
        }
      } catch (error) {
        console.error(`Error getting diff for ${file}:`, error);
      }
    }

    // 如果没有找到 diff，可能是未跟踪的文件
    if (!diffContext.trim()) {
      // 尝试获取未跟踪文件的内容
      for (const file of files) {
        try {
          const filePath = path.join(projectPath, file);
          const stats = await fs.stat(filePath);

          if (!stats.isDirectory()) {
            const content = await fs.readFile(filePath, 'utf-8');
            diffContext += `\n--- ${file} (new file) ---\n${content.substring(0, 1000)}\n`;
          } else {
            diffContext += `\n--- ${file} (new directory) ---\n`;
          }
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }

    // 使用 AI 生成提交消息
    const message = await generateCommitMessageWithAI(files, diffContext, provider, projectPath);

    res.json({ message });
  } catch (error) {
    console.error('Generate commit message error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 使用 AI（Claude SDK 或 Cursor CLI）生成提交消息
 * @param {Array<string>} files - 已更改文件的列表
 * @param {string} diffContext - Git diff 内容
 * @param {string} provider - 'claude' 或 'cursor'
 * @param {string} projectPath - 项目目录路径
 * @returns {Promise<string>} 生成的提交消息
 */
async function generateCommitMessageWithAI(files, diffContext, provider, projectPath) {
  // 创建提示
  const prompt = `Generate a conventional commit message for these changes.

REQUIREMENTS:
- Format: type(scope): subject
- Include body explaining what changed and why
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Subject under 50 chars, body wrapped at 72 chars
- Focus on user-facing changes, not implementation details
- Consider what's being added AND removed
- Return ONLY the commit message (no markdown, explanations, or code blocks)

FILES CHANGED:
${files.map(f => `- ${f}`).join('\n')}

DIFFS:
${diffContext.substring(0, 4000)}

Generate the commit message:`;

  try {
    // 创建一个简单的写入器来收集响应
    let responseText = '';
    const writer = {
      send: (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          console.log('🔍 Writer received message type:', parsed.type);

          // 处理来自 Claude SDK 和 Cursor CLI 的不同消息格式
          // Claude SDK 发送: {type: 'claude-response', data: {message: {content: [...]}}}
          if (parsed.type === 'claude-response' && parsed.data) {
            const message = parsed.data.message || parsed.data;
            console.log('📦 Claude response message:', JSON.stringify(message, null, 2).substring(0, 500));
            if (message.content && Array.isArray(message.content)) {
              // 从内容数组中提取文本
              for (const item of message.content) {
                if (item.type === 'text' && item.text) {
                  console.log('✅ Extracted text chunk:', item.text.substring(0, 100));
                  responseText += item.text;
                }
              }
            }
          }
          // Cursor CLI 发送: {type: 'cursor-output', output: '...'}
          else if (parsed.type === 'cursor-output' && parsed.output) {
            console.log('✅ Cursor output:', parsed.output.substring(0, 100));
            responseText += parsed.output;
          }
          // 同时处理直接文本消息
          else if (parsed.type === 'text' && parsed.text) {
            console.log('✅ Direct text:', parsed.text.substring(0, 100));
            responseText += parsed.text;
          }
        } catch (e) {
          // 忽略解析错误
          console.error('Error parsing writer data:', e);
        }
      },
      setSessionId: () => {}, // 此用例的无操作
    };

    console.log('🚀 Calling AI agent with provider:', provider);
    console.log('📝 Prompt length:', prompt.length);

    // 调用相应的代理
    if (provider === 'claude') {
      await queryClaudeSDK(prompt, {
        cwd: projectPath,
        permissionMode: 'bypassPermissions',
        model: 'sonnet'
      }, writer);
    } else if (provider === 'cursor') {
      await spawnCursor(prompt, {
        cwd: projectPath,
        skipPermissions: true
      }, writer);
    }

    console.log('📊 Total response text collected:', responseText.length, 'characters');
    console.log('📄 Response preview:', responseText.substring(0, 200));

    // 清理响应
    const cleanedMessage = cleanCommitMessage(responseText);
    console.log('🧹 Cleaned message:', cleanedMessage.substring(0, 200));

    return cleanedMessage || 'chore: update files';
  } catch (error) {
    console.error('Error generating commit message with AI:', error);
    // 回退到简单消息
    return `chore: update ${files.length} file${files.length !== 1 ? 's' : ''}`;
  }
}

/**
 * 清理 AI 生成的提交消息，删除 markdown、代码块和额外格式
 * @param {string} text - 原始 AI 响应
 * @returns {string} 清理后的提交消息
 */
function cleanCommitMessage(text) {
  if (!text || !text.trim()) {
    return '';
  }

  let cleaned = text.trim();

  // 删除 markdown 代码块
  cleaned = cleaned.replace(/```[a-z]*\n/g, '');
  cleaned = cleaned.replace(/```/g, '');

  // 删除 markdown 标题
  cleaned = cleaned.replace(/^#+\s*/gm, '');

  // 删除前导/尾随引号
  cleaned = cleaned.replace(/^["']|["']$/g, '');

  // 如果有多行，则取所有内容（主题 + 正文）
  // 只需清理多余的空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 删除实际提交消息之前的任何解释性文本
  // 查找约定提交模式并从那里开始
  const conventionalCommitMatch = cleaned.match(/(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+?\))?:.+/s);
  if (conventionalCommitMatch) {
    cleaned = cleaned.substring(cleaned.indexOf(conventionalCommitMatch[0]));
  }

  return cleaned.trim();
}

// 获取远程状态（使用智能远程检测的提前/落后提交）
router.get('/remote-status', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 获取当前分支
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const branch = currentBranch.trim();

    // 检查是否存在远程跟踪分支（智能检测）
    let trackingBranch;
    let remoteName;
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
      trackingBranch = stdout.trim();
      remoteName = trackingBranch.split('/')[0]; // 提取远程名称（例如，"origin/main" -> "origin"）
    } catch (error) {
      // 未配置上游分支 - 但检查我们是否有远程
      let hasRemote = false;
      let remoteName = null;
      try {
        const { stdout } = await execAsync('git remote', { cwd: projectPath });
        const remotes = stdout.trim().split('\n').filter(r => r.trim());
        if (remotes.length > 0) {
          hasRemote = true;
          remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
        }
      } catch (remoteError) {
        // 未配置远程
      }

      return res.json({ 
        hasRemote,
        hasUpstream: false,
        branch,
        remoteName,
        message: 'No remote tracking branch configured'
      });
    }

    // 获取提前/落后计数
    const { stdout: countOutput } = await execAsync(
      `git rev-list --count --left-right ${trackingBranch}...HEAD`,
      { cwd: projectPath }
    );
    
    const [behind, ahead] = countOutput.trim().split('\t').map(Number);

    res.json({
      hasRemote: true,
      hasUpstream: true,
      branch,
      remoteBranch: trackingBranch,
      remoteName,
      ahead: ahead || 0,
      behind: behind || 0,
      isUpToDate: ahead === 0 && behind === 0
    });
  } catch (error) {
    console.error('Git remote status error:', error);
    res.json({ error: error.message });
  }
});

// 从远程获取（使用智能远程检测）
router.post('/fetch', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 获取当前分支及其上游远程
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // 回退
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
      remoteName = stdout.trim().split('/')[0]; // 提取远程名称
    } catch (error) {
      // 没有上游，尝试从 origin 获取
      console.log('No upstream configured, using origin as fallback');
    }

    const { stdout } = await execAsync(`git fetch ${remoteName}`, { cwd: projectPath });
    
    res.json({ success: true, output: stdout || 'Fetch completed successfully', remoteName });
  } catch (error) {
    console.error('Git fetch error:', error);
    res.status(500).json({ 
      error: 'Fetch failed', 
      details: error.message.includes('Could not resolve hostname') 
        ? 'Unable to connect to remote repository. Check your internet connection.'
        : error.message.includes('fatal: \'origin\' does not appear to be a git repository')
        ? 'No remote repository configured. Add a remote with: git remote add origin <url>'
        : error.message
    });
  }
});

// 从远程拉取（fetch + merge，使用智能远程检测）
router.post('/pull', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 获取当前分支及其上游远程
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // 回退
    let remoteBranch = branch; // 回退
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
      const tracking = stdout.trim();
      remoteName = tracking.split('/')[0]; // 提取远程名称
      remoteBranch = tracking.split('/').slice(1).join('/'); // 提取分支名称
    } catch (error) {
      // 没有上游，使用回退
      console.log('No upstream configured, using origin/branch as fallback');
    }

    const { stdout } = await execAsync(`git pull ${remoteName} ${remoteBranch}`, { cwd: projectPath });
    
    res.json({ 
      success: true, 
      output: stdout || 'Pull completed successfully', 
      remoteName,
      remoteBranch
    });
  } catch (error) {
    console.error('Git pull error:', error);

    // 针对常见拉取场景的增强错误处理
    let errorMessage = 'Pull failed';
    let details = error.message;
    
    if (error.message.includes('CONFLICT')) {
      errorMessage = 'Merge conflicts detected';
      details = 'Pull created merge conflicts. Please resolve conflicts manually in the editor, then commit the changes.';
    } else if (error.message.includes('Please commit your changes or stash them')) {
      errorMessage = 'Uncommitted changes detected';  
      details = 'Please commit or stash your local changes before pulling.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
    } else if (error.message.includes('diverged')) {
      errorMessage = 'Branches have diverged';
      details = 'Your local branch and remote branch have diverged. Consider fetching first to review changes.';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// 推送提交到远程仓库
router.post('/push', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 获取当前分支及其上游远程
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // 回退
    let remoteBranch = branch; // 回退
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
      const tracking = stdout.trim();
      remoteName = tracking.split('/')[0]; // 提取远程名称
      remoteBranch = tracking.split('/').slice(1).join('/'); // 提取分支名称
    } catch (error) {
      // 没有上游，使用回退
      console.log('No upstream configured, using origin/branch as fallback');
    }

    const { stdout } = await execAsync(`git push ${remoteName} ${remoteBranch}`, { cwd: projectPath });
    
    res.json({ 
      success: true, 
      output: stdout || 'Push completed successfully', 
      remoteName,
      remoteBranch
    });
  } catch (error) {
    console.error('Git push error:', error);

    // 针对常见推送场景的增强错误处理
    let errorMessage = 'Push failed';
    let details = error.message;
    
    if (error.message.includes('rejected')) {
      errorMessage = 'Push rejected';
      details = 'The remote has newer commits. Pull first to merge changes before pushing.';
    } else if (error.message.includes('non-fast-forward')) {
      errorMessage = 'Non-fast-forward push';
      details = 'Your branch is behind the remote. Pull the latest changes first.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
    } else if (error.message.includes('Permission denied')) {
      errorMessage = 'Authentication failed';
      details = 'Permission denied. Check your credentials or SSH keys.';
    } else if (error.message.includes('no upstream branch')) {
      errorMessage = 'No upstream branch';
      details = 'No upstream branch configured. Use: git push --set-upstream origin <branch>';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// 发布分支到远程（设置上游并推送）
router.post('/publish', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 获取当前分支以验证它是否与请求的分支匹配
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const currentBranchName = currentBranch.trim();

    if (currentBranchName !== branch) {
      return res.status(400).json({
        error: `Branch mismatch. Current branch is ${currentBranchName}, but trying to publish ${branch}`
      });
    }

    // 检查远程是否存在
    let remoteName = 'origin';
    try {
      const { stdout } = await execAsync('git remote', { cwd: projectPath });
      const remotes = stdout.trim().split('\n').filter(r => r.trim());
      if (remotes.length === 0) {
        return res.status(400).json({
          error: 'No remote repository configured. Add a remote with: git remote add origin <url>'
        });
      }
      remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
    } catch (error) {
      return res.status(400).json({
        error: 'No remote repository configured. Add a remote with: git remote add origin <url>'
      });
    }

    // 发布分支（设置上游并推送）
    const { stdout } = await execAsync(`git push --set-upstream ${remoteName} ${branch}`, { cwd: projectPath });
    
    res.json({ 
      success: true, 
      output: stdout || 'Branch published successfully', 
      remoteName,
      branch
    });
  } catch (error) {
    console.error('Git publish error:', error);

    // 针对常见发布场景的增强错误处理
    let errorMessage = 'Publish failed';
    let details = error.message;
    
    if (error.message.includes('rejected')) {
      errorMessage = 'Publish rejected';
      details = 'The remote branch already exists and has different commits. Use push instead.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('Permission denied')) {
      errorMessage = 'Authentication failed';
      details = 'Permission denied. Check your credentials or SSH keys.';
    } else if (error.message.includes('fatal:') && error.message.includes('does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'Remote repository not properly configured. Check your remote URL.';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// 丢弃特定文件的更改
router.post('/discard', async (req, res) => {
  const { project, file } = req.body;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 检查文件状态以确定正确的丢弃命令
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    
    if (!statusOutput.trim()) {
      return res.status(400).json({ error: 'No changes to discard for this file' });
    }

    const status = statusOutput.substring(0, 2);

    if (status === '??') {
      // 未跟踪的文件或目录 - 删除它
      const filePath = path.join(projectPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    } else if (status.includes('M') || status.includes('D')) {
      // 已修改或已删除的文件 - 从 HEAD 恢复
      await execAsync(`git restore "${file}"`, { cwd: projectPath });
    } else if (status.includes('A')) {
      // 已添加的文件 - 取消暂存
      await execAsync(`git reset HEAD "${file}"`, { cwd: projectPath });
    }
    
    res.json({ success: true, message: `Changes discarded for ${file}` });
  } catch (error) {
    console.error('Git discard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除未跟踪的文件
router.post('/delete-untracked', async (req, res) => {
  const { project, file } = req.body;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    await validateGitRepository(projectPath);

    // 检查文件是否确实未跟踪
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    
    if (!statusOutput.trim()) {
      return res.status(400).json({ error: 'File is not untracked or does not exist' });
    }

    const status = statusOutput.substring(0, 2);

    if (status !== '??') {
      return res.status(400).json({ error: 'File is not untracked. Use discard for tracked files.' });
    }

    // 删除未跟踪的文件或目录
    const filePath = path.join(projectPath, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      // 使用带有递归选项的 rm 删除目录
      await fs.rm(filePath, { recursive: true, force: true });
      res.json({ success: true, message: `Untracked directory ${file} deleted successfully` });
    } else {
      await fs.unlink(filePath);
      res.json({ success: true, message: `Untracked file ${file} deleted successfully` });
    }
  } catch (error) {
    console.error('Git delete untracked error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;