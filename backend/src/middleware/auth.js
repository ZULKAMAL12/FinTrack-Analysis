// backend/middleware/auth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ message: "Server misconfig: JWT_SECRET missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // support multiple ways the user id might be stored
    const userId = decoded?.sub || decoded?.id || decoded?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Invalid token payload (missing user id)" });
    }

    // IMPORTANT: controllers currently use req.user._id
    req.user = { _id: userId, id: userId };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}
