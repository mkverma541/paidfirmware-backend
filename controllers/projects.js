const { pool } = require("../config/database");
const { v4: uuidv4 } = require("uuid");

async function generateGroupProjectCode() {
  const [result] = await pool.query(
    "SELECT MAX(project_code) AS max_code FROM group_projects WHERE project_code REGEXP '^ADR[0-9]{4}$'"
  );

  let newCode = 1; // Start from 1 if table is empty

  if (result[0].max_code) {
    // Extract the numeric part from the last project_code and increment it by 1
    newCode = parseInt(result[0].max_code.replace("ADR", "")) + 1;
  }

  // Ensure the project code has 3 digits by padding with leading zeros if needed
  const formattedCode = newCode.toString().padStart(3, "0");
  return `ADR${formattedCode}`;
}

async function generateProjectCode() {
  const [result] = await pool.query(
    "SELECT MAX(project_code) AS max_code FROM projects WHERE project_code REGEXP '^ADR[0-9]{6}$'"
  );

  let newCode = 1; // Start from 1 if table is empty

  if (result[0].max_code) {
    // Extract the numeric part from the last project_code and increment it by 1
    newCode = parseInt(result[0].max_code.replace("ADR", "")) + 1;
  }

  // Ensure the project code has 3 digits by padding with leading zeros if needed
  const formattedCode = newCode.toString().padStart(3, "0");
  return `ADR${formattedCode}`;
}

