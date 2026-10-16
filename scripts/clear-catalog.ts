import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

async function clearCatalog() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERRO: DATABASE_URL não está configurada no ambiente.");
    process.exit(1);
  }

  console.log("Conectando ao banco de dados...");
  const connectionUrl = new URL(connectionString);
  const sslMode = connectionUrl.searchParams.get("sslmode");
  connectionUrl.searchParams.delete("sslmode");
  const sslCa = process.env.DATABASE_SSL_CA;
  const ssl = sslCa ? { ca: sslCa } : sslMode === "require" ? { rejectUnauthorized: false } : undefined;

  const pool = new Pool({ connectionString: connectionUrl.toString(), ssl });
  const db = drizzle(pool);

  try {
    console.log("Desvinculando setores e equipes dos usuários...");
    await db.execute(sql`UPDATE "users" SET "departmentId" = NULL, "teamId" = NULL`);
    await db.execute(sql`UPDATE "userInvitations" SET "departmentId" = NULL, "teamId" = NULL`);
    await db.execute(sql`DELETE FROM "managerScopes"`);
    await db.execute(sql`DELETE FROM "userRoles"`);

    console.log("Apagando chamados e registros dependentes...");
    await db.execute(sql`DELETE FROM "aiAssistanceRequests"`);
    await db.execute(sql`DELETE FROM "ticketEvents"`);
    await db.execute(sql`DELETE FROM "ticketAttachments"`);
    await db.execute(sql`DELETE FROM "ticketComments"`);
    await db.execute(sql`DELETE FROM "ticketApprovals"`);
    await db.execute(sql`DELETE FROM "tickets"`);

    console.log("Apagando serviços e categorias...");
    await db.execute(sql`DELETE FROM "services"`);
    await db.execute(sql`DELETE FROM "serviceCategories"`);

    console.log("Apagando tipos de chamados, filas, equipes e setores...");
    await db.execute(sql`DELETE FROM "ticketTypes"`);
    await db.execute(sql`DELETE FROM "queues"`);
    await db.execute(sql`DELETE FROM "teams"`);
    await db.execute(sql`DELETE FROM "departments"`);

    console.log("✅ Todos os registros de setores, equipes, filas e tipos de chamado foram apagados com sucesso!");
  } catch (error) {
    console.error("Falha ao limpar dados:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearCatalog();
