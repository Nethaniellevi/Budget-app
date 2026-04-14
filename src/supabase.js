import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://welyzurxpaftfuewwlff.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Hq1E8xCOhy00kxTJD-vatQ_YVoYiMwf'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
