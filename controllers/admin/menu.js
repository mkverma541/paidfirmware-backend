const { pool } = require("../../config/database");
const fs = require("fs");
const path = require("path");

async function createMenu(req, res) {
  const connection = await pool.getConnection();
  try {
    const {
      title,
      parent_id = null,
      display_location,
      position = 0,
      menu_items = [],
    } = req.body;

    // Begin transaction
    await connection.beginTransaction();

    // Insert main menu item
    const query = `
      INSERT INTO res_menu (title, parent_id, display_location, position)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await connection.query(query, [
      title,
      parent_id,
      display_location,
      position,
    ]);

    const menuId = result.insertId;

    // If there are menu items, insert them as sub-items
    if (menu_items.length > 0) {
      const menuItemsQuery = `
        INSERT INTO res_menu_items (menu_id, title, url, link_type, position)
        VALUES ?
      `;

      const menuItemsData = menu_items.map((item, index) => [
        menuId,
        item.title,
        item.url,
        item.link_type, // 'internal' or 'external'
        index + 1, // Set the position based on the order in the array
      ]);

      await connection.query(menuItemsQuery, [menuItemsData]);
    }

    // Commit the transaction
    await connection.commit();

    res.status(201).json({
      message: "Menu created successfully",
      status: "success",
    });
  } catch (err) {
    console.error(err);
    await connection.rollback();
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  } finally {
    if (connection) connection.release(); // Release the connection
  }
}

async function getMenus(req, res) {
  try {
    const [menus] = await pool.query(`
      SELECT m.menu_id, m.title, m.parent_id, m.display_location, m.position, 
             m.created_at, m.updated_at
      FROM res_menu m
    `);

    const [menuItems] = await pool.query(`
      SELECT i.menu_id, i.title, i.url, i.position
      FROM res_menu_items i
    `);

    // Map menus to include sub-menu items
    const menuData = menus.map((menu) => ({
      menu_id: menu.menu_id,
      title: menu.title,
      parent_id: menu.parent_id,
      display_location: menu.display_location,
      position: menu.position,
      created_at: menu.created_at,
      updated_at: menu.updated_at,
      menu_items: menuItems
        .filter((item) => item.menu_id === menu.menu_id)
        .map((item) => ({
          title: item.title,
          url: item.url,
          position: item.position,
        })),
    }));

    res.status(200).json({
      data: menuData,
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

// Get a single menu by ID

async function getMenu(req, res) {
  try {
    const { id } = req.params;
    const [menu] = await pool.query(
      `SELECT * FROM res_menu WHERE menu_id = ?`,
      [id]
    );
    const [menuItems] = await pool.query(
      `SELECT * FROM res_menu_items WHERE menu_id = ?`,
      [id]
    );
    res.status(200).json({
      data: {
        menu: menu[0],
        menu_items: menuItems,
      },
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

// Update an existing menu

async function updateMenu(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      title,
      parent_id = null,
      display_location,
      position = 0,
      menu_items = [],
    } = req.body;

    // Begin transaction
    await connection.beginTransaction();

    // Update main menu item
    const updateMenuQuery = `
            UPDATE res_menu
            SET title = ?, parent_id = ?, display_location = ?, position = ?
            WHERE menu_id = ?
        `;
    await connection.query(updateMenuQuery, [
      title,
      parent_id,
      display_location,
      position,
      id,
    ]);

    // Delete existing menu items
    const deleteMenuItemsQuery = `
            DELETE FROM res_menu_items
            WHERE menu_id = ?
        `;
    await connection.query(deleteMenuItemsQuery, [id]);

    // Insert new menu items
    if (menu_items.length > 0) {
      const menuItemsQuery = `
                INSERT INTO res_menu_items (menu_id, title, url, position)
                VALUES ?
            `;

      const menuItemsData = menu_items.map((item, index) => [
        id,
        item.title,
        item.url,
        index + 1,
      ]);

      await connection.query(menuItemsQuery, [menuItemsData]);
    }

    // Commit the transaction
    await connection.commit();

    res.status(200).json({
      message: "Menu updated successfully",
      status: "success",
    });
  } catch (err) {
    console.error(err);
    await connection.rollback();
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  } finally {
    if (connection) connection.release();
  }
}

// Delete a menu

async function deleteMenu(req, res) {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM res_menu WHERE menu_id = ?`, [id]);
    await pool.query(`DELETE FROM res_menu_items WHERE menu_id = ?`, [id]);
    res.status(200).json({
      message: "Menu deleted successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

async function generateJsonFile(req, res) {
  const connection = await pool.getConnection();
  try {
    console.log(`Generating JSON file for menus`);

    // Query to get all menu data
    const [menus] = await connection.query(`
      SELECT menu_id, title, parent_id, display_location, position 
      FROM res_menu
    `);

    // Query to get all menu items
    const [menuItems] = await connection.query(`
      SELECT menu_id, title, url, position
      FROM res_menu_items
    `);

    // Log retrieved menus and items
    console.log("Menus retrieved:", menus.length, menus);
    console.log("Menu Items retrieved:", menuItems.length, menuItems);

    // Combine menu with its related menu_items
    const menuWithItems = menus.map((menu) => ({
      title: menu.title,
      display_location: menu.display_location,
      menu_items:
        menuItems
          .filter((item) => item.menu_id === menu.menu_id)
          .map((item) => ({
            title: item.title,
            url: item.url,
          })) || [], // Ensure menu_items is an empty array if no items are found
    }));

    // Define the directory where the JSON will be stored
    const jsonDirectory = path.join(__dirname, "../../public/pages");

    if (!fs.existsSync(jsonDirectory)) {
      fs.mkdirSync(jsonDirectory, { recursive: true });
      console.log(`Directory created at: ${jsonDirectory}`);
    }

    const filePath = path.join(jsonDirectory, `menus.json`);

    // Write the data to a JSON file
    fs.writeFileSync(filePath, JSON.stringify(menuWithItems, null, 2), "utf-8");
    console.log(`Data has been written to ${filePath}`);

    return res.status(200).json({
      success: true,
      message: `JSON file created: ${filePath}`,
    });
  } catch (error) {
    console.error(`Error generating JSON file for menus:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
}

module.exports = {
  getMenus,
  createMenu,
  getMenu,
  updateMenu,
  deleteMenu,
  generateJsonFile,
};
