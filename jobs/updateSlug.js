const cron = require("node-cron");
const { pool } = require("../config/database");

// Helper function to log cron job activity to the database
async function logCronJobToDatabase(status, tableName, message) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const query = `
      INSERT INTO cron_job_logs (status, table_name, message)
      VALUES (?, ?, ?)
    `;
    
    await connection.execute(query, [status, tableName, message]);
  } catch (error) {
    console.error("Failed to log cron job activity:", error.message);
  } finally {
    if (connection) connection.release();
  }
}

// Function to update slugs for res_files with NULL values
async function updateSlugsForFiles() {
  let connection;
  try {
    connection = await pool.getConnection();

    const query = `
      UPDATE res_files AS rf
      SET rf.slug = (
        SELECT
          CASE 
            WHEN COUNT(*) = 0 THEN LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-'))
            ELSE CONCAT(LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-')), '-', COUNT(*))
          END
        FROM res_files
        WHERE LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-')) = LOWER(REPLACE(REPLACE(REPLACE(title, '_', '-'), '[', '-'), ']', '-'))
        AND rf.slug IS NOT NULL
        GROUP BY rf.title
      )
      WHERE rf.slug IS NULL;
    `;

    await connection.execute(query);
    await logCronJobToDatabase("success", "res_files", "Successfully updated slugs for files with NULL values");
  } catch (error) {
    await logCronJobToDatabase("error", "res_files", `Error updating slugs: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}

// Function to update slugs for res_folders with NULL values
async function updateSlugsForFolders() {
  let connection;
  try {
    connection = await pool.getConnection();

    const query = `
      UPDATE res_folders AS rf
      SET rf.slug = (
        SELECT
          CASE 
            WHEN COUNT(*) = 0 THEN LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-'))
            ELSE CONCAT(LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-')), '-', COUNT(*))
          END
        FROM res_folders
        WHERE LOWER(REPLACE(REPLACE(REPLACE(rf.title, '_', '-'), '[', '-'), ']', '-')) = LOWER(REPLACE(REPLACE(REPLACE(title, '_', '-'), '[', '-'), ']', '-'))
        AND rf.slug IS NOT NULL
        GROUP BY rf.title
      )
      WHERE rf.slug IS NULL;
    `;

    await connection.execute(query);
    await logCronJobToDatabase("success", "res_folders", "Successfully updated slugs for folders with NULL values");
  } catch (error) {
    await logCronJobToDatabase("error", "res_folders", `Error updating slugs: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}

// Function to run updates and log results
async function runUpdatesOnce() {
  console.log("Running updates for the cron job...");
  await updateSlugsForFiles();
  await updateSlugsForFolders();
  console.log("Cron job completed.");
}

// Schedule the cron job to run once at a specific time
const dateToRun = new Date('2024-10-28T10:00:00Z'); // Set the date and time to run

// Function to calculate cron expression from a specific date
function getCronExpression(date) {
  const minutes = date.getUTCMinutes();
  const hours = date.getUTCHours();
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1; // Month is 0-indexed
  const dayOfWeek = '*'; // Run on any day of the week
  return `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

// Schedule the cron job to run at the specified date
const cronExpression = getCronExpression(dateToRun);
cron.schedule("cronExpression", async () => {
  await runUpdatesOnce();
  // Stop the cron job after it has run once
  this.stop();
});

