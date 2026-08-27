const sql = require('mssql');

const tryConnect = async (config, name) => {
    try {
        const pool = await sql.connect(config);
        const dbName = await pool.request().query("SELECT DB_NAME() AS db");
        console.log(`Success [${name}]: Connected to DB: ${dbName.recordset[0].db}`);
        await pool.close();
    } catch (err) {
        console.log(`Failed [${name}]: ${err.message}`);
    }
};

(async () => {
    const configs = [
        { name: "localhost (default port 1433)", config: { user: 'sa', password: 'Neelikon@2026', server: 'localhost', database: 'DMS', options: { trustServerCertificate: true, encrypt: false } } },
        { name: "localhost:1438", config: { user: 'sa', password: 'Neelikon@2026', server: 'localhost', port: 1438, database: 'DMS', options: { trustServerCertificate: true, encrypt: false } } },
        { name: "localhost\\DMSSERVER", config: { user: 'sa', password: 'Neelikon@2026', server: 'localhost', database: 'DMS', options: { instanceName: 'DMSSERVER', trustServerCertificate: true, encrypt: false } } },
        { name: "DMS-MACHINE\\DMSSERVER", config: { user: 'sa', password: 'Neelikon@2026', server: 'DMS-MACHINE', database: 'DMS', options: { instanceName: 'DMSSERVER', trustServerCertificate: true, encrypt: false } } }
    ];
    for (let c of configs) {
        await tryConnect(c.config, c.name);
    }
})();
