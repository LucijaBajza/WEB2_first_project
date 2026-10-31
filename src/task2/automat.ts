import { writeFile } from "node:fs/promises";
import { Buffer } from "buffer";

// dohvat tokena s auth0
export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const tokenUrl = new URL("/oauth/token", authority).toString();

  // slanje post zahtjeva za dohvat tokena
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: audience,
      scope: scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching token. Status: ${response.status}`);
  }

  // vrati access token
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// funkcija za izdavanje propusnice
export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string,
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    // bearer token u zaglavlju zahtjeva
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      document,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error issuing pass. Status: ${response.status}`);
  }

  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("Missing Location header in response.");
  }

  // ostavi samo id iz location
  const id = location.substring(location.lastIndexOf("/") + 1);
  if (!id) {
    throw new Error("Unable to extract identifier from Location header.");
  }

  // binarni podatci qr koda
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // zapisivanje u datoteku <id>.png
  await writeFile(`${id}.png`, buffer);

  return id;
}
