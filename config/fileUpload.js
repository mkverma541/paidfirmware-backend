const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, callback) {

    const fieldname = file.fieldname;
    console.log(file);
    const folderPath = `public/media/${fieldname}`;

    callback(null, folderPath);
  },
  filename: function (req, file, callback) {
    callback(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB upload limit
    // files: 1                    // 1 file
  },
  fileFilter: (req, file, cb) => {
    // if the file extension is in our accepted list
    if (
      mimeTypes.allowed_image_mimes.some((ext) =>
        file.originalname.endsWith("." + ext)
      )
    ) {
      return cb(null, true);
    }
    // otherwise, return error
    return cb(new Error("file not allowed"));
  },
  storage: storage, //storage
});

const mimeTypes = {
  allowed_image_mimes: [
    "jpeg",
    "png",
    "bmp",
    "jpg",
    "webp",
    "svg",
    "JPG",
    "pdf",
    "docx",
  ],
};

class FileUpload {
  constructor() {
    this.files = this.files.bind(this);
  }
  files(filesArray) {
    try {
      let files = filesArray.map((file) => {
        return {
          name: file,
          maxCount: 1,
        };
      });
      const uploadable = upload.fields(files);
      return (req, res, next) => {
        uploadable(req, res, function (err) {
          console.log(err, "Error in fileUpload");
          req.uploadError = err;
          if (err) {
            next(err);
            return;
          }
          next();
        });
      };
    } catch (e) {
      console.log(e, "Error at fileUploads");
      return e;
    }
  }

  arrayUpload(name) {
    return upload.array(name);
  }
}

module.exports = new FileUpload();
