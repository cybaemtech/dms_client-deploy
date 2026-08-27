import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const fullServer = process.env.DB_SERVER || 'DMS-MACHINE\\DMSSERVER';
const serverParts = fullServer.split('\\');
const serverHost = serverParts[0];
const instanceName = serverParts.length > 1 ? serverParts[1] : undefined;

const sqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Neelikon@2026',
  database: process.env.DB_NAME || 'DMS',
  server: serverHost,
  ...(instanceName ? {} : { port: parseInt(process.env.DB_PORT || '1433', 10) }),
  options: {
    ...(instanceName ? { instanceName } : {}),
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function run() {
  try {
    const pool = await new sql.ConnectionPool(sqlConfig).connect();
    
    // First, let's find all the tables in the database
    const tablesResult = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    const tables = tablesResult.recordset.map(r => `[${r.TABLE_SCHEMA}].[${r.TABLE_NAME}]`);
    console.log("ALL TABLES:", tables.join(', '));
    
    // We only want to keep Users and Departments
    // Depending on schema design, we need to handle foreign keys
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
