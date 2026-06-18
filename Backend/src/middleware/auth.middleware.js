const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/auth.config");

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Accès non autorisé. Token manquant."
            });
        }

        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.userId;
        req.userRole = decoded.role;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Token invalide ou expiré"
        });
    }
};

module.exports = { authMiddleware };