/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Google Drive PKCE & API Engine (Milestone 1.3)
 *
 * Implements the browser-native OAuth 2.0 PKCE flow and provides
 * low-level fetch wrappers for Drive appDataFolder operations.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Configuration ──────────────────────────────────────────────────────────

// Note: If you implement your own backend or offline refresh, you would use these URLs.
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

// Scopes required per Phase 0 design
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

// ── OAuth Engine ───────────────────────────────────────────────────────────

/**
 * Fetches the user's email address using the access token.
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{ email: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch user info');
  return res.json();
}

/**
 * Initiates the Google OAuth 2.0 GIS token client popup or silent refresh.
 */
export function initiateGoogleLogin(
  onSuccess: (data: { accessToken: string; email: string; expiresAt: number }) => void, 
  onError: (err: any) => void,
  silent: boolean = false
) {
  const clientId = import.meta.env.VITE_APP_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.error('[GoogleAuth] Google OAuth Client ID (VITE_APP_GOOGLE_CLIENT_ID) not configured.');
    return onError(new Error('Missing Client ID'));
  }

  try {
    console.log(`[GoogleAuth] Initializing Google Token Client Flow (silent: ${silent})`);
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: silent ? '' : 'select_account',
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error !== undefined) {
          console.error('[GoogleAuth] Token client error:', tokenResponse);
          onError(tokenResponse);
        } else {
          console.log('[GoogleAuth] Successfully received token');
          try {
            const userInfo = await getGoogleUserInfo(tokenResponse.access_token);
            const expiresAt = Date.now() + (Number(tokenResponse.expires_in) * 1000);
            onSuccess({
              accessToken: tokenResponse.access_token,
              email: userInfo.email,
              expiresAt
            });
          } catch (e) {
            console.error('[GoogleAuth] Failed to get user info', e);
            onError(e);
          }
        }
      },
    });
    
    if (silent) {
      client.requestAccessToken({ prompt: '' });
    } else {
      client.requestAccessToken();
    }
  } catch (err) {
    console.error('[GoogleAuth] Failed to initialize token client:', err);
    onError(err);
  }
}

// ── Drive appDataFolder API ────────────────────────────────────────────────

// ── Drive appDataFolder API ────────────────────────────────────────────────

/**
 * Creates or updates a directory-split JSON file in appDataFolder.
 * Enforces ETag-based optimistic locking.
 * 
 * @param accessToken Valid Google OAuth access token
 * @param filename File name, e.g., 'folder_<uuid>.json'
 * @param content JSON object payload
 * @param existingEtag Provide ETag for update to enforce optimistic locking. Provide null for initial creation.
 * @param existingFileId Drive file ID if updating.
 * @returns { fileId, etag }
 */
export async function writeAppDataFile(
  accessToken: string,
  filename: string,
  content: object,
  existingEtag: string | null = null,
  existingFileId: string | null = null
) {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    parents: existingFileId ? undefined : ['appDataFolder']
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(content) +
    close_delim;

  let url = `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name,md5Checksum,headRevisionId`;
  let method = 'POST';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': `multipart/related; boundary=${boundary}`,
  };

  if (existingFileId) {
    url = `${DRIVE_UPLOAD_URL}/files/${existingFileId}?uploadType=multipart&fields=id,name,md5Checksum,headRevisionId`;
    method = 'PATCH';
    if (existingEtag) {
      headers['If-Match'] = existingEtag;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: multipartRequestBody,
  });

  if (!response.ok) {
    if (response.status === 412) {
      throw new Error('ETag mismatch (Conflict) - Please refresh folder metadata.');
    }
    throw new Error(`Drive API Error: ${response.statusText}`);
  }

  // Get new ETag from the headRevisionId or response header if we want to parse it.
  // Google Drive REST V3 returns Etag in headers usually.
  const newEtag = response.headers.get('ETag');
  const result = await response.json();

  return {
    fileId: result.id,
    etag: newEtag || `"${result.headRevisionId}"`
  };
}

/**
 * Searches for a file in appDataFolder by name.
 */
export async function findAppDataFileByName(accessToken: string, filename: string): Promise<string | null> {
  const query = encodeURIComponent(`name='${filename}' and 'appDataFolder' in parents and trashed=false`);
  const url = `${DRIVE_API_URL}/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to search appDataFolder: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.files && result.files.length > 0) {
    return result.files[0].id;
  }
  
  return null;
}

/**
 * Reads a JSON file from appDataFolder.
 */
export async function readAppDataFile(accessToken: string, fileId: string) {
  const url = `${DRIVE_API_URL}/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to read Drive file: ${response.statusText}`);
  }

  const content = await response.json();
  const etag = response.headers.get('ETag');

  return { content, etag };
}
