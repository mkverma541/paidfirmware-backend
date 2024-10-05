const { pool } = require("../../config/database");

async function getAgents(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM res_agents");

    // Map through the rows and format social_links as an object
    const agents = rows.map((agent) => {
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

module.exports = {
  getAgents,
};
