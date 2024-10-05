const { pool } = require("../../config/database");


async function getTeamMembers(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM res_team");

        // Map through the rows and format social_links as an array
        const teamMembers = rows.map(member => {
            // Convert social_links JSON string to an object
            const socialLinksObj = JSON.parse(member.social_links);

            // Convert the social links object into an array
            const socialLinksArray = Object.keys(socialLinksObj).map(key => ({
                platform: key,
                url: socialLinksObj[key]
            }));

            return {
                name: member.name,
                role: member.role,
                photo: member.photo,
                video: member.video,
                social_links: socialLinksArray,
                position: member.position,
            
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
