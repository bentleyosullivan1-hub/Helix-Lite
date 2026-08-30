/* HelixAuth — shared across login.html, settings.html, ideas.html, admin.html.
   Requires the Supabase CDN script to be loaded first:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
*/
const HELIX_SUPABASE_URL = "https://biqoeaxxzegfvlxopazd.supabase.co";
const HELIX_SUPABASE_KEY = "sb_publishable_U9ZX17upjBz5nZ47rpwpNQ_Ve2xu-gg";

window.HelixAuth = (function () {
  let client = null;

  function getClient() {
    if (!client) {
      client = window.supabase.createClient(HELIX_SUPABASE_URL, HELIX_SUPABASE_KEY);
    }
    return client;
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) {
      console.error(error);
      return null;
    }
    return data.session || null;
  }

  // Returns null if signed out, otherwise { id, email, premium, role, accent }
  async function getProfile() {
    const session = await getSession();
    if (!session) return null;

    const { data, error } = await getClient()
      .from("profiles")
      .select("id, email, premium, role, accent")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error(error);
      return { id: session.user.id, email: session.user.email, premium: false, role: "user", accent: "cyan" };
    }
    return data;
  }

  function isAdmin(profile) {
    return !!profile && profile.role === "admin";
  }

  function isPremium(profile) {
    return !!profile && (profile.premium || profile.role === "admin");
  }

  // Renders a small badge into `el` based on the profile. Pass an empty
  // profile (null) to clear it.
  function renderBadge(el, profile) {
    if (!el) return;
    if (isAdmin(profile)) {
      el.innerHTML = '<span class="helix-badge helix-badge-admin">ADMIN</span>';
    } else if (isPremium(profile)) {
      el.innerHTML = '<span class="helix-badge helix-badge-premium">★ PREMIUM</span>';
    } else {
      el.innerHTML = "";
    }
  }

  return { getClient, getSession, getProfile, isAdmin, isPremium, renderBadge };
})();
