import { useEffect, useState } from "react";

const AUTH_KEY = "cbd.auth";
const SESSION_KEY = "cbd.session";

interface AuthRecord {
  username: string;
  passwordHash: string;
  criadoEm: string;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getAuthRecord(): AuthRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY);
  return raw ? (JSON.parse(raw) as AuthRecord) : null;
}

export async function registerUser(username: string, password: string) {
  const rec: AuthRecord = {
    username: username.trim(),
    passwordHash: await sha256(password),
    criadoEm: new Date().toISOString(),
  };
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(rec));
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.dispatchEvent(new Event("cbd-auth-change"));
}

export async function login(username: string, password: string): Promise<boolean> {
  const rec = getAuthRecord();
  if (!rec) return false;
  const hash = await sha256(password);
  if (rec.username === username.trim() && rec.passwordHash === hash) {
    window.sessionStorage.setItem(SESSION_KEY, "1");
    window.dispatchEvent(new Event("cbd-auth-change"));
    return true;
  }
  return false;
}

export function logout() {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("cbd-auth-change"));
}

export function resetAccount() {
  window.localStorage.removeItem(AUTH_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("cbd-auth-change"));
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function useAuth() {
  const [state, setState] = useState(() => ({
    hasAccount: !!getAuthRecord(),
    loggedIn: isLoggedIn(),
  }));
  useEffect(() => {
    const update = () =>
      setState({ hasAccount: !!getAuthRecord(), loggedIn: isLoggedIn() });
    window.addEventListener("cbd-auth-change", update);
    update();
    return () => window.removeEventListener("cbd-auth-change", update);
  }, []);
  return state;
}
