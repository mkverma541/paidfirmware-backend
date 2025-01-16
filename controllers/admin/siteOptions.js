const { pool } = require("../../config/database");

// Get all options
async function getAllOptions(req, res) {
  try {
    const [optionsResult] = await pool.execute(
      `SELECT option_id, option_name, option_value FROM res_options`
    );

    const options = {};
    
    optionsResult.forEach(option => {
      options[option.option_name] = option.option_value;
    });

    return res.status(200).json({
      options
    });
  } catch (error) {
    console.error("Error fetching options:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Add a new option (for internal use only)
async function addOption(req, res) {
    try {
      const { option_name, option_value } = req.body;
  
      // Validate that both option_name and option_value are provided
      if (!option_name) {
        return res.status(400).json({ error: "Option name and value are required" });
      }
  
      // Check if the option_name already exists
      const [existingOption] = await pool.execute(
        `SELECT option_id FROM res_options WHERE option_name = ?`,
        [option_name]
      );
  
      if (existingOption.length > 0) {
        return res.status(400).json({ error: "Option already exists" });
      }
  
      // Insert the new option
      await pool.execute(
        `INSERT INTO res_options (option_name, option_value) VALUES (?, ?)`,
        [option_name, option_value]
      );
  
      return res.status(201).json({ message: "Option added successfully" });
    } catch (error) {
      console.error("Error adding option:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
  

// Update an option by name or ID
async function updateOption(req, res) {
  try {
    const { option_name, option_value, option_id } = req.body;

    // Ensure either option_name or option_id is provided
    if (!option_name && !option_id) {
      return res.status(400).json({ error: "Option name or ID is required" });
    }

    // If option_id is provided, update by ID, otherwise update by option_name
    let query = `UPDATE res_options SET option_value = ? WHERE `;
    let params = [option_value];

    if (option_id) {
      query += `option_id = ?`;
      params.push(option_id);
    } else if (option_name) {
      query += `option_name = ?`;
      params.push(option_name);
    }

    // Execute the update query
    const [updateResult] = await pool.execute(query, params);

    // Check if any row was affected (i.e., updated)
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Option not found" });
    }

    return res.status(200).json({ message: "Option updated successfully" });
  } catch (error) {
    console.error("Error updating option:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { getAllOptions, updateOption, addOption };
