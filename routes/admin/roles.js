var express = require('express');
var router = express.Router();

const RolesController = require('../../controllers/admin/roles');

router.post('/create', RolesController.createRole);
router.get('/', RolesController.getRoles);  
router.put('/update/:roleId', RolesController.updateRole);
router.delete('/delete/:roleId', RolesController.deleteRole);

router.get('/:roleId', RolesController.getRoleById);
router.post('/:roleId/permissions', RolesController.assignPermissions);
router.get('/:roleId/permissions', RolesController.getPermissionsForRole);

module.exports = router;
 
