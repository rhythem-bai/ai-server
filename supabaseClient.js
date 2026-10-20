import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 后端直接使用 Node.js 的 process.env，不需要 VITE_ 前缀
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)