import { useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { SocialRow } from './auth-ui';

// Sign in with Google, from the app's side.
//
// The app never sees a password. It asks Google for an ID token and
// hands that to our API, which verifies the signature and the audience
// before it will believe a word of it. All this file does is fetch the
// token.
//
// The client ids come from app.json rather than being hardcoded. Google
// issues a different one per platform and they are not secrets — they
// are public identifiers, and the security comes from the backend
// checking that a token's audience is one of them.
//
// **Why this is a component and not a hook.**
// useIdTokenAuthRequest throws the moment it is called with no client
// id — not on press, on render. Calling it from the screen took the
// whole sign-in page down with a blank white screen whenever the ids
// were missing, which is precisely the state this app ships in until
// somebody creates them in Google Cloud Console. Keeping the hook
// inside a component that is only mounted when there is an id to give
// it means the unconfigured case renders a button that explains
// itself, instead of nothing at all.

WebBrowser.maybeCompleteAuthSession();

const IDS = Constants.expoConfig?.extra?.googleClientIds ?? {};

export const isGoogleConfigured = Boolean(
  Platform.select({ web: IDS.web, android: IDS.android, ios: IDS.ios, default: IDS.web })
);

function ConfiguredGoogleButton({ onToken, onError }) {
  const [busy, setBusy] = useState(false);

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: IDS.web || undefined,
    androidClientId: IDS.android || undefined,
    iosClientId: IDS.ios || undefined,
    webClientId: IDS.web || undefined,
  });

  async function press() {
    setBusy(true);
    try {
      const result = await promptAsync();

      // Backing out is not an error and gets no message.
      if (result?.type === 'dismiss' || result?.type === 'cancel') return;

      if (result?.type !== 'success') {
        onError('Google haikukamilisha kuingia. Jaribu tena.');
        return;
      }

      const idToken = result.params?.id_token ?? result.authentication?.idToken;
      if (!idToken) {
        onError('Google haikutoa kitambulisho. Jaribu tena.');
        return;
      }

      await onToken(idToken);
    } finally {
      setBusy(false);
    }
  }

  return <SocialRow onPress={press} busy={busy} />;
}

export function GoogleButton({ onToken, onError }) {
  if (!isGoogleConfigured) {
    return (
      <SocialRow
        onPress={() =>
          onError('Kuingia kwa Google hakujawekwa bado. Tumia namba yako ya simu.')
        }
      />
    );
  }

  return <ConfiguredGoogleButton onToken={onToken} onError={onError} />;
}
