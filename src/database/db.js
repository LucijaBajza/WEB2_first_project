import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function getPassesStats() {
  const totalRes = await pool.query("SELECT COUNT(*) FROM passes");
  const activeRes = await pool.query(
    "SELECT COUNT(*) FROM passes WHERE status = 'ACTIVE'",
  );

  return {
    total: totalRes.rows[0].count,
    active: activeRes.rows[0].count,
  };
}

export async function getAllPasses() {
  const result = await pool.query(
    "SELECT * FROM passes ORDER BY issued_at DESC",
  );
  return result.rows;
}

export async function getPassById(id) {
  const result = await pool.query("SELECT * FROM passes WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createPass(id, name, document, issuedAt, status) {
  await pool.query(
    "INSERT INTO passes (id, name, document, issued_at, status) VALUES ($1, $2, $3, $4, $5)",
    [id, name, document, issuedAt, status],
  );
}

export async function cancelPass(id) {
  await pool.query("UPDATE passes SET status = 'CANCELLED' WHERE id = $1", [
    id,
  ]);
}

export async function deletePass(id) {
  await pool.query("DELETE FROM passes WHERE id = $1", [id]);
}

export default pool;
