import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, type Auth } from "firebase/auth";

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
