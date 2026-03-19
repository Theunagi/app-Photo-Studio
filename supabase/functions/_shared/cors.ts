// Allowed origins — includes localhost for development workflow
// (localhost:3000 frontend → remote Supabase Edge Functions)
// CORS is not a security boundary — real auth is via JWT verification.
const ALLOWED_ORIGINS = [
  // Production
  'https://frameflow.design',
  'https://www.frameflow.design',
  'https://lbyayuonwesmxvzvvavx.supabase.co',
  // Development (frontend on localhost → remote Supabase)
  'http://localhost:3000',
  'http://localhost:5173',
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  return null;
}
