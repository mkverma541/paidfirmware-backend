# paidfirmware-backend

email passwor : Y0(2o@9n=U$B
email : info@mathematicalpathshala.in

// schema for migrations table data

    case "res_files":
      return {
        file_id: row.file_id,
        folder_id: row.folder_id,
        title: row.title,
        description: row.description || "",
        body: row.body || "",
        thumbnail: row.thumbnail || "",
        image: row.image || "",
        size: row.size || "",
        price: row.price || 0,
        url: row.url || "",
        url_type: row.url_type || "",
        server_id: row.server_id || 0,
        visits: row.visits || 0,
        downloads: row.downloads || 0,
        is_active: row.is_active ? 1 : 0,
        is_new: row.is_new ? 1 : 0,
        is_featured: row.is_featured ? 1 : 0,
        rating_count: row.rating_count || 0,
        rating_points: row.rating_points || 0,
        tags: row.tags || "",
        slug: row.slug || "",
        min_cart_qty: 1,
        max_cart_qty: 1,
        created_at: row.date_create || new Date(),
        updated_at: row.date_update || new Date(),
      };

    case "res_folders":
      return {
        folder_id: row.folder_id,
        parent_id: row.parent_id,
        title: row.title,
        description: row.description || "",
        thumbnail: row.thumbnail || "",
        is_active: row.is_active ? 1 : 0,
        is_new: row.is_new ? 1 : 0,
        slug: row.slug || "",
        created_at: row.date_create || new Date(),
        updated_at: row.date_update || new Date(),
      };

