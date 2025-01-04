const { pool } = require("../../config/database");

async function getMenus(req, res) {
  const { location } = req.query;

  if (!location || !["header", "footer"].includes(location)) {
    return res
      .status(400)
      .json({ message: "Invalid location parameter", status: "error" });
  }

  try {
    // Query the menus based on the location
    const [menus] = await pool.query(
      `
        SELECT m.menu_id, m.title, m.parent_id, m.position 
        FROM res_menu m
        WHERE m.display_location = ?
      `,
      [location]
    );

    if (menus.length === 0) {
      return { message: "No menus found", status: "error" };
    }

    // Query the menu items for the fetched menus
    const [menuItems] = await pool.query(`
        SELECT i.menu_id, i.title, i.url
        FROM res_menu_items i
      `);

    // Map the menus to include the associated items
    const menuData = menus.map((menu) => ({
      menu_id: menu.menu_id,
      title: menu.title,
      parent_id: menu.parent_id,
      position: menu.position,
      menu_items: menuItems
        .filter((item) => item.menu_id === menu.menu_id)
        .map((item) => ({
          title: item.title,
          url: item.url,
        })),
    }));

    // Return the response with the fetched (or cached) data
    res.status(200).json({
      data: menuData,
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

module.exports = {
  getMenus,
};
