const { pool } = require('../config/database');  // Import MySQL pool
const slugify = require('slugify');
require('dotenv').config();

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 1000;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY) || 5000;

async function updateSlugsInBatches() {
    let connection;

    try {
        connection = await pool.getConnection();

        // Get the total records with NULL, empty, or invalid slugs
        const [[{ total }]] = await connection.query(`
            SELECT COUNT(*) AS total 
            FROM res_folders 
            WHERE slug IS NULL OR slug = '' OR slug LIKE '%/%' OR slug LIKE '%_%'
        `);

        console.log(`📊 Total records to update: ${total}`);

        const totalBatches = Math.ceil(total / BATCH_SIZE);

        for (let batch = 0; batch < totalBatches; batch++) {
            const offset = batch * BATCH_SIZE;
            console.log(`🚀 Processing batch ${batch + 1}/${totalBatches} (offset: ${offset}, limit: ${BATCH_SIZE})`);

            let retries = 0;
            let batchSuccess = false;

            while (!batchSuccess && retries < MAX_RETRIES) {
                try {
                    await processBatch(connection, offset, BATCH_SIZE);
                    batchSuccess = true;
                    console.log(`✅ Batch ${batch + 1} processed successfully.`);
                } catch (error) {
                    retries++;
                    console.error(`❌ Error in batch ${batch + 1} (attempt ${retries}):`, error);
                    if (retries < MAX_RETRIES) {
                        console.log(`🔁 Retrying in ${RETRY_DELAY / 1000} seconds...`);
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                    } else {
                        console.log(`🚫 Max retries reached. Skipping batch ${batch + 1}.`);
                    }
                }
            }
        }

        console.log(`🎉 All batches processed successfully.`);

    } catch (error) {
        console.error('🔥 Error during batch processing:', error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function processBatch(connection, offset, limit) {
    const [folders] = await connection.query(`
        SELECT folder_id, title, slug
        FROM res_folders 
        WHERE slug IS NULL OR slug = '' OR slug LIKE '%/%' OR slug LIKE '%_%'
        LIMIT ? OFFSET ?
    `, [limit, offset]);

    if (folders.length === 0) return;

    await connection.beginTransaction();

    for (const folder of folders) {
        let baseSlug = folder.slug || slugify(folder.title || '', {
            lower: true,
            replacement: '-',
            remove: /[*+~.()'"!:@]/g
        });

        // Replace invalid characters
        baseSlug = baseSlug.replace(/[/_]/g, '-');

        // Generate a unique slug
        const uniqueSlug = await getUniqueSlug(connection, baseSlug, folder.folder_id);

        // Update the slug in the database
        await connection.query(`
            UPDATE res_folders
            SET slug = ?
            WHERE folder_id = ?
        `, [uniqueSlug, folder.folder_id]);
    }

    await connection.commit();
}

async function getUniqueSlug(connection, baseSlug, folderId) {
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (true) {
        const [rows] = await connection.query(`
            SELECT COUNT(*) AS count 
            FROM res_folders
            WHERE slug = ? AND folder_id <> ?
        `, [uniqueSlug, folderId]);

        if (rows[0].count === 0) {
            break;  // Unique slug found
        }

        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
    }

    return uniqueSlug;
}

// Run the batch update process
updateSlugsInBatches();
