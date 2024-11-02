const { pool } = require("../../config/database");
const NodeCache = require("node-cache");

const fileCache = new NodeCache({ stdTTL: 0 }); // No expiration until manual deletion

async function getMenus(req, res) {
  const { location } = req.query;

  if (!location || !['header', 'footer'].includes(location)) {
    return res.status(400).json({ message: "Invalid location parameter", status: "error" });
  }

  // Check cache first
  const cacheKey = `menu_${location}`;
  const cachedData = fileCache.get(cacheKey);

  if (cachedData) {
    return res.status(200).json({ data: cachedData, status: "success" });
  }

  try {
    const [menus] = await pool.query(`
      SELECT m.menu_id, m.title, m.parent_id, m.position 
      FROM res_menu m 
      WHERE m.display_location = ?
    `, [location]);

    const [menuItems] = await pool.query(`
      SELECT i.menu_id, i.title, i.url
      FROM res_menu_items i
    `);

    const menuData = menus.map((menu) => ({
      menu_id: menu.menu_id,
      title: menu.title,
      parent_id: menu.parent_id,
      position: menu.position,
      menu_items: menuItems
        .filter((item) => item.menu_id === menu.menu_id)
        .map((item) => ({
          title: item.title,
          url: item.url
        })),
    }));

    // Cache the result
    fileCache.set(cacheKey, menuData);

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

// Function to clear cache when a menu is deleted
function clearMenuCache(location) {
  const cacheKey = `menu_${location}`;
  fileCache.del(cacheKey);
}

module.exports = {
  getMenus,
  clearMenuCache,
};
