// SwanDesk AI sign-in (Google, Firebase project webswan-gigoia-task) and a small API helper shared by the pages.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
const app = initializeApp({ apiKey: "AIzaSyBxuPZnF8rSZPkmoeqNR_9PQtFUJNKU3JM", authDomain: location.hostname === "swandesk-ai.netlify.app" ? location.hostname : "webswan-gigoia-task.firebaseapp.com", projectId: "webswan-gigoia-task", appId: "1:970866236717:web:63ddb5c2557d083b8bc7a4" });
const auth = getAuth(app);
window.SD = {
  // Popup first; phones, in-app browsers and pop-up blockers get a full-page Google sign-in instead.
  async signIn() {
    const p = new GoogleAuthProvider();
    if (/Android|iPhone|iPad|iPod|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent)) return signInWithRedirect(auth, p);
    try { return await signInWithPopup(auth, p); }
    catch (e) {
      if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(String(e && e.code))) return signInWithRedirect(auth, p);
      throw e;
    }
  },
  signOut: () => signOut(auth),
  user: () => auth.currentUser,
  async api(fn, body) {
    const tok = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const r = await fetch("/.netlify/functions/" + fn, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong (" + r.status + ")");
    return j;
  }
};
getRedirectResult(auth).catch((e) => window.dispatchEvent(new CustomEvent("sd-auth-error", { detail: { message: e.message } })));
onAuthStateChanged(auth, (u) => window.dispatchEvent(new CustomEvent("sd-auth", { detail: { user: u } })));
