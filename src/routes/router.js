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

// ==========================================
// 1. WEB RUTE (Preglednik)
// ==========================================

// GET / - Početna stranica
router.get("/", async (req, res) => {
  try {
    const stats = await getPassesStats();
    let userPasses = [];

    if (req.oidc.isAuthenticated()) {
      userPasses = await getAllPasses();
    }

    res.render("main_page", {
      isAuthenticated: req.oidc.isAuthenticated(),
      user: req.oidc.user,
      totalCount: stats.total,
      activeCount: stats.active,
      passes: userPasses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Greška na bazi");
  }
});

// GET /info/:id - Javno dostupna stranica s podacima o propusnici (iz QR koda)
router.get("/info/:id", async (req, res) => {
  try {
    const pass = await getPassById(req.params.id);
    if (!pass) return res.status(404).send("Propusnica ne postoji.");

    res.send(`
      <h1>Status propusnice: ${pass.status}</h1>
      <p>Ime i prezime: ${pass.name}</p>
      <p>Dokument: ${pass.document}</p>
      <p>Izdana: ${new Date(pass.issued_at).toLocaleString()}</p>
    `);
  } catch (error) {
    res.status(500).send("Greška servera");
  }
});

// POST /web/passes/:id/cancel - Poništavanje propusnice
router.post("/web/passes/:id/cancel", async (req, res) => {
  if (!req.oidc.isAuthenticated()) return res.status(401).send("Unauthorized");
  await cancelPass(req.params.id);
  res.redirect("/");
});

// POST /web/passes/:id/delete - Brisanje propusnice
router.post("/web/passes/:id/delete", async (req, res) => {
  if (!req.oidc.isAuthenticated()) return res.status(401).send("Unauthorized");
  await deletePass(req.params.id);
  res.redirect("/");
});

// ==========================================
// 2. M2M API RUTE (Zaštićene tokenom)
// ==========================================

// GET /passes/:id - Dohvat pojedine propusnice
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

// POST /passes - Stvaranje nove propusnice i povrat QR koda
router.post("/passes", requiredScopes("create:passes"), async (req, res) => {
  const { name, document } = req.body;
  if (!name || !document) {
    return res.status(400).json({ error: "Ime i dokument su obavezni." });
  }

  const id = uuidv4();
  const issuedAt = new Date().toISOString();
  const status = "ACTIVE";

  try {
    await createPass(id, name, document, issuedAt, status);

    const publicUrl = `${process.env.BASE_URL}/info/${id}`;
    const qrCodeImage = await QRCode.toBuffer(publicUrl);

    const apiLocation = `${process.env.BASE_URL}/passes/${id}`;
    res.setHeader("Location", apiLocation);
    res.status(201).type("image/png").send(qrCodeImage);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
