require("./config/database");
const AdminFactory = require("./factories/admin.factory")
const factories = {

};
const factoryName = process.argv[2] ? process.argv[2].toLowerCase() : process.argv[2];
(async () => {
    try {
        if (factoryName && factories[factoryName]) {
            await factories[factoryName].call();
        } else {
            //Manual calling
            await AdminFactory()
        }
        process.exit(0);
    } catch (e) {
        console.log(e)
        process.exit(0);
    }
})();

// AdminFactory();