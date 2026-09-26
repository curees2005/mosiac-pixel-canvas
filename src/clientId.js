// A stable anonymous id per browser, used only to enforce the placement
// cooldown server-side (see netlify/functions/place-pixel.js). No account needed.
const KEY = "mosaic-client-id";

export function getClientId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
