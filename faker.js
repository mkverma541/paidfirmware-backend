const mysql = require("mysql2/promise");
const { faker } = require("@faker-js/faker");

const pool = mysql.createPool({
  host: "localhost",
  user: "root", // Change if needed
  password: "", // Change if needed
  database: "stagnate", // Change to your database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function insertProjects() {
  const projects = [];

  for (let i = 1001; i <= 2000; i++) {
    projects.push([
      `ADR${i}`, // Project Code
      "group", // Project Type
      faker.date.past(), // Start Date
      faker.date.future(), // End Date
      faker.datatype.boolean(), // Is Dynamic Thanks
      faker.company.catchPhrase(), // Group Project Name
      faker.lorem.sentence(), // Group Project Description
      faker.commerce.productName(), // Project Name
      faker.name.fullName(), // Project Manager
      faker.lorem.paragraph(), // Description
      faker.number.int({ min: 10, max: 50 }), // LOI (Length of Interview)

      faker.number.int({ min: 100, max: 500 }), // IR (Incidence Rate)
      faker.number.int({ min: 500, max: 1000 }), // Sample Size
      faker.number.int({ min: 1, max: 5 }), // Respondent Click Quota
      faker.number.float({ min: 1, max: 5, precision: 0.1 }), // Project CPI
      faker.number.float({ min: 1, max: 5, precision: 0.1 }), // Supplier CPI
      faker.datatype.boolean(), // Is Pre-Screen
      faker.datatype.boolean(), // Is Geo Location
      faker.datatype.boolean(), // Is Unique IP
      faker.number.int({ min: 1, max: 10 }), // Unique IP Count
      faker.datatype.boolean(), // Is Speeder
      faker.number.int({ min: 1, max: 10 }), // Speeder Count
      faker.datatype.boolean(), // Is Exclude
      faker.internet.url(), // Dynamic Thanks URL
      faker.datatype.boolean(), // Is TSign
      faker.datatype.boolean(), // Is Mobile
      faker.datatype.boolean(), // Is Tablet
      faker.datatype.boolean(), // Is Desktop
      faker.lorem.sentence(), // Notes
      faker.number.int({ min: 1, max: 100 }), // Client ID
      faker.address.countryCode(), // Country Code
      faker.locale, // Language Code
      faker.number.int({ min: 1, max: 3 }), // Project Category
      faker.finance.currencyCode(), // Currency
      faker.number.int({ min: 0, max: 3 }), // Status (0 to 3)
      faker.date.past(), // Created At
      faker.date.recent(), // Updated At
    ]);
  }

  const sql = `
    INSERT INTO projects
    (project_code, project_type, start_date, end_date, is_dynamic_thanks, group_project_name, group_project_description, project_name, project_manager, description, loi, ir, sample_size, respondent_click_quota, project_cpi, supplier_cpi, is_pre_screen, is_geo_location, is_unique_ip, unique_ip_count, is_speeder, speeder_count, is_exclude, is_dynamic_thanks_url, is_tsign, is_mobile, is_tablet, is_desktop, notes, client_id, country_code, language_code, project_category, currency, status, created_at, updated_at)
    VALUES ?
  `;

  try {
    const [result] = await pool.query(sql, [projects]);
    console.log(`✅ Successfully inserted ${result.affectedRows} projects.`);
  } catch (error) {
    console.error("❌ Error inserting projects:", error);
  } finally {
    await pool.end();
  }
}

insertProjects();
