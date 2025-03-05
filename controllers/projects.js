const { pool } = require("../config/database");
async function generateProjectCode() {
  const [result] = await pool.query(
    "SELECT MAX(project_code) AS max_code FROM projects WHERE project_code REGEXP '^AC[0-9]{6}$'"
  );

  let newCode = 1001; // Start from 1001 if table is empty

  if (result[0].max_code) {
    // Extract the numeric part from the last project_code and increment it by 1
    newCode = parseInt(result[0].max_code.replace("AC", "")) + 1;
  }

  // Ensure the project code has 6 digits by padding with leading zeros if needed
  const formattedCode = newCode.toString().padStart(6, "0");

  return `AC${formattedCode}`;
}


async function createProject(req, res) {
  try {
    const {
      project_type,
      start_date,
      end_date,
      is_dynamic_thanks,
      group_project_name,
      group_project_description,
      project_name,
      project_manager,
      description,
      loi,
      ir,
      sample_size,
      respondent_click_quota,
      project_cpi,
      supplier_cpi,
      is_pre_screen,
      is_geo_location,
      is_unique_ip,
      unique_ip_count,
      is_speeder,
      speeder_count,
      is_exclude,
      is_dynamic_thanks_url,
      is_tsign,
      is_mobile,
      is_tablet,
      is_desktop,
      notes,
      client_id,
      country_code,
      language_code,
      project_category,
      currency,
    } = req.body;

    if (!project_name || !project_manager || !client_id || !country_code) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const project_code = await generateProjectCode();

    const query = `
      INSERT INTO projects (
        project_code, project_type, start_date, end_date, is_dynamic_thanks, group_project_name, group_project_description,
        project_name, project_manager, description, loi, ir, sample_size, respondent_click_quota, project_cpi, supplier_cpi,
        is_pre_screen, is_geo_location, is_unique_ip, unique_ip_count, is_speeder, speeder_count, is_exclude, is_dynamic_thanks_url,
        is_tsign, is_mobile, is_tablet, is_desktop, notes, client_id, country_code, language_code, project_category, currency
      ) VALUES
        (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    await pool.query(query, [
      project_code,
      project_type,
      start_date,
      end_date,
      is_dynamic_thanks,
      group_project_name,
      group_project_description,
      project_name,
      project_manager,
      description,
      loi,
      ir,
      sample_size,
      respondent_click_quota,
      project_cpi,
      supplier_cpi,
      is_pre_screen,
      is_geo_location,
      is_unique_ip,
      unique_ip_count,
      is_speeder,
      speeder_count,
      is_exclude,
      is_dynamic_thanks_url,
      is_tsign,
      is_mobile,
      is_tablet,
      is_desktop,
      notes,
      client_id,
      country_code,
      language_code,
      project_category,
      currency,
    ]);

    res.status(201).json({
      message: "Project has been added successfully",
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

async function getAllProjects(req, res) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM projects";
    let countQuery = "SELECT COUNT(*) AS total FROM projects";
    let params = [];

    if (search) {
      query += " WHERE project_name LIKE ? OR project_code LIKE ?";
      countQuery += " WHERE project_name LIKE ? OR project_code LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [projects] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const result = {
      total,
      totalPages,
      currentPage: parseInt(page),
      projects,
    };

    res.status(200).json({
      response: result,
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function getMappedSuppliers(req, res) {
  try {
    const { projectId } = req.params;

    const query = `
      SELECT ps.*, s.supplier_name, s.supplier_code, s.supplier_website, s.country, s.complete_link,
      s.terminate_link, s.over_quota_link, s.quality_term_link, s.survey_close_link, s.post_back_url
      FROM project_suppliers ps
      INNER JOIN suppliers s ON ps.supplier_id = s.supplier_id
      WHERE ps.project_id = ?
    `;

    const [suppliers] = await pool.query(query, [projectId]);

    res.status(200).json({ data: suppliers, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}


async function updateProjectSurveyLink(req, res) {
  const connection = await pool.getConnection();
  try {
    const { project_id, survey_test_link, survey_live_link } = req.body;

    if (!project_id) {
      return res.status(400).json({ message: "Project ID is missing", status: "error" });
    }

    // Start a transaction
    await connection.beginTransaction();

    // Update the survey links
    const updateQuery = `
      UPDATE projects SET survey_live_link = ?, survey_test_link = ? WHERE project_id = ?
    `;
    await connection.query(updateQuery, [survey_live_link, survey_test_link, project_id]);

    // Check if project supplier already exists
    const supplierExistsQuery = `SELECT COUNT(*) AS count FROM project_suppliers WHERE project_id = ?`;
    const [[{ count }]] = await connection.query(supplierExistsQuery, [project_id]);

    if (count === 0) {
      // Get the default supplier ID
      const supplierQuery = `SELECT supplier_id FROM suppliers WHERE is_default = 1 LIMIT 1`;
      const [[defaultSupplier]] = await connection.query(supplierQuery);

      if (!defaultSupplier) {
        throw new Error("Default supplier not found.");
      }

      // Insert new project supplier
      const insertSupplierQuery = `
        INSERT INTO project_suppliers (project_id, supplier_id, quota, click_quota, cpi, redirection_type) 
        VALUES (?, ?, 0, 0, 1, 1)
      `;
      await connection.query(insertSupplierQuery, [project_id, defaultSupplier.supplier_id]);
    }

    // Commit the transaction
    await connection.commit();

    res.status(200).json({ message: "Survey links updated successfully", status: "success" });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  } finally {
    connection.release();
  }
}


async function updateProject(req, res) {
  try {
    const { projectId } = req.params;
    const {
      project_type,
      start_date,
      end_date,
      is_dynamic_thanks,
      group_project_name,
      group_project_description,
      project_name,
      project_manager,
      description,
      loi,
      ir,
      sample_size,
      respondent_click_quota,
      project_cpi,
      supplier_cpi,
      is_pre_screen,
      is_geo_location,
      is_unique_ip,
      unique_ip_count,
      is_speeder,
      speeder_count,
      is_exclude,
      is_dynamic_thanks_url,
      is_tsign,
      is_mobile,
      is_tablet,
      is_desktop,
      notes,
      client_id,
      country_code,
      language_code,
      project_category,
      currency,
    } = req.body;

    if (!project_name || !project_manager || !client_id || !country_code) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const query = `
      UPDATE projects SET
        project_type = ?, start_date = ?, end_date = ?, is_dynamic_thanks = ?, group_project_name = ?, group_project_description = ?,
        project_name = ?, project_manager = ?, description = ?, loi = ?, ir = ?, sample_size = ?, respondent_click_quota = ?, project_cpi = ?, supplier_cpi = ?,
        is_pre_screen = ?, is_geo_location = ?, is_unique_ip = ?, unique_ip_count = ?, is_speeder = ?, speeder_count = ?, is_exclude = ?, is_dynamic_thanks_url = ?,
        is_tsign = ?, is_mobile = ?, is_tablet = ?, is_desktop = ?, notes = ?, client_id = ?, country_code = ?, language_code = ?, project_category = ?, currency = ?
      WHERE project_id = ?
    `;

    await pool.query(query, [
      project_type,
      start_date,
      end_date,
      is_dynamic_thanks,
      group_project_name,
      group_project_description,
      project_name,
      project_manager,
      description,
      loi,
      ir,
      sample_size,
      respondent_click_quota,
      project_cpi,
      supplier_cpi,
      is_pre_screen,
      is_geo_location,
      is_unique_ip,
      unique_ip_count,
      is_speeder,
      speeder_count,
      is_exclude,
      is_dynamic_thanks_url,
      is_tsign,
      is_mobile,
      is_tablet,
      is_desktop,
      notes,
      client_id,
      country_code,
      language_code,
      project_category,
      currency,
      projectId,
    ]);

    res.status(200).json({
      message: "Project has been updated successfully",
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

async function getProjectDetailsById(req, res) {
    try {
      const { projectId } = req.params;
      
      // Optimized query with JOINs for related tables
      const query = `
        SELECT 
          p.*, 
          c.client_name, 
          c.client_code,
          co.name AS country_name, 
          l.name AS language_name 
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.client_id
        LEFT JOIN countries co ON p.country_code = co.code
        LEFT JOIN languages l ON p.language_code = l.code
        WHERE p.project_id = ?;
      `;
  
      const [project] = await pool.query(query, [projectId]);
  
      if (project.length === 0) {
        return res
          .status(404)
          .json({ message: "Project not found", status: "error" });
      }
  
      res.status(200).json({ data: project[0], status: "success" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error", status: "error" });
    }
  }
  

module.exports = { createProject, getAllProjects, getProjectDetailsById, updateProject, updateProjectSurveyLink, getMappedSuppliers };
