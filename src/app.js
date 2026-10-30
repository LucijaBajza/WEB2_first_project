import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { auth as webAuth } from "express-openid-connect";
import { auth as jwtAuth } from "express-oauth2-jwt-bearer";

// Uvoz objedinjenog routera
import routes from "./routes/router.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const {
  MY_SECRET,
  RENDER_EXTERNAL_URL,
  CLIENT_SECRET,
  ISSUER_BASE_URL,
  CLIENT_ID,
  AUDIENCE,
} = process.env;

// 1. Auth0 Web Autentifikacija (OIDC za korisnike u pregledniku)
const config = {
  authRequired: false,
  idpLogout: true, // login ne samo iz aplikacije, već i iz identity provider-a
  secret: MY_SECRET,
  baseURL: RENDER_EXTERNAL_URL || `https://localhost:3000`,
  clientID: CLIENT_ID,
  issuerBaseURL: ISSUER_BASE_URL,
  clientSecret: CLIENT_SECRET,
};
console.log({ ISSUER_BASE_URL, AUDIENCE });
// 2. Auth0 M2M Autentifikacija (Middleware koji provjerava JWT za API rute)
const checkJwt = jwtAuth({
  audience: AUDIENCE,
  issuerBaseURL: ISSUER_BASE_URL,
  tokenSigningAlg: "RS256",
});

// -- RJEŠAVANJE RUTA --

// M2M API rute: Primjenjujemo checkJwt SAMO na /passes
// Stavljamo ih PRIJE webAuth-a kako OIDC middleware ne bi pokušavao stvoriti sesiju na API pozivima
app.use("/passes", checkJwt);

// Web rute: Primjenjujemo webAuth na sve ostalo
app.use(webAuth(config));

// Registracija svih ruta
app.use("/", routes);

// -- HANDLING GREŠAKA --
app.use((err, req, res, next) => {
  // express-oauth2-jwt-bearer baca 'UnauthorizedError' ili 'InvalidTokenError'
  if (err.name === "UnauthorizedError" || err.name === "InvalidTokenError") {
    return res
      .status(401)
      .json({ error: "Invalid token", message: err.message });
  }
  if (err.name === "InsufficientScopeError") {
    return res
      .status(403)
      .json({ error: "Insufficient scope", message: err.message });
  }

  // Proslijedi ostale nepredviđene greške Expressu
  console.error(err);
  res.status(err.status || 500).send(err.message || "Internal Server Error");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
