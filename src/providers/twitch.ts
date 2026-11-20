import type { GetJson } from './types';

const GQL = 'https://gql.twitch.tv/gql';
// Public client id of the Twitch website. Needed for its GQL endpoint; no user token is sent.
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

interface UserResponse {
  data?: { user?: { id?: string } | null };
}

export async function fetchTwitchId(getJson: GetJson, login: string): Promise<string | null> {
  const res = (await getJson(GQL, {
    method: 'POST',
    headers: { 'Client-ID': CLIENT_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'query($login: String!) { user(login: $login) { id } }',
      variables: { login },
    }),
  })) as UserResponse | null;
  return res?.data?.user?.id ?? null;
}
