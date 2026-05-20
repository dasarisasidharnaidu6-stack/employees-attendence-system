import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nhsstvkiapymqvsmuarw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YnvKdlHxSauVaT6r6O5QsA_Fir6FrAI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
