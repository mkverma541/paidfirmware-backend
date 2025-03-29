const { pool } = require("../config/database");

// Helper function: Execute query with parameters
const executeQuery = async (query, params) => {
  const [results] = await pool.query(query, params);
  return results;
};

// Fetch projects with filtering, sorting, and pagination
const getProjects = async (req) => {
  let { search, status, page = 1, limit = 10 } = req.query;
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  const offset = (page - 1) * limit;

  const queryParams = [];
  let whereClause = "WHERE 1=1";

  if (search?.trim()) {
    whereClause += " AND (p.project_name LIKE ? OR p.project_code LIKE ?)";
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  if (status?.trim()) {
    whereClause += " AND gp.status = ?";
    queryParams.push(status);
  }

  const projectQuery = `
    SELECT 
      p.*, gp.project_name AS group_project_name, gp.project_code AS group_project_code, 
      gp.project_id AS group_project_id, gp.status AS group_status, 
      c.client_name, c.client_code, co.name AS country_name
    FROM projects p
    LEFT JOIN group_projects gp ON p.group_project_id = gp.project_id
    INNER JOIN clients c ON p.client_id = c.client_id
    INNER JOIN countries co ON p.country_code = co.code
    ${whereClause}
    ORDER BY COALESCE(gp.status, 0) DESC, p.created_at DESC
    LIMIT ? OFFSET ?`;

  queryParams.push(limit, offset);

  const projects = await executeQuery(projectQuery, queryParams);

  const countQuery = `
    SELECT COUNT(*) AS total_count
    FROM projects p
    LEFT JOIN group_projects gp ON p.group_project_id = gp.project_id
    INNER JOIN clients c ON p.client_id = c.client_id
    INNER JOIN countries co ON p.country_code = co.code
    ${whereClause}`;

  const [{ total_count }] = await executeQuery(countQuery, queryParams.slice(0, -2));

  return { projects, total_count, page, limit };
};

// Fetch status and total click counts
const getStatusClickCounts = async () => {
    const query = `
      SELECT 
        pr.project_id, pr.status, COUNT(*) AS count,
        (SELECT COUNT(*) FROM project_report WHERE project_id = pr.project_id) AS total_click
      FROM project_report pr
      GROUP BY pr.project_id, pr.status`;
  
    const statusResults = await executeQuery(query, []);
  
    const statusMap = new Map();
  
    statusResults.forEach((row) => {
      if (!statusMap.has(row.project_id)) {
        statusMap.set(row.project_id, {
          total_click: row.total_click || 0
        });
      }
  
      const projectStatus = statusMap.get(row.project_id);
      projectStatus[row.status] = row.count;  // Use status directly as key
    });
  
    return statusMap;
  };
  

// Aggregate child project statuses
const aggregateStatusCounts = (childProjects) => {
  const aggregatedCounts = {
    duplicate_ip: 0,
    geo_ip_mismatch: 0,
    drop_out: 0,
    over_quota: 0,
    complete: 0,
    terminate: 0,
    quality_terminate: 0,
    survey_closed: 0,
    test_link: 0,
    total_click: 0,
  };

  childProjects.forEach((child) => {
    Object.entries(child.status_counts).forEach(([key, count]) => {
      aggregatedCounts[key] += count;
    });
  });

  return aggregatedCounts;
};

// Calculate median
const calculateMedian = (arr) => {
  if (!arr.length) return 0;
  arr.sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
};

// Main handler function
const getAllProjects = async (req, res) => {
  try {
    const { projects, total_count, page, limit } = await getProjects(req);
    const statusMap = await getStatusClickCounts();

    // Group projects by parent ID
    const groupedProjects = new Map();

    projects.forEach((project) => {
      const childStatusCounts = statusMap.get(project.project_id) || {
        duplicate_ip: 0,
        geo_ip_mismatch: 0,
        drop_out: 0,
        over_quota: 0,
        complete: 0,
        terminate: 0,
        quality_terminate: 0,
        survey_closed: 0,
        test_link: 0,
        total_click: 0,
      };

      const projectData = {
        project_id: project.project_id,
        project_code: project.project_code,
        project_name: project.project_name,
        client_name: project.client_name,
        client_code: project.client_code,
        country_name: project.country_name,
        status: project.status,
        created_at: project.created_at,
        updated_at: project.updated_at,
        field_ir: project.ir || 0,
        conversion_rate: project.cr || 0,
        drop_out_rate: project.dr || 0,
        median_loi: project.loi || 0,
        cpi_percent: parseFloat(project.project_cpi) || 0,
        pre_screen: project.pre_screen || 0,
        child_projects: [],
        status_counts: childStatusCounts,
      };

      if (project.group_project_id) {
        if (!groupedProjects.has(project.group_project_id)) {
          groupedProjects.set(project.group_project_id, {
            ...projectData,
            project_id: project.group_project_id,
            project_code: project.group_project_code,
            project_name: project.group_project_name,
            status: project.group_status,
            child_projects: [],
            status_counts: aggregateStatusCounts([]),
          });
        }

        groupedProjects.get(project.group_project_id).child_projects.push(projectData);
      } else {
        groupedProjects.set(project.project_id, projectData);
      }
    });

    const resultProjects = Array.from(groupedProjects.values()).map((project) => {
      const loiArray = project.child_projects.map((c) => c.median_loi).filter((loi) => loi > 0);

      project.status_counts = aggregateStatusCounts(project.child_projects);
      project.median_loi = calculateMedian(loiArray);

      return project;
    });

    res.status(200).json({
      data: resultProjects,
      status: "success",
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(total_count / limit),
        totalItems: total_count,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", status: "error" });
  }
};

module.exports = { getAllProjects };
