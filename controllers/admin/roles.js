const { pool } = require("../../config/database");

// Create a new role
async function createRole(req, res) {
  const { role_name, description } = req.body;

  if (!role_name) {
    return res.status(400).json({
      message: "Role name is required",
      status: "error",
    });
  }

  try {
    // Check if role already exists

    const [existingRoles] = await pool.query(
      "SELECT * FROM res_roles WHERE role_name = ?",
      [role_name]
    );

    if (existingRoles.length > 0) {
      return res.status(400).json({
        message: "Role already exists",
        status: "error",
      });
    }

    const [result] = await pool.query(
      "INSERT INTO res_roles (role_name, description) VALUES (?, ?)",
      [role_name, description]
    );

    res.status(201).json({
      message: "Role created successfully",
      status: "success",
      role_id: result.insertId,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error creating role",
      status: "error",
    });
  }
}

// Get all roles
async function getRoles(req, res) {
  try {
    const [roles] = await pool.query("SELECT * FROM res_roles");

    res.status(200).json({
      data: roles,
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error fetching roles",
      status: "error",
    });
  }
}

// Get a single role by ID
async function getRoleById(req, res) {
  const { roleId } = req.params;

  try {
    const [roles] = await pool.query("SELECT * FROM roles WHERE role_id = ?", [
      roleId,
    ]);

    if (roles.length === 0) {
      return res.status(404).json({
        message: "Role not found",
        status: "error",
      });
    }

    res.status(200).json({
      data: roles[0],
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error fetching role",
      status: "error",
    });
  }
}

// Update a role
async function updateRole(req, res) {
  const { roleId } = req.params;
  const { role_name, description } = req.body;

  try {
    // Check if role already exists
    const [existingRoles] = await pool.query(
      "SELECT * FROM res_roles WHERE role_name = ? AND role_id != ?",
      [role_name, roleId]
    );

    if (existingRoles.length > 0) {
      return res.status(400).json({
        message: "Role already exists",
        status: "error",
      });
    }

    const [result] = await pool.query(
      "UPDATE res_roles SET role_name = ?, description = ? WHERE role_id = ?",
      [role_name, description, roleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Role not found",
        status: "error",
      });
    }

    res.status(200).json({
      message: "Role updated successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error updating role",
      status: "error",
    });
  }
}

// Delete a role
async function deleteRole(req, res) {
  const { roleId } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM res_roles WHERE role_id = ?", [
      roleId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Role not found",
        status: "error",
      });
    }

    res.status(200).json({
      message: "Role deleted successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error deleting role",
      status: "error",
    });
  }
}



// Assign permissions to a role
async function assignPermissions(req, res) {
  const { roleId } = req.params;
  const { permissions } = req.body; // array of permission_ids

  if (!permissions || permissions.length === 0) {
    return res.status(400).json({
      message: "Permissions are required",
      status: "error",
    });
  }

  try {
    // Remove existing permissions for the role
    await pool.query("DELETE FROM res_role_permissions WHERE role_id = ?", [
      roleId,
    ]);

    // Insert new permissions
    const values = permissions.map((permissionId) => [roleId, permissionId]);
    await pool.query(
      "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
      [values]
    );

    res.status(200).json({
      message: "Permissions assigned successfully",
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error assigning permissions",
      status: "error",
    });
  }
}

// Get all permissions for a role
async function getPermissionsForRole(req, res) {
  const { roleId } = req.params;

  try {
    const [permissions] = await pool.query(
      `SELECT p.permission_name, m.module_name 
       FROM res_permissions p
       JOIN res_role_permissions rp ON p.permission_id = rp.permission_id
       JOIN res_modules m ON p.module_id = m.module_id
       WHERE rp.role_id = ?`,
      [roleId]
    );

    if (permissions.length === 0) {
      return res.status(404).json({
        message: "No permissions found for this role",
        status: "error",
      });
    }

    res.status(200).json({
      data: permissions,
      status: "success",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error fetching permissions",
      status: "error",
    });
  }
}

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  assignPermissions,
  getPermissionsForRole,
};
