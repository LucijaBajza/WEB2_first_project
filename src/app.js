import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { auth as webAuth } from "express-openid-connect";
import { auth as jwtAuth } from "express-oauth2-jwt-bearer";

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

// podaci potrebni za konfiguraciju Auth0
const config = {
  authRequired: false,
  idpLogout: true,
  secret: MY_SECRET,
  baseURL: RENDER_EXTERNAL_URL || `https://localhost:3000`,
  clientID: CLIENT_ID,
  issuerBaseURL: ISSUER_BASE_URL,
  clientSecret: CLIENT_SECRET,
};

//console.log({ ISSUER_BASE_URL, AUDIENCE });

// M2M
// provjera JWT tokena za sve rute koje pocinju s /passes
const checkJwt = jwtAuth({
  audience: AUDIENCE,
  issuerBaseURL: ISSUER_BASE_URL,
  tokenSigningAlg: "RS256",
});

app.use("/passes", checkJwt);

// postavljanje Auth0
app.use(webAuth(config));

app.use("/", routes);

// error handling
app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError" || err.name === "InvalidTokenError") {
    // nevaljan token
    return res
      .status(401)
      .json({ error: "Invalid token", message: err.message });
  }
  if (err.name === "InsufficientScopeError") {
    // nevaljan opseg
    return res
      .status(403)
      .json({ error: "Insufficient scope", message: err.message });
  }
  console.error(err);
  // genericki error
  res.status(err.status || 500).send(err.message || "Internal Server Error");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
