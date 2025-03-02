const { pool } = require("../config/database");

async function generateProjectCode() {
  const [result] = await pool.query(
    "SELECT COUNT(project_id) AS count FROM projects"
  );
  const count = result[0].count + 1000;
  return `P${count}`;
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

    if (!project_name || !project_manager || !client_id || !country) {
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
  

module.exports = { createProject, getAllProjects, getProjectDetailsById };
