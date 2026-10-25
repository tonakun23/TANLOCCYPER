import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, GoogleAuthProvider, type Auth } from "firebase/auth";

export type FirebaseConfig = { apiKey: string; authDomain: string; projectId: string; storageBucket?: string; messagingSenderId?: string; appId: string };
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
function getFirebaseAuth(config: FirebaseConfig): Auth {
  if (!app) app = initializeApp(config);
  if (!auth) auth = getAuth(app);
  return auth;
}
export async function signInGoogleFirebase(config: FirebaseConfig): Promise<{ name: string; email: string; avatar: string | null; idToken: string }> {
  const a = getFirebaseAuth(config);
  const result = await signInWithPopup(a, new GoogleAuthProvider());
  const idToken = await result.user.getIdToken();
  return { name: result.user.displayName || result.user.email || "Bạn", email: result.user.email || "", avatar: result.user.photoURL, idToken };
}
export async function signOutFirebase(): Promise<void> { if (auth) await signOut(auth); }

export async function signInGoogleRedirect(config: FirebaseConfig): Promise<void> {
  const a = getFirebaseAuth(config);
  await signInWithRedirect(a, new GoogleAuthProvider());
}
export async function handleGoogleRedirect(config: FirebaseConfig): Promise<{ name: string; email: string; avatar: string | null; idToken: string } | null> {
  const a = getFirebaseAuth(config);
  const result = await getRedirectResult(a);
  if (!result) return null;
  const idToken = await result.user.getIdToken();
  return { name: result.user.displayName || result.user.email || "Bạn", email: result.user.email || "", avatar: result.user.photoURL, idToken };
}

export function watchFirebaseUser(config: FirebaseConfig, cb: (u: { name: string; email: string; avatar: string | null; idToken: string } | null) => void): () => void {
  const a = getFirebaseAuth(config);
  return onAuthStateChanged(a, async (user) => {
    if (!user) { cb(null); return; }
    try { cb({ name: user.displayName || user.email || "Bạn", email: user.email || "", avatar: user.photoURL, idToken: await user.getIdToken() }); } catch { /* bỏ qua */ }
  });
}
