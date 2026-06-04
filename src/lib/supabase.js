import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kckwtorebqzrwpbbffqy.supabase.co'

const supabaseKey =
'sb_publishable_p8iGYX9Q9gOpvpdLsmUtDw_YOcAiiqJ'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)
