const { pool } = require("../../config/database");

// Create a new team member
async function createTeamMember(req, res) {
  const connection = await pool.getConnection(); // Use transactions
  try {
    const { name, designation, email, photo, phone, gender, bio, address, country, social_links = [], status = true } = req.body;

    // Start transaction
    await connection.beginTransaction();

    // Get the current maximum position
    const [positionResult] = await connection.query(
      `SELECT IFNULL(MAX(position) + 1, 1) AS nextPosition FROM res_team`
    );
    const nextPosition = positionResult[0].nextPosition;

    // Insert team member
    const [result] = await connection.query(
      `INSERT INTO res_team (name, designation, email, photo, phone, gender, bio, address, country, status, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, designation, email, photo, phone, gender, bio, address, country, status, nextPosition]
    );

    const teamId = result.insertId;

    // Insert social links without IGNORE for debugging
    const socialLinkQueries = social_links.map(({ platform, url }) =>
      connection.query(
        `INSERT INTO res_team_social_links (team_id, platform, url) VALUES (?, ?, ?)`, // Removed IGNORE for debugging
        [teamId, platform, url]
      )
    );

    // Wait for all social link queries to be executed
    await Promise.all(socialLinkQueries);

    // Commit transaction
    await connection.commit();

    res.status(201).json({
      message: "Team member created successfully",        
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

async function getTeamMembers(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    // Fetch paginated team members
    const [teamRows] = await pool.query(
      `SELECT * FROM res_team ORDER BY position LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    if (!teamRows.length) {
      return res.status(200).json({
        response: { data: [] },
        total: 0,
        currentPage: page,
        totalPages: 0,
      });
    }

    // Fetch all social links
    const [socialLinksRows] = await pool.query(
      `SELECT team_id, platform, url FROM res_team_social_links`
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

    // Group social links by team_id with platform icons
    const socialLinksMap = socialLinksRows.reduce((map, { team_id, platform, url }) => {
      if (!map[team_id]) map[team_id] = [];
      map[team_id].push({
        platform,
        url,
        icon: iconsMap[platform] || null, // Add icon or default to null
      });
      return map;
    }, {});

    // Attach social links to the corresponding team members
    const response = teamRows.map((member) => ({
      ...member, // Include all team columns dynamically
      social_links: socialLinksMap[member.team_id] || [], // Attach social links
    }));

    // Fetch total team members count for pagination
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM res_team`);

    // Return paginated response
    res.status(200).json({
      response: { data: response },
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching team members:", err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

// Get a specific team member
async function getTeamMember(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM res_team WHERE team_id = ?",
      [req.params.id]
    );

    res.status(200).json({
      data: rows[0],
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

// update a team member

// Update an existing team member
async function updateTeamMember(req, res) {
  const connection = await pool.getConnection(); // Use transactions
  try {
    const { id } = req.params; // ID of the team member to update
    const {
      name,
      designation,
      email,
      photo,
      phone,
      gender,
      bio,
      address,
      country,
      social_links = [],
      status,
    } = req.body;

    // Start transaction
    await connection.beginTransaction();

    // Check if team member exists
    const [existingMember] = await connection.query(
      `SELECT team_id FROM res_team WHERE team_id = ?`,
      [id]
    );
    if (existingMember.length === 0) {
      throw new Error("Team member not found");
    }

    // Update team member information
    await connection.query(
      `UPDATE res_team SET name = ?, designation = ?, email = ?, photo = ?, phone = ?, gender = ?, bio = ?, address = ?, country = ?, status = ? WHERE team_id = ?`,
      [name, designation, email, photo, phone, gender, bio, address, country, status, id]
    );

    // Delete existing social links for the team member
    await connection.query(`DELETE FROM res_team_social_links WHERE team_id = ?`, [id]);

    // Insert updated social links
    const socialLinkQueries = social_links.map(({ platform, url }) =>
      connection.query(
        `INSERT INTO res_team_social_links (team_id, platform, url) VALUES (?, ?, ?)`,
        [id, platform, url]
      )
    );
    await Promise.all(socialLinkQueries);

    // Commit transaction
    await connection.commit();

    res.status(200).json({
      message: "Team member updated successfully",
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


// Delete a team member and update positions
async function deleteTeamMember(req, res) {
  try {
    const { id } = req.params;

    // Get the position of the team member being deleted
    const [rows] = await pool.query(
      "SELECT position FROM res_team WHERE team_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Team member not found",
        status: "error",
      });
    }

    const deletedPosition = rows[0].position;

    // Delete the team member
    await pool.query("DELETE FROM res_team WHERE team_id = ?", [id]);

    // Update positions of the remaining team members
    await pool.query(
      "UPDATE res_team SET position = position - 1 WHERE position > ?",
      [deletedPosition]
    );

    res.status(200).json({
      message: "Team member deleted successfully",
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
  createTeamMember,
  getTeamMembers,
  getTeamMember,
  updateTeamMember,
  deleteTeamMember,
};
