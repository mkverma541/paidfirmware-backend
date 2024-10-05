var express = require('express');
var router = express.Router();

const TeamController = require('../../controllers/admin/teams');

router.get('/', TeamController.getTeamMembers);
router.get('/:id', TeamController.getTeamMember);
router.post('/create', TeamController.createTeamMember);
router.put('/update/:id', TeamController.updateTeamMember);
router.delete('/delete/:id', TeamController.deleteTeamMember);

module.exports = router;
