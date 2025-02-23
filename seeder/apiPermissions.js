const { pool } = require("../config/database");

async function seedApiPermissions(req, res) {
  try {
    const permissions = [
      { name: "View / List Products", slug: "view_list_products" },
      { name: "View / List Files", slug: "view_list_files" },
      { name: "View / List Articles", slug: "view_list_articles" },
      { name: "View / List Announcements", slug: "view_list_announcements" },
      { name: "View / List Pages", slug: "view_list_pages" },
      { name: "Access User Account", slug: "access_user_account" },
      { name: "Access System Account", slug: "access_system_account" },
    ];

    const values = permissions.map((perm) => [perm.name, perm.slug]);

    await pool.query(
      "INSERT INTO api_permissions (permission_name, slug) VALUES ?",
      [values]
    );

    return res.status(201).json({ message: "API Permissions seeded successfully" });
  } catch (error) {
    console.error("Error seeding API Permissions:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { seedApiPermissions };
