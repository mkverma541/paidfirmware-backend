const { pool } = require("../../config/database");

// Create a new agent
async function createAgent(req, res) {
    try {
        const { agent_name, country, logo, address, phone, email, social_links } = req.body;

        // Convert socialProfiles object to JSON string
        const socialProfilesString = JSON.stringify(social_links);

        const query = `
            INSERT INTO res_agents (agent_name, country, logo, address, phone, email, social_links)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await pool.query(query, [agent_name, country, logo, address, phone, email, socialProfilesString]);

        res.status(201).json({
            message: "Agent created successfully",
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

// Get all agents

async function getAgents(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_agents");

        // Map through the rows and format social_links as an object
        const agents = rows.map(agent => {
            // Convert social_links JSON string to an object
            const socialLinksObj = JSON.parse(agent.social_links);

            return {
                agent_id: agent.agent_id,
                agent_name: agent.agent_name,
                country: agent.country,
                logo: agent.logo,
                address: agent.address,
                phone: agent.phone,
                email: agent.email,
                social_links: socialLinksObj,
            };
        });

        res.status(200).json({
            data: agents,
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

// Update an agent

async function updateAgent(req, res) {
    try {
        const { id } = req.params;
        const { agent_name, country, logo, address, phone, email,  social_links } = req.body;

        // Convert social_links object to JSON string
        const socialLinksString = JSON.stringify(social_links);

        const query = `
            UPDATE res_agents
            SET agent_name = ?, country = ?, logo = ?, address = ?, phone = ? , email = ?,  social_links = ?
            WHERE agent_id = ?
        `;
        await pool.query(query, [agent_name, country, logo, address, phone, email, socialLinksString, id]);

        res.status(200).json({
            message: "Agent updated successfully",
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
    createAgent,
    getAgents,
    updateAgent,
    deleteAgent,
};
