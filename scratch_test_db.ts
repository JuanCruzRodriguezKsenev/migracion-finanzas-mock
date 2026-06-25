import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

async function main() {
  try {
    // 1. Leer el archivo .env.local manualmente para extraer la URL
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) {
      console.error("❌ Error: No se encontró el archivo .env.local en la raíz del proyecto.");
      process.exit(1);
    }
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/DATABASE_URL=([^\s]+)/);
    if (!match) {
      console.error("❌ Error: No se encontró la variable DATABASE_URL en el archivo .env.local.");
      process.exit(1);
    }
    const databaseUrl = match[1].trim();

    // Reemplazar la base de datos destino por la base de datos por defecto 'postgres' para la conexion de administracion
    const defaultDbUrl = databaseUrl.replace(/\/([^\/?]+)(\?|$)/, "/postgres$2");

    console.log("🔌 Conectando temporalmente a la base de datos de administración 'postgres'...");
    const sqlAdmin = postgres(defaultDbUrl, { connect_timeout: 5 });

    // 2. Verificar si la base de datos 'finanzas_db' existe
    const dbs = await sqlAdmin`
      SELECT datname FROM pg_database WHERE datname = 'finanzas_db'
    `;

    if (dbs.length === 0) {
      console.log("🔨 Creando la base de datos 'finanzas_db' en tu Postgres local...");
      // En Postgres no se pueden crear bases de datos dentro de transacciones, por eso se hace directamente
      await sqlAdmin`CREATE DATABASE finanzas_db`;
      console.log("✅ Base de datos 'finanzas_db' creada con éxito.");
    } else {
      console.log("ℹ️ La base de datos 'finanzas_db' ya existe en tu sistema.");
    }
    await sqlAdmin.end();

    // 3. Probar la conexión definitiva contra la base de datos del proyecto
    console.log("🔌 Conectando a la base de datos final 'finanzas_db'...");
    const sqlApp = postgres(databaseUrl, { connect_timeout: 5 });
    const appResult = await sqlApp`SELECT current_database() as db_nombre, NOW() as hora_servidor`;

    console.log("\n✨ ¡CONEXIÓN Y PREPARACIÓN EXITOSAS! ✨");
    console.log(`🔹 Base de datos activa y lista: "${appResult[0].db_nombre}"`);
    console.log(`🔹 Hora del servidor de base de datos: ${appResult[0].hora_servidor}`);

    await sqlApp.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR AL CONFIGURAR/CONECTAR A LA BASE DE DATOS:");
    console.error(error);
    process.exit(1);
  }
}

main();