async function createProject(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Parse and validate request body
    const {
      project_type,
      client_id,
      start_date,
      end_date,
      country_code,
      language_code,
      project_category,
      currency,
    } = req.body;

    // Required fields validation
    if (
      !req.body.project_name ||
      !req.body.project_manager ||
      !client_id ||
      !country_code
    ) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const [[defaultSupplier]] = await connection.query(
      `SELECT supplier_id FROM suppliers WHERE is_default = 1 LIMIT 1`
    );

    if (!defaultSupplier) {
      throw new Error("Default supplier not found.");
    }

    // Clean and convert values
    const group_project_name = req.body.group_project_name?.trim() || null;
    const group_project_description =
      req.body.group_project_description?.trim() || "";
    const project_name = req.body.project_name?.trim();
    const project_manager = req.body.project_manager?.trim();
    const description = req.body.description?.trim() || null;
    const notes = req.body.notes?.trim() || null;

    const loi = Number(req.body.loi) || 0;
    const ir = Number(req.body.ir) || 0;
    const sample_size = Number(req.body.sample_size) || 0;
    const respondent_click_quota = Number(req.body.respondent_click_quota) || 0;
    const project_cpi = Number(req.body.project_cpi) || 0;
    const supplier_cpi = Number(req.body.supplier_cpi) || 0;
    const unique_ip_count = Number(req.body.unique_ip_count) || 0;
    const speeder_count = Number(req.body.speeder_count) || 0;

    const is_dynamic_thanks = req.body.is_dynamic_thanks === "on" ? 1 : 0;
    const is_pre_screen = req.body.is_pre_screen === "on" ? 1 : 0;
    const is_exclude = req.body.is_exclude === "on" ? 1 : 0;
    const is_dynamic_thanks_url =
      req.body.is_dynamic_thanks_url === "on" ? 1 : 0;
    const is_tsign = req.body.is_tsign === "on" ? 1 : 0;

    const is_geo_location = req.body.is_geo_location ? 1 : 0;
    const is_unique_ip = req.body.is_unique_ip ? 1 : 0;
    const is_speeder = req.body.is_speeder ? 1 : 0;
    const is_mobile = req.body.is_mobile ? 1 : 0;
    const is_tablet = req.body.is_tablet ? 1 : 0;
    const is_desktop = req.body.is_desktop ? 1 : 0;

    let group_project_code;
    let project_code;
    let groupProjectId = null;

    if (project_type === "group") {
      group_project_code = await generateGroupProjectCode();
      project_code = `${group_project_code}01`;

      const groupProjectQuery = `
        INSERT INTO group_projects (project_code, project_name, project_description, client_id)
        VALUES (?, ?, ?, ?)
      `;

      const [insertGroupProjectId] = await connection.query(groupProjectQuery, [
        group_project_code,
        group_project_name,
        group_project_description,
        client_id,
      ]);

      groupProjectId = insertGroupProjectId.insertId;
    } else {
      project_code = await generateProjectCode();
      group_project_code = null;
    }

    const query = `
      INSERT INTO projects (
        project_code, project_type, start_date, end_date, is_dynamic_thanks, group_project_id,
        project_name, project_manager, description, loi, ir, sample_size, respondent_click_quota, 
        project_cpi, supplier_cpi, is_pre_screen, is_geo_location, is_unique_ip, unique_ip_count, 
        is_speeder, speeder_count, is_exclude, is_dynamic_thanks_url, is_tsign, is_mobile, 
        is_tablet, is_desktop, notes, client_id, supplier_id, country_code, language_code, project_category, 
        currency, status, survey_live_link, survey_test_link, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [insertResult] = await connection.query(query, [
      project_code,
      project_type,
      start_date,
      end_date,
      is_dynamic_thanks,
      groupProjectId,
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
      defaultSupplier.supplier_id,
      country_code,
      language_code,
      project_category,
      currency,
      1, // Default status
      null, // survey_live_link
      null, // survey_test_link
    ]);

    const project_id = insertResult.insertId;
  
    const stid = uuidv4().replace(/-/g, "").substring(0, 8);

    await connection.query(
      `INSERT INTO project_suppliers (project_id, supplier_id, quota, click_quota, cpi, redirection_type, stid) VALUES (?, ?, 0, 0, 0, 1, ?)`,
      [project_id, defaultSupplier.supplier_id, stid]
    );

    await connection.commit();
    res.status(201).json({
      message: "Project added successfully",
      status: "success",
      project_id: project_id,
    });
  } catch (err) {
    console.error(err);
    await connection.rollback();
    res.status(500).json({ message: "Internal server error", status: "error" });
  } finally {
    connection.release();
  }
}

async function getGroupProjectDetails(req, res) {
  try {
    const { group_project_id } = req.query;

    const query = `
      SELECT
        gp.*,
        c.client_name,
        c.client_code
      FROM group_projects gp
      INNER JOIN clients c ON gp.client_id = c.client_id
      WHERE gp.project_id = ?
    `;

    const [groupProject] = await pool.query(query, [group_project_id]);

    if (groupProject.length === 0) {
      return res
        .status(404)
        .json({ message: "Group project not found", status: "error" });
    }

    res.status(200).json({ data: groupProject[0], status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function getProjectSurveyLinks(req, res) {
  try {
    const { projectId } = req.params;

    const query = `
      SELECT p.survey_live_link, p.survey_test_link, ps.stid 
      FROM projects p
      LEFT JOIN project_suppliers ps ON p.project_id = ps.project_id
      WHERE p.project_id = ?
    `;

    const [[surveyLinks]] = await pool.query(query, [projectId]);

    res.status(200).json({ data: surveyLinks, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function updateGroupProject(req, res) {
  try {
    const { project_name, project_description, notes, project_id, status } =
      req.body;

    if (!project_name || !project_id) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const query = `
    UPDATE group_projects SET
      project_name = ?, project_description = ?, notes = ?, status = ? 
    WHERE project_id = ?
  `;

    await pool.query(query, [
      project_name,
      project_description,
      notes,
      Number(status),
      project_id,
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

async function getProjectById(req, res) {
  const { project_id } = req.query;

  try {
    const query = `
    SELECT
      p.*,
      gp.project_name AS group_project_name,
      gp.project_code AS group_project_code,
      gp.project_id AS group_project_id,
      gp.project_description AS group_project_description,
      gp.notes AS group_project_notes,
      gp.status AS group_project_status,
      gp.project_code AS group_project_code,
      l.name AS language_name,
      c.client_name,
      c.client_code,
      co.name AS country_name
    FROM projects p
    LEFT JOIN group_projects gp ON p.group_project_id = gp.project_id
    INNER JOIN clients c ON p.client_id = c.client_id
    INNER JOIN countries co ON p.country_code = co.code
    INNER JOIN languages l ON p.language_code = l.code
    WHERE p.project_id = ?
  `;

    const [project] = await pool.query(query, [project_id]);

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

async function getProjectStatusCounts(req, res) {
  try {
    // Query to get project status counts
    const statusCountQuery = `
      SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive_count,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS invoiced_count,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS closed_count
      FROM group_projects
    `;

    const [[statusCounts]] = await pool.query(statusCountQuery);

    res.status(200).json({
      status: "success",
      data: {
        total: statusCounts.total_count || 0,
        active: statusCounts.active_count || 0,
        inactive: statusCounts.inactive_count || 0,
        invoiced: statusCounts.invoiced_count || 0,
        closed: statusCounts.closed_count || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
}

async function addChildProject(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Parse and validate request body
    const {
      group_project_id,
      client_id,
      start_date,
      end_date,
      country_code,
      language_code,
      project_category,
      currency,
    } = req.body;

    // Required fields validation
    if (
      !req.body.project_name ||
      !req.body.project_manager ||
      !client_id ||
      !country_code
    ) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    // Clean and convert values
    const project_name = req.body.project_name?.trim();
    const project_manager = req.body.project_manager?.trim();
    const description = req.body.description?.trim() || null;
    const notes = req.body.notes?.trim() || null;

    const loi = Number(req.body.loi) || 0;
    const ir = Number(req.body.ir) || 0;
    const sample_size = Number(req.body.sample_size) || 0;
    const respondent_click_quota = Number(req.body.respondent_click_quota) || 0;
    const project_cpi = Number(req.body.project_cpi) || 0;
    const supplier_cpi = Number(req.body.supplier_cpi) || 0;
    const unique_ip_count = Number(req.body.unique_ip_count) || 0;
    const speeder_count = Number(req.body.speeder_count) || 0;

    const is_dynamic_thanks = req.body.is_dynamic_thanks === "on" ? 1 : 0;
    const is_pre_screen = req.body.is_pre_screen === "on" ? 1 : 0;
    const is_exclude = req.body.is_exclude === "on" ? 1 : 0;
    const is_dynamic_thanks_url =
      req.body.is_dynamic_thanks_url === "on" ? 1 : 0;
    const is_tsign = req.body.is_tsign === "on" ? 1 : 0;

    const is_geo_location = req.body.is_geo_location ? 1 : 0;
    const is_unique_ip = req.body.is_unique_ip ? 1 : 0;
    const is_speeder = req.body.is_speeder ? 1 : 0;
    const is_mobile = req.body.is_mobile ? 1 : 0;
    const is_tablet = req.body.is_tablet ? 1 : 0;
    const is_desktop = req.body.is_desktop ? 1 : 0;

    // check if group project exists

    const [[groupProject]] = await connection.query(
      `SELECT * FROM group_projects WHERE project_id = ?`,
      [group_project_id]
    );

    if (!groupProject) {
      return res.status(404).json({
        message: "Group project not found",
        status: "error",
      });
    }

    // check total child projects count

    // basically if last added projected is AC000101 then next child project code will be AC000102
    const [childProjectCount] = await connection.query(
      `SELECT COUNT(*) AS count FROM projects WHERE group_project_id = ?`,
      [group_project_id]
    );

    const [latestChildProject] = await connection.query(
      `SELECT project_code FROM projects WHERE group_project_id = ? ORDER BY project_code DESC LIMIT 1`,
      [group_project_id]
    );

    let project_code;

    const latestCode = latestChildProject[0].project_code;
    const numericPart = latestCode.match(/\d+/);
    const prefix = latestCode.match(/[A-Za-z]+/);

    if (numericPart && prefix) {
      const nextNumber = parseInt(numericPart[0], 10) + 1;
      project_code = `${prefix[0]}${nextNumber.toString().padStart(5, "0")}`;
    } else {
      throw new Error("Invalid project code format.");
    }

    const [[defaultSupplier]] = await connection.query(
      `SELECT supplier_id FROM suppliers WHERE is_default = 1 LIMIT 1`
    );

    if (!defaultSupplier) {
      throw new Error("Default supplier not found.");
    }

    const supplier_id = defaultSupplier.supplier_id;

    const query = `
      INSERT INTO projects (
      project_code, project_type, start_date, end_date, is_dynamic_thanks, group_project_id,
      project_name, project_manager, description, loi, ir, sample_size, respondent_click_quota, 
      project_cpi, supplier_cpi, is_pre_screen, is_geo_location, is_unique_ip, unique_ip_count, 
      is_speeder, speeder_count, is_exclude, is_dynamic_thanks_url, is_tsign, is_mobile, 
      is_tablet, is_desktop, notes, client_id, supplier_id, country_code, language_code, project_category, 
      currency, status, survey_live_link, survey_test_link, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [insertResult] = await connection.query(query, [
      project_code,
      "group",
      start_date,
      end_date,
      is_dynamic_thanks,
      group_project_id,
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
      supplier_id,
      country_code,
      language_code,
      project_category,
      currency,
      1, // Default status
      null, // survey_live_link
      null, // survey_test_link
    ]);

    const project_id = insertResult.insertId;

  

    const stid = uuidv4().replace(/-/g, "").substring(0, 8);

    await connection.query(
      `INSERT INTO project_suppliers (project_id, supplier_id, quota, click_quota, cpi, redirection_type, stid) VALUES (?, ?, 0, 0, 1, ?, ?)`,
      [project_id, defaultSupplier.supplier_id, 1, stid]
    );

    await connection.commit();
    res
      .status(201)
      .json({ message: "Project added successfully", status: "success" });
  } catch (err) {
    console.error(err);
    await connection.rollback();
    res.status(500).json({ message: "Internal server error", status: "error" });
  } finally {
    connection.release();
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

async function addSupplierToProject(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      project_id,
      supplier_id,
      click_quota = 0,
      cpi = 0,
      redirection_type = null,
    } = req.body;

    // Validate mandatory fields
    if (!project_id || !supplier_id) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    // generate unique hash Id

    const stid = uuidv4().replace(/-/g, "").substring(0, 8);

    const query = `
      INSERT INTO project_suppliers (project_id, supplier_id, quota, click_quota, cpi, redirection_type, stid)
      VALUES (?, ?, 0, ?, ?, ?, ? )
    `;

    await connection.query(query, [
      project_id,
      Number(supplier_id),
      Number(click_quota),
      Number(cpi),
      Number(redirection_type) || null,
      stid,
    ]);

    await connection.commit();

    return res.status(201).json({
      message: "Supplier added to project successfully",
      status: "success",
    });
  } catch (err) {
    console.error("Error adding supplier to project:", err);
    await connection.rollback();

    return res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  } finally {
    if (connection) connection.release();
  }
}

