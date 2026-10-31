import express from "express";
import { requiredScopes } from "express-oauth2-jwt-bearer";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import {
  getPassesStats,
  getAllPasses,
  getPassById,
  createPass,
  cancelPass,
  deletePass,
} from "../database/db.js";

const router = express.Router();

// WEB RUTE

// pocetna stranica
router.get("/", async (req, res) => {
  try {
    // dohvat broja propusnica
    const stats = await getPassesStats();
    let userPasses = [];

    // provjera je li korisnik prijavljen
    if (req.oidc.isAuthenticated()) {
      userPasses = await getAllPasses();
    }

    // proslijedi parametre u main_page.ejs
    res.render("main_page", {
      isAuthenticated: req.oidc.isAuthenticated(),
      user: req.oidc.user,
      totalCount: stats.total,
      activeCount: stats.active,
      passes: userPasses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// informacije o pojedinoj propusnici
router.get("/info/:id", async (req, res) => {
  try {
    const pass = await getPassById(req.params.id);

    // ako ne postoji, vrati 404 error
    if (!pass) return res.status(404).send("Pass not found.");

    // prikaz info o propusnici
    res.send(`
      <h1>Status propusnice: ${pass.status}</h1>
      <p>Ime i prezime: ${pass.name}</p>
      <p>Dokument: ${pass.document}</p>
      <p>Izdana: ${new Date(pass.issued_at).toLocaleString()}</p>
    `);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// ponistavanje propusnice
router.post("/web/passes/:id/cancel", async (req, res) => {
  if (!req.oidc.isAuthenticated()) return res.status(401).send("Unauthorized");
  await cancelPass(req.params.id);
  res.redirect("/");
});

// brisanje propusnice
router.post("/web/passes/:id/delete", async (req, res) => {
  if (!req.oidc.isAuthenticated()) return res.status(401).send("Unauthorized");
  await deletePass(req.params.id);
  res.redirect("/");
});

// M2M RUTE

// dohvat propusnice
router.get("/passes/:id", requiredScopes("read:passes"), async (req, res) => {
  try {
    const p = await getPassById(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });

    res.json({
      id: p.id,
      name: p.name,
      document: p.document,
      issuedAt: p.issued_at,
      status: p.status,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// stvaranje nove propusnice
router.post("/passes", requiredScopes("create:passes"), async (req, res) => {
  const { name, document } = req.body;
  if (!name || !document) {
    return res.status(400).json({ error: "Name and document are required." });
  }

  const id = uuidv4(); // generiranje id propusnice
  const issuedAt = new Date().toISOString();
  const status = "ACTIVE";

  try {
    await createPass(id, name, document, issuedAt, status);

    const baseUrl = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

    // pretvaranje url-a u qr kod
    const publicUrl = `${baseUrl}/info/${id}`;
    const qrCodeImage = await QRCode.toBuffer(publicUrl);

    // postavljanje lokacije nove propusnice na api adresu
    const apiLocation = `${baseUrl}/passes/${id}`;
    res.setHeader("Location", apiLocation);
    // vrati generirani qr kod kao sliku
    res.status(201).type("image/png").send(qrCodeImage);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
