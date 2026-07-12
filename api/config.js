// Returns the PUBLIC Supabase settings to the browser app.
// These two values are safe to expose (anon key is public by design).
// Set them as Environment Variables in Vercel: SUPABASE_URL, SUPABASE_ANON_KEY
module.exports = function handler(req, res) {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  });
};
