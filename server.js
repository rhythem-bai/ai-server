import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';

dotenv.config();

// 1. 先创建 app 和配置中间件
const app = express();
app.use(cors());
app.use(express.json());

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;

// 2. 新增接口：保存消息到数据库
app.post('/api/messages', async (req, res) => {
  const { conversation_id, content, role, user_id } = req.body

  const { data, error } = await supabase.from('messages').insert({
    conversation_id,
    content,
    role,
    user_id: user_id || '00000000-0000-0000-0000-000000000000'
  })

  if (error) {
    console.error('❌ 写入数据库失败:', error.message) 
    return res.status(500).json({ error: error.message })
  }
  
  res.json({ success: true, data })
})
// 3. 新增接口：获取历史会话列表
app.get('/api/conversations', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, content, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const map = new Map()
  data.forEach(msg => {
    if (!map.has(msg.conversation_id)) {
      map.set(msg.conversation_id, {
        id: msg.conversation_id,
        title: msg.content.slice(0, 20) + (msg.content.length > 20 ? '...' : ''),
        updated_at: msg.created_at
      })
    }
  })
  
  res.json(Array.from(map.values()))
})

// 4. 原有的 DeepSeek 接口
app.post('/api/chat', async (req, res) => {
  const { messages, thinking = false, model = 'deepseek-chat' } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const requestBody = {
    model: thinking ? 'deepseek-reasoner' : model,
    messages: messages,
    stream: true,
    temperature: 1.0,
    max_tokens: 4096,
  };

  if (thinking) {
    requestBody.reasoning_effort = 'high';
    requestBody.extra_body = { thinking: { type: 'enabled' } };
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API 错误:', errText);
      res.write(`data: ${JSON.stringify({ error: 'AI 服务暂不可用' })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (error) {
    console.error('代理请求失败:', error);
    res.write(`data: ${JSON.stringify({ error: '连接 AI 服务失败' })}\n\n`);
    res.end();
  }
});

// 5. 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`代理服务运行在 http://localhost:${PORT}`);
});

// 6. 删除接口
app.delete('/api/conversations/:id', async (req, res) => {
  const { id } = req.params
  // 从 messages 表里删除所有属于这个 conversation_id 的消息
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', id)

  if (error) {
    console.error('❌ 删除会话失败:', error.message)
    return res.status(500).json({ error: error.message })
  }
  res.json({ success: true })
})

// 7.获取某个会话的全部消息
app.get('/api/conversations/:id/messages', async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true }) // 按时间正序排列

  if (error) {
    console.error('❌ 获取会话消息失败:', error.message)
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})