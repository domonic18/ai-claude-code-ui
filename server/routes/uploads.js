/**
 * 上传路由
 *
 * 处理文件上传端点，包括音频转录
 * 和图片上传。
 *
 * 路由：
 * - POST /api/transcribe - 将音频转录为文本
 * - POST /api/projects/:projectName/upload-images - 上传图片
 */

import express from 'express';
import path from 'path';
import os from 'os';

const router = express.Router();

/**
 * POST /api/transcribe
 * 使用 OpenAI Whisper API 将音频文件转录为文本
 */
router.post('/transcribe', async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage() });

    // 处理多部分表单数据
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to process audio file' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in server environment.'
        });
      }

      try {
        // 为 OpenAI 创建表单数据
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        formData.append('language', 'en');

        // 向 OpenAI 发出请求
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
        }

        const data = await response.json();
        let transcribedText = data.text || '';

        // 检查是否启用了增强模式
        const mode = req.body.mode || 'default';

        // 如果没有转录文本，返回空
        if (!transcribedText) {
          return res.json({ text: '' });
        }

        // 如果是默认模式，返回未增强的转录文本
        if (mode === 'default') {
          return res.json({ text: transcribedText });
        }

        // 处理不同的增强模式
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey });

          let prompt, systemMessage, temperature = 0.7, maxTokens = 800;

          switch (mode) {
            case 'prompt':
              systemMessage = 'You are an expert prompt engineer who creates clear, detailed, and effective prompts.';
              prompt = `You are an expert prompt engineer. Transform the following rough instruction into a clear, detailed, and context-aware AI prompt.

Your enhanced prompt should:
1. Be specific and unambiguous
2. Include relevant context and constraints
3. Specify the desired output format
4. Use clear, actionable language
5. Include examples where helpful
6. Consider edge cases and potential ambiguities

Transform this rough instruction into a well-crafted prompt:
"${transcribedText}"

Enhanced prompt:`;
              break;

            case 'vibe':
            case 'instructions':
            case 'architect':
              systemMessage = 'You are a helpful assistant that formats ideas into clear, actionable instructions for AI agents.';
              temperature = 0.5; // 降低温度以获得更受控的输出
              prompt = `Transform the following idea into clear, well-structured instructions that an AI agent can easily understand and execute.

IMPORTANT RULES:
- Format as clear, step-by-step instructions
- Add reasonable implementation details based on common patterns
- Only include details directly related to what was asked
- Do NOT add features or functionality not mentioned
- Keep the original intent and scope intact
- Use clear, actionable language an agent can follow

Transform this idea into agent-friendly instructions:
"${transcribedText}"

Agent instructions:`;
              break;

            default:
              // 无需增强
              break;
          }

          // 仅在有提示时调用 GPT
          if (prompt) {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
              ],
              temperature: temperature,
              max_tokens: maxTokens
            });

            transcribedText = completion.choices[0].message.content || transcribedText;
          }

        } catch (gptError) {
          console.error('GPT processing error:', gptError);
          // 如果 GPT 失败，回退到原始转录
        }

        res.json({ text: transcribedText });

      } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/projects/:projectName/upload-images
 * 上传图片文件并将其作为 base64 数据 URL 返回
 */
router.post('/:projectName/upload-images', async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).promises;
    const os = (await import('os')).default;

    // 为图片上传配置 multer
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'claude-ui-uploads', String(req.user.userId));
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
      }
    };

    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5
      }
    });

    // 处理多部分表单数据
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      try {
        // 处理上传的图片
        const processedImages = await Promise.all(
          req.files.map(async (file) => {
            // 读取文件并转换为 base64
            const buffer = await fs.readFile(file.path);
            const base64 = buffer.toString('base64');
            const mimeType = file.mimetype;

            // 立即清理临时文件
            await fs.unlink(file.path);

            return {
              name: file.originalname,
              data: `data:${mimeType};base64,${base64}`,
              size: file.size,
              mimeType: mimeType
            };
          })
        );

        res.json({ images: processedImages });
      } catch (error) {
        console.error('Error processing images:', error);
        // 清理剩余的文件
        await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => { })));
        res.status(500).json({ error: 'Failed to process images' });
      }
    });
  } catch (error) {
    console.error('Error in image upload endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
