// Shared sign-in for command-line scripts (board, work log import). Signs in as
// the owner, so Row Level Security applies exactly as in the app.
//
// Credentials: LULA_EMAIL and LULA_PASSWORD in .env.local (gitignored). The
// session is cached in .board-session.local so later runs don't sign in again.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env');
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const SESSION_FILE = '.board-session.local';
const fileStore = {
  getItem: (key: string) => {
    if (!existsSync(SESSION_FILE)) return null;
    return (JSON.parse(readFileSync(SESSION_FILE, 'utf8')) as Record<string, string>)[key] ?? null;
  },
  setItem: (key: string, value: string) => {
    const all = existsSync(SESSION_FILE) ? JSON.parse(readFileSync(SESSION_FILE, 'utf8')) : {};
    writeFileSync(SESSION_FILE, JSON.stringify({ ...all, [key]: value }));
  },
  removeItem: (key: string) => {
    if (!existsSync(SESSION_FILE)) return;
    const all = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
    delete all[key];
    writeFileSync(SESSION_FILE, JSON.stringify(all));
  },
};

export const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { storage: fileStore, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Thrown by fail(): printed without a stack trace. */
class Failure extends Error {}

// Exiting from inside fail() while a request is still closing crashes Node on
// Windows (a libuv assertion, exit code 127), so fail() throws and this exits.
process.on('uncaughtException', (e) => {
  console.error(e instanceof Failure ? e.message : e);
  process.exitCode = 1;
});

/** Stop with a message and exit code 1. Not for use inside a try that would catch it. */
export function fail(message: string): never {
  throw new Failure(message);
}

/** Uses the cached session, or signs in with the credentials from .env.local. Returns the user id. */
export async function signIn(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const email = process.env.LULA_EMAIL;
  const password = process.env.LULA_PASSWORD;
  if (!email || !password) fail('Add LULA_EMAIL and LULA_PASSWORD to .env.local, then try again.');
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !signedIn.user) fail(`Sign-in failed: ${error?.message ?? 'no user'}`);
  return signedIn.user.id;
}
