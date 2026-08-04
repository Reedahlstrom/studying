/* The default block list, shared by the service worker and the options page.
   Subdomains are matched automatically, so `facebook.com` also covers
   `m.facebook.com` — but a *different* domain the same company owns does not,
   which is why the aliases below are listed out. */
export const DEFAULT_SITES = [
  // video / streaming
  'youtube.com',
  'netflix.com',
  'twitch.tv',
  'hulu.com',
  'disneyplus.com',
  'primevideo.com',

  // social
  'instagram.com',
  'tiktok.com',
  'reddit.com',

  // Meta
  'facebook.com',
  'fb.com',        // redirects to facebook.com
  'fb.watch',      // video share links
  'messenger.com', // separate domain, not a facebook.com subdomain

  // X / Twitter
  'x.com',
  'twitter.com',   // still resolves and redirects
  't.co',          // link shortener — how most X links are actually opened
];
