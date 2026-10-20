import { supabase } from './supabaseClient.js'

async function testConnection() {
  console.log('正在尝试连接 Supabase...')
  const { data, error } = await supabase.from('messages').select('*').limit(1)

  if (error) {
    console.error('❌ 连接失败:', error.message)
  } else {
    console.log('✅ 连接成功！目前 messages 表里的数据:', data)
  }
}
testConnection()