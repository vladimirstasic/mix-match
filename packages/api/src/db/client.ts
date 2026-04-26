import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

const url = new URL(config.databaseUrl);

const pool = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port || "5432"),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
});
export const db = drizzle(pool, { schema });
