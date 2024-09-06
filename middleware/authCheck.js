const jwt = require('jsonwebtoken');
const sanitizedData = require("../helpers/sanitizedHelpers");

module.exports = (req, res, next) => {
    try {
        const token = sanitizedData(req.headers["authorization"].split(' ')[1])

        const decodedToken = sanitizedData(jwt.verify(token, process.env.SECRET_KEY))
        if (!decodedToken) {
            return res.status(401).json("не авторизован");
        }

        req.token = decodedToken;
        next();
    } catch (e) {
        res.status(401).json("не авторизован");
    }
}

