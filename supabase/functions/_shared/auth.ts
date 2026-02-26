import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function verifyAuth(req: Request): Promise<{ userId: string; email?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Invalid auth token');

  return { userId: user.id, email: user.email };
}
