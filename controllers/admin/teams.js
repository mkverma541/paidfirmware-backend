const { pool } = require("../../config/database");

// Create a new team member

async function createTeamMember(req, res) {
    try {
        const { name, role, photo, video, social_links, position } = req.body;

        // Convert social_links object to JSON string
        const socialLinksString = JSON.stringify(social_links);

        const query = `
            INSERT INTO res_team (name, role, photo, video, social_links, position)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await pool.query(query, [name, role, photo, video, socialLinksString, position]);

        res.status(201).json({
            message: "Team member created successfully",
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

// Get all team members with pagination
async function getTeamMembers(req, res) {
    try {
        // Extract `page` and `limit` from query parameters, with default values.
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // Calculate the `offset` for pagination.
        const offset = (page - 1) * limit;

        // Fetch the paginated team members.
        const [rows] = await pool.query(
            "SELECT * FROM res_team LIMIT ? OFFSET ?",
            [limit, offset]
        );

        // Get the total number of records for pagination metadata.
        const [[{ total }]] = await pool.query(
            "SELECT COUNT(*) AS total FROM res_team"
        );

        // Map through the rows and format `social_links` as an array.
        const teamMembers = rows.map(member => {
            // Convert `social_links` JSON string to an object.
            const socialLinksObj = JSON.parse(member.social_links);

            // Convert the social links object into an array.
            const socialLinksArray = Object.keys(socialLinksObj).map(key => ({
                platform: key,
                url: socialLinksObj[key]
            }));

            return {
                team_id: member.team_id,
                name: member.name,
                role: member.role,
                photo: member.photo,
                video: member.video,
                social_links: socialLinksArray,
                position: member.position,
            };
        });

        let response = {
            data: teamMembers,
            status: "success",
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }

        // Send the paginated results along with metadata.
        res.status(200).json({
            response: response,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            status: "error",
        });
    }
}



// Get a specific team member
async function getTeamMember(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_team WHERE team_id = ?", [
            req.params.id,
        ]);

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

// Update an existing team member
async function updateTeamMember(req, res) {
    try {
        const { id } = req.params;
        const { name, role, photo, video, social_links, position } = req.body;

        // Convert social_links array to JSON string
        const socialLinksJson = JSON.stringify(social_links);

        const query = `
            UPDATE res_team
            SET name = ?, role = ?, photo = ?, video = ?, social_links = ?, position = ?
            WHERE team_id = ?
        `;
        await pool.query(query, [name, role, photo, video, socialLinksJson, position, id]);

        res.status(200).json({
            message: "Team member updated successfully",
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

// Delete a team member
async function deleteTeamMember(req, res) {
    try {
        const { id } = req.params;

        await pool.query("DELETE FROM res_team WHERE team_id = ?", [id]);

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
