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

function webStore() {
  // Private mode and blocked site data both make this throw or return
  // null, so every caller has to survive an empty answer.
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  if (isWeb) {
    try {
      webStore()?.setItem(key, value);
    } catch {
      // Nothing to store into. The session lasts as long as the page.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key) {
  if (isWeb) {
    try {
      return webStore()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteItem(key) {
  if (isWeb) {
    try {
      webStore()?.removeItem(key);
    } catch {
      // Already gone, or never storable.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