async function updateSupplierInProject(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      project_id,
      supplier_id,
      ...updateFields // Extract all fields except project_id & supplier_id
    } = req.body;

    // Validate mandatory fields
    if (!project_id || !supplier_id) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    // Filter out undefined or null values
    const keys = Object.keys(updateFields).filter(
      (key) => updateFields[key] !== undefined && updateFields[key] !== null
    );

    if (keys.length === 0) {
      return res.status(400).json({
        message: "No valid fields to update",
        status: "error",
      });
    }

    // Build dynamic update query
    const updateQuery = `
      UPDATE project_suppliers 
      SET ${keys.map((key) => `${key} = ?`).join(", ")}
      WHERE project_id = ? AND supplier_id = ?
    `;

    const values = [
      ...keys.map((key) => updateFields[key]),
      project_id,
      supplier_id,
    ];

    await connection.query(updateQuery, values);
    await connection.commit();

    return res.status(200).json({
      message: "Supplier project updated successfully",
      status: "success",
    });
  } catch (err) {
    console.error("Error updating supplier project:", err);
    await connection.rollback();

    return res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  } finally {
    if (connection) connection.release();
  }
}

async function updateProjectSurveyLink(req, res) {
  const connection = await pool.getConnection();
  try {
    const { project_id, survey_test_link, survey_live_link } = req.body;

    if (!project_id) {
      return res
        .status(400)
        .json({ message: "Project ID is missing", status: "error" });
    }

    // Start a transaction
    await connection.beginTransaction();

    // Update the survey links
    const updateQuery = `
      UPDATE projects SET survey_live_link = ?, survey_test_link = ? WHERE project_id = ?
    `;
    await connection.query(updateQuery, [
      survey_live_link,
      survey_test_link,
      project_id,
    ]);

    // Check if project supplier already exists
    const supplierExistsQuery = `SELECT COUNT(*) AS count FROM project_suppliers WHERE project_id = ?`;
    const [[{ count }]] = await connection.query(supplierExistsQuery, [
      project_id,
    ]);

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
      await connection.query(insertSupplierQuery, [
        project_id,
        defaultSupplier.supplier_id,
      ]);
    }

    // Commit the transaction
    await connection.commit();

    res.status(200).json({
      message: "Survey links updated successfully",
      status: "success",
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  } finally {
    connection.release();
  }
}

async function updateChildProjectStatus(req, res) {
  try {
    const { project_id, status } = req.body;

    if (!project_id || !status) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const query = `
      UPDATE projects SET status = ? WHERE project_id = ?
    `;

    await pool.query(query, [status, project_id]);

    res.status(200).json({
      message: "Project status has been updated successfully",
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

async function updateChildProject(req, res) {
  try {
    const {
      project_type,
      start_date,
      end_date,
      project_name,
      is_dynamic_thanks,
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
      project_id,
    } = req.body;

    if (!project_name || !project_manager || !client_id || !country_code) {
      return res.status(400).json({
        message: "Mandatory fields are missing",
        status: "error",
      });
    }

    const query = `
      UPDATE projects SET
        project_type = ?, start_date = ?, end_date = ?, is_dynamic_thanks = ?, 
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
      project_id,
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

module.exports = {
  createProject,
  getGroupProjectDetails,
  updateChildProject,
  updateProjectSurveyLink,
  getMappedSuppliers,
  addSupplierToProject,
  getProjectStatusCounts,
  getProjectById,
  addChildProject,
  updateGroupProject,
  getProjectSurveyLinks,
  updateSupplierInProject,
  updateChildProjectStatus,
};
