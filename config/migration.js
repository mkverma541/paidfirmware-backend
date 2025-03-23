const knex = require("knex");
const dotenv = require("dotenv");

dotenv.config();

// Source and Target database configuration with debug mode
const sourceDB = knex({
  client: "mysql2",
  connection: {
    host: "localhost",
    user: "root",
    password: "",
    database: "u161515337_res",
  },
  debug: true, // Log all SQL queries
});

const targetDB = knex({
  client: "mysql2",
  connection: {
    host: "localhost",
    user: "root",
    password: "",
    database: "filewale",
  },
  debug: true, // Log all SQL queries
});

const tablesToMigrate = ["res_files"]; // Tables to migrate

// Field mapping function
const mapRowData = (tableName, row) => {
  switch (tableName) {
    case "res_files":
      return {
        file_id: row.file_id,
        folder_id: row.folder_id,
        title: row.title,
        description: row.description || "",
        body: row.body || "",
        thumbnail: row.thumbnail || "",
        image: row.image || "",
        size: row.size || "",
        price: row.price || 0,
        url: row.url || "",
        url_type: row.url_type || "",
        server_id: row.server_id || 0,
        visits: row.visits || 0,
        downloads: row.downloads || 0,
        is_active: row.is_active ? 1 : 0,
        is_new: row.is_new ? 1 : 0,
        is_featured: row.is_featured ? 1 : 0,
        rating_count: row.rating_count || 0,
        rating_points: row.rating_points || 0,
        tags: row.tags || "",
        slug: row.slug || "",
        min_cart_qty: 1,
        max_cart_qty: 1,
        created_at: row.date_create || new Date(),
        updated_at: row.date_update || new Date(),
      };

    case "res_folders":
      return {
        folder_id: row.folder_id,
        parent_id: row.parent_id,
        title: row.title,
        description: row.description || "",
        thumbnail: row.thumbnail || "",
        is_active: row.is_active ? 1 : 0,
        is_new: row.is_new ? 1 : 0,
        slug: row.slug || "",
        created_at: row.date_create || new Date(),
        updated_at: row.date_update || new Date(),
      };

    default:
      return row; // Fallback to raw row if no mapping defined
  }
};

// Function to migrate a single table with batching and transactions
const migrateTable = async (tableName) => {
  const batchSize = 100;

  try {
    console.log(`🔍 Fetching data from ${tableName}...`);
    const rows = await sourceDB(tableName).select("*");

    if (rows.length === 0) {
      console.log(`⚠️ No data found in ${tableName}. Skipping...`);
      return;
    }

    console.log(`🚀 Migrating ${rows.length} records from ${tableName}...`);

    // Use transactions to maintain consistency
    await targetDB.transaction(async (trx) => {
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const transformedBatch = batch.map((row) =>
          mapRowData(tableName, row)
        );

        try {
          // Insert the batch
          await trx(tableName).insert(transformedBatch);
          console.log(`✅ Migrated batch ${i / batchSize + 1} of ${tableName}`);
        } catch (error) {
          console.error(`❌ Failed batch insert:`, error.message);
          console.error(`Error details: ${JSON.stringify(error, null, 2)}`);
          throw error; // Rollback on failure
        }
      }
    });

    console.log(`🎉 Migration of ${tableName} completed successfully!`);
  } catch (error) {
    console.error(`❌ Migration failed for ${tableName}:`, error.message);
  }
};

// Function to migrate all tables
const migrateAllTables = async () => {
  try {
    for (const table of tablesToMigrate) {
      await migrateTable(table);
    }
    console.log("✅ All tables migrated successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    await sourceDB.destroy();
    await targetDB.destroy();
  }
};

// Run the migration
migrateAllTables();
