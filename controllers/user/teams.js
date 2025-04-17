const { pool } = require("../../config/database");


async function getTeamMembers(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_team");

        // Map through the rows and format social_links as an array
        const teamMembers = rows.map(member => {
            let socialLinksArray = [];
            if (member.social_links) {
                try {
                    // Convert social_links JSON string to an object
                    const socialLinksObj = JSON.parse(member.social_links);

                    // Convert the social links object into an array
                    socialLinksArray = Object.keys(socialLinksObj).map(key => ({
                        platform: key,
                        url: socialLinksObj[key]
                    }));
                } catch (parseError) {
                    console.error("Error parsing social_links JSON:", parseError);
                }
            }

            return {
                ...member,
                social_links: socialLinksArray,
            };
        });

        res.status(200).json({
            data: teamMembers,
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
    getTeamMembers,
};
