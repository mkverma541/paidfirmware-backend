const { pool, secretKey } = require("../config/database");

async function form(req, res) {
    const {
      name,
      email,
      phone,
      file,
    } = req.body;
  
    if (!name || !email || !phone || !file) {
      return res
        .status(400)
        .json({ error: "Name, Email, phone, and file are required" });
    }
  
    try {
      
      const insertQuery = `
        INSERT INTO applicationForm (
          name,
          email,
          phone,
          file
        ) VALUES (?, ?, ?, ?)
      `;
  
      await pool.execute(insertQuery, [
        name,
        email,
        phone,
        file
      ]);
  
      res.status(201).json({ message: "Application Form Submitted successfully" });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

async function list(req, res) {
  try {
    const [data] = await pool.execute("SELECT * FROM applicationForm");
    console.log(data);
    return res.status(200).json({
      data: data,
    });
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getById(req, res) {
  const applicationID = req.params.id;

  try {
    const [data] = await pool.execute("SELECT * FROM applicationForm WHERE id = ?", [applicationID]);

    if (data.length === 0) {
      return res.status(404).json({ error: "Party not found" });
    }

    return res.status(200).json({
      data: data[0], // Assuming you want to return a single party object
    });
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}




module.exports = { form, list, getById };
