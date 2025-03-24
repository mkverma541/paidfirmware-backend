const { pool } = require("../../config/database");

/// Add a new agent with social links and position
async function addAgent(req, res) {
  const connection = await pool.getConnection(); // Use transactions
  try {
    const {
      name,
      phone,
      email,
      logo,
      description,
      address,
      country_code,
      status = true,
      social_links = [],
    } = req.body;

    // Start transaction
    await connection.beginTransaction();

    // Get the current maximum position
    const [positionResult] = await connection.query(
      `SELECT IFNULL(MAX(position) + 1, 1) AS nextPosition FROM res_agents`
    );
    const nextPosition = positionResult[0].nextPosition;

    // Insert the agent details
    const [result] = await connection.query(
      `INSERT INTO res_agents (name, phone, email, logo, description, address, country_code, status, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        phone,
        email,
        logo,
        description,
        address,
        country_code,
        status,
        nextPosition,
      ]
    );

    const agentId = result.insertId;

    // Insert the social links
    const socialLinkQueries = social_links.map(({ platform, url }) =>
      connection.query(
        `INSERT INTO res_agent_social_links (agent_id, platform, url) VALUES (?, ?, ?)`,
        [agentId, platform, url]
      )
    );

    await Promise.all(socialLinkQueries);

    // Commit transaction
    await connection.commit();

    res.status(201).json({
      message: "Agent created successfully",
      status: "success",
    });
  } catch (err) {
    await connection.rollback(); // Rollback transaction on error
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  } finally {
    connection.release();
  }
}

async function getAgents(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    // Fetch paginated agents
    const [agentRows] = await pool.query(
      `SELECT * FROM res_agents ORDER BY position LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    if (!agentRows.length) {
      return res.status(200).json({
        response: { data: [] },
        total: 0,
        currentPage: page,
        totalPages: 0,
      });
    }

    // Fetch all social links
    const [socialLinksRows] = await pool.query(
      `SELECT agent_id, platform, url FROM res_agent_social_links`
    );

    // Fetch social platform icons
    const [iconsRows] = await pool.query(
      `SELECT platform, icon FROM res_social_platforms`
    );

    // Create a map of icons for quick lookup
    const iconsMap = iconsRows.reduce((map, { platform, icon }) => {
      map[platform] = icon;
      return map;
    }, {});

    // Group social links by agent_id with platform icons
    const socialLinksMap = socialLinksRows.reduce((map, { agent_id, platform, url }) => {
      if (!map[agent_id]) map[agent_id] = [];
      map[agent_id].push({
        platform,
        url,
        icon: iconsMap[platform] || null, // Add icon or default to null
      });
      return map;
    }, {});

    console.log(socialLinksMap, "socialLinksMap");  
    
    console.log(agentRows, "agentRows");
    // Attach social links to the corresponding agents
    const response = agentRows.map((agent) => ({
      ...agent, // Include all agent columns dynamically
      social_links: socialLinksMap[agent.agent_id] || [], // Attach social links
    }));

    // Fetch total agent count for pagination
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM res_agents`);

    console.log(response, "response11");
    // Return paginated response
    res.status(200).json({
      response: { data: response },
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching agents:", err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

// Update an agent and their social links
async function updateAgent(req, res) {
  const connection = await pool.getConnection(); // Use transactions
  try {
    const { id } = req.params; // ID of the agent to update
    const {
      name,
      phone,
      email,
      logo,
      description,
      address,
      country_code,
      social_links = [],
      status,
    } = req.body;

    // Start transaction
    await connection.beginTransaction();

    // Check if agent exists
    const [existingAgent] = await connection.query(
      `SELECT agent_id FROM res_agents WHERE agent_id = ?`,
      [id]
    );
    if (existingAgent.length === 0) {
      throw new Error("Agent not found");
    }

    // Update agent information
    await connection.query(
      `UPDATE res_agents SET name = ?, phone = ?, email = ?, logo = ?, description = ?, address = ?, country_code = ?, status = ? WHERE agent_id = ?`,
      [name, phone, email, logo, description, address, country_code, status, id]
    );

    // Delete existing social links for the agent
    await connection.query(`DELETE FROM res_agent_social_links WHERE agent_id = ?`, [id]);

    // Insert updated social links
    const socialLinkQueries = social_links.map(({ platform, url }) =>
      connection.query(
        `INSERT INTO res_agent_social_links (agent_id, platform, url) VALUES (?, ?, ?)`,
        [id, platform, url]
      )
    );
    await Promise.all(socialLinkQueries);

    // Commit transaction
    await connection.commit();

    res.status(200).json({
      message: "Agent updated successfully",
      status: "success",
    });
  } catch (err) {
    await connection.rollback(); // Rollback transaction on error
    console.error(err.message);
    res.status(500).json({
      message: err.message || "Internal server error",
      status: "error",
    });
  } finally {
    connection.release();
  }
}


// Delete an agent
async function deleteAgent(req, res) {
  try {
    const { id } = req.params;

    const query = `
            DELETE FROM res_agents
            WHERE agent_id = ?
        `;
    await pool.query(query, [id]);

    res.status(200).json({
      message: "Agent deleted successfully",
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
  addAgent,
  getAgents,
  updateAgent,
  deleteAgent,
};
