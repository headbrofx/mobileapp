import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Where the tokens live, which is not the same place on every platform.
//
// On a phone that is SecureStore — the Android Keystore or the iOS
// keychain. A refresh token is a key to somebody's health records and
// it has no business sitting in plain text.
//
// A browser has no keychain. Every option there — localStorage,
// sessionStorage, a cookie readable by script — is plain text that any
// injected script on the page can read. There is no secure choice to
// make, only a less exposed one, so the web build uses sessionStorage:
// the token is gone the moment the tab closes, rather than waiting on
// the disk for the next person who opens the browser. The cost is
// logging in again after closing the tab, which is the right trade for
// a browser and the wrong one for a phone.
//
// This is worth saying out loud rather than hiding behind an
// abstraction: the web build is the weaker of the two, and that is a
// property of browsers, not of this code.

const isWeb = Platform.OS === 'web';

// Two web stores, and which one is used is the point.
//
// sessionStorage is gone when the tab closes; localStorage is not.
// Everything defaulted to sessionStorage, which made the web build the
// safer of the two — and quietly made "Nikumbuke" on the login screen
// a lie. The box was ticked by default, it passed `remember` all the
// way down to saveTokens, saveTokens stored the refresh token, and
// then the tab closed and took it with it. Nothing remembered anybody.
//
// So `persist` is now a choice a caller makes, once, for the one value
// that has any business outliving a tab.
//
// Private mode and blocked site data make either of these throw or
// return null, so every caller still has to survive an empty answer.
function sessionStore() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function persistentStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function setItem(key, value, { persist = false } = {}) {
  if (isWeb) {
    try {
      // Written to one store and removed from the other, so the same
      // key can never sit in both holding different values — which is
      // how somebody ends up signed in as who they were last week.
      const chosen = persist ? persistentStore() : sessionStore();
      const other = persist ? sessionStore() : persistentStore();
      chosen?.setItem(key, value);
      other?.removeItem(key);
    } catch {
      // Nothing to store into. The session lasts as long as the page.
    }
    return;
  }
  // On a phone SecureStore is already persistent and already the
  // keychain, so `persist` has nothing to decide.
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key) {
  if (isWeb) {
    try {
      // The tab's own store first: if both somehow hold this key, the
      // newer session wins over whatever was left on disk.
      return sessionStore()?.getItem(key) ?? persistentStore()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteItem(key) {
  if (isWeb) {
    try {
      // Both, always. Signing out has to mean signing out, and leaving
      // a copy on disk because it was written by a different code path
      // is exactly the bug somebody discovers on a shared laptop.
      sessionStore()?.removeItem(key);
      persistentStore()?.removeItem(key);
    } catch {
      // Already gone, or never storable.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
