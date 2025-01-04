const _ = require('lodash');
/* Third Party Libraries */

/* End Models */

class FilesController {

    expectedFiles() {
        return [
            'avatar',
            'documents',    
            'image',
            'photo',
            'folders',
            'files',
            'blogs',
            'teams',
            'icons',
            'agents',
            'products',
        ]
    }

    async uploadFiles(req, res) {
        try {
            if (!req['files'] || _.isEmpty(req['files'])) {
                throw new Error('Files required.');
            }
            const files = Object.keys(req.files)
                .map(key => {
                    console.log(req.files[key])
                    return {
                        [key]: req.files[key].map(file => file.filename)
                    };
                    // For local storage
                    // return {
                    //     [key]: req.files[key].map(file => file.location)
                    // }; // For S3 Storage
                })
                .reduce((prev, curr) => {
                    return {...prev, ...curr }
                });
            res.status(200).json({
                status: 'success',
                response: files,
            })
        } catch (e) {
            res.status(200).json({
                status: 'fail',
                response: e
            })  
        }
    }
}

module.exports = new FilesController();