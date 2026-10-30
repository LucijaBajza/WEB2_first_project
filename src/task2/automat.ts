import { writeFile } from "node:fs/promises";
import { Buffer } from "buffer";

export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const tokenUrl = new URL("/oauth/token", authority).toString();

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
    throw new Error(
      `Greška prilikom dohvaćanja tokena. Status: ${response.status}`,
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string,
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
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
    throw new Error(
      `Greška prilikom izdavanja propusnice. Status: ${response.status}`,
    );
  }

  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("Nedostaje Location zaglavlje u odgovoru.");
  }

  // Ekstrakcija identifikatora iz Location zaglavlja (npr. iz /passes/f81d4fae-...)
  const id = location.substring(location.lastIndexOf("/") + 1);
  if (!id) {
    throw new Error("Nije moguće izvući identifikator iz Location zaglavlja.");
  }

  // Preuzimanje binarnih podataka QR koda
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Zapisivanje u datoteku <id>.png
  await writeFile(`${id}.png`, buffer);

  return id;
}
