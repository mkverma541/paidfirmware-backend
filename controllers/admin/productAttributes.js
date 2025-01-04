const { pool } = require("../../config/database");


const getAllAttributes = async (req, res) => {
  try {
    // Fetch all attributes with their values
    const [attributes] = await pool.execute(`
      SELECT * FROM res_product_attributes`);

    if (!attributes.length) {
      return res
        .status(404)
        .json({ message: "No attributes found." });
    }

    return res.status(200).json({
      message: "Attributes retrieved successfully",
      data: attributes,
    });
  } catch (error) {
    console.error("Database error in getAllAttributes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const addAttribute = async (req, res) => {
  const { name, slug} = req.body;
  

  if (!name) {
    return res.status(400).json({ error: "Attribute name is required." });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO res_product_attributes (name, slug) VALUES (?,?)`,
      [name, slug]
    );

    res.status(201).json({
      message: "Attribute type added successfully",
      attribute_id: result.insertId,
    });
  } catch (error) {
    console.error("Database error in addAttributeType:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const updateAttribute = async (req, res) => {
  const { name, slug, id } = req.body;

  if (!name || !id) {
    return res.status(400).json({
      error: "Attribute ID and name are required.",
    });
  }

  try {
    await pool.execute(
      `UPDATE res_product_attributes SET name = ?, slug = ? WHERE id = ?`,
      [name, slug, id]
    );

    res.status(200).json({
      message: "Attribute type updated successfully",
    });
  } catch (error) {
    console.error("Database error in updateAttributeType:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteAttribute = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: "Attribute ID is required.",
    });
  }

  try {
    await pool.execute(`DELETE FROM res_product_attributes WHERE id = ?`, [id]);

    // delete all values associated with the attribute
    
    await pool.execute(
      `DELETE FROM res_product_attribute_values WHERE attribute_id = ?`,
      [id]
    );

    res.status(200).json({
      message: "Attribute type deleted successfully",
    });
  } catch (error) {
    console.error("Database error in deleteAttribute:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const addAttributeValue = async (req, res) => {
  const { attribute_id, name, slug, description } = req.body;

  if (!attribute_id || !name) {
    return res.status(400).json({
      error: "Attribute ID and value are required.",
    });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO res_product_attribute_values (attribute_id, name, slug, description) VALUES (?, ?, ?, ?)`,
      [attribute_id, name, slug, description]
    );

    res.status(201).json({
      message: "Attribute value added successfully",
      value_id: result.insertId,
    });
  } catch (error) {
    console.error("Database error in addAttributeValue:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateAttributeValue = async (req, res) => {
  const { name, slug, description, id } = req.body;

  if (!name || !id) {
    return res.status(400).json({
      error: "Attribute value ID and name are required.",
    });
  }

  try {
    await pool.execute(
      `UPDATE res_product_attribute_values SET name = ?, slug = ?, description = ? WHERE id = ?`,
      [name, slug, description, id]
    );

    res.status(200).json({
      message: "Attribute value updated successfully",
    });
  } catch (error) {
    console.error("Database error in updateAttributeValue:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
} 

/**
 * Retrieve all attributes and their associated values
 */
const getAttributesValues = async (req, res) => {
  const { id } = req.params; // Get the attribute type from the URL

  if (!id) {
    return res
      .status(400)
      .json({ error: "Attribute id is required" });
  }

  try {
    // Find the attribute ID and name by its type
    const [attribute] = await pool.execute(
      `SELECT * FROM res_product_attribute_values WHERE attribute_id = ?`,
      [id]
    );

    return res.status(200).json({
      data: attribute,
    });

  } catch (error) {
    console.error("Database error in getAttributeByType:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteAttributeValues = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: "Attribute ID is required.",
    });
  }

  try {
    await pool.execute(
      `DELETE FROM res_product_attribute_values WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      message: "Attribute value deleted successfully",
    });
  } catch (error) {
    console.error("Database error in deleteAttributeValues:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


module.exports = {
  addAttribute,
  updateAttribute,
  deleteAttribute,
  addAttributeValue,
  deleteAttributeValues,
  updateAttributeValue,
  getAttributesValues,
  getAllAttributes
};
