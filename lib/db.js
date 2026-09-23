import pg from "pg";

// Un único pool por proceso. En desarrollo el hot reload re-evalúa los
// módulos, así que se guarda en globalThis para no abrir pools nuevos.
const pool =
  globalThis.__pgPool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (process.env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export default pool;
