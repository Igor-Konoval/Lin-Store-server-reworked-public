const jwt = require('jsonwebtoken');
const sanitizedData = require("../helpers/sanitizedHelpers");

module.exports = function(role) {
    return function(req, res, next) {
        try {
            const token = sanitizedData(req.headers["authorization"].split(' ')[1])

            const decodedToken = sanitizedData(jwt.verify(token, process.env.SECRET_KEY))
            if (!decodedToken) {
                return res.status(401).json("не авторизован");
            }

            if (decodedToken.role !== role) {
                return res.status(403).json("нет доступа");
            }

            req.token = decodedToken;
            next();
        } catch (e) {
            console.log(e.message);
            res.status(401).json("не авторизован");
        }
    }
}

