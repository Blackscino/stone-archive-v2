import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kckwtorebqzrwpbbffqy.supabase.co',
  process.env.SUPABASE_SECRET_KEY
)

const { count, error } = await supabase
  .from('items')
  .select('id', { count:'exact', head:true })

console.log(JSON.stringify({ count, error }, null, 2))
