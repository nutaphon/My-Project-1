// ─────────────────────────────────────────────────────────────
//  Supabase connection (optional)
//  Leave empty  → "local mode": data stays in this browser only.
//  Fill both in → "cloud mode": synced between both phones + slip uploads.
//  The anon key is safe to publish; access is protected by Row Level Security
//  (see supabase/schema.sql). NEVER put the service_role key here.
// ─────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: 'sb_publishable_9ikBTNQqVKc4AGp7msumvA_p8hJG7qo',  // publishable key (safe to publish)
};
