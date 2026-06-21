import { supabase } from './supabaseClient.js'

let currentSession = null

export function setSession(s) {
  currentSession = s
}
export function getSession() {
  return currentSession
}
export function getUser() {
  return currentSession?.user ?? null
}

export async function loadSession() {
  const { data } = await supabase.auth.getSession()
  currentSession = data.session
  return currentSession
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session
    cb(session)
  })
}
