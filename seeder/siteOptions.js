const { pool } = require("../config/database");
const { faker } = require("@faker-js/faker");

const tableName = "res_options";

const siteOptions = [
  { option_name: "currency", option_value: "USD" },
  { option_name: "logo", option_value: 'logo.png' },
  { option_name: "site_name", option_value: 'Filewale' },
  { option_name: "store_name", option_value: 'Filewale' },
  { option_name: "store_tagline", option_value: 'We are always fastest ' },
  { option_name: "store_phone", option_value: '' },
  { option_name: "store_email", option_value: 'contact@filewale.com'},
  { option_name: "store_legal_business_name", option_value: 'Filewale' },
  { option_name: "store_country", option_value: 'India' },
  { option_name: "store_address", option_value: '' },
  { option_name: "store_address2", option_value: '' },
  { option_name: "store_city", option_value: '' },
  { option_name: "store_state", option_value: '' },
  { option_name: "store_pincode", option_value: '' },
  { option_name: "currency_symbol", option_value: "$" },
  { option_name: "currency_code", option_value: "USD" },
  { option_name: "currency_name", option_value: "US Dollar" },
  { option_name: "order_id_prefix", option_value: "#" },
  { option_name: "order_id_suffix", option_value: "" },
  { option_name: "plan_name", option_value: 'Premimum' },
  { option_name: "license_number", option_value: faker.string.alphanumeric(12) },
  { option_name: "license_start_date", option_value: faker.date.future().toISOString().split("T")[0] },
  { option_name: "license_expiry_date", option_value: faker.date.future({ years: 1 }).toISOString().split("T")[0] },
  { option_name: "currency_decimals", option_value: "2" },
  { option_name: "razorpay_key_id", option_value: 'rzp_test_fStvfIrWe60R7s' },
  { option_name: "razorpay_key_secret", option_value: '9nC61yUhM8vr9MiPD2p5RR0S' },
  { option_name: "site_url", option_value: 'filewale.com' },
];

// Function to migrate table and insert data
async function migrateTable() {
  try {
    await pool.query(
      `INSERT INTO ${tableName} (option_name, option_value) VALUES ?`,
      [siteOptions.map((option) => [option.option_name, option.option_value])]
    );

    console.log("Site options migrated successfully!"); 
   
  } catch (error) {
    console.error("Error migrating site options:", error);
  } finally {
    process.exit();
  }
}

// Run migration
migrateTable();
