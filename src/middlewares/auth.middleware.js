import { ApiError } from "../utiles/ApiError.js"; // Custom error handler
import { asyncHandler } from "../utiles/asyncHandler.js"; // Wrapper to handle async errors
import jwt from "jsonwebtoken"; // Library to handle JWT tokens
import { User } from "../models/user.model.js"; // User model from database

// Middleware to verify JWT token
export const verifyJWT = asyncHandler(async (req, res, next) => {
    // This line extracts the JWT access token from the Authorization header in an HTTP request.
    // Get token from cookies or Authorization header
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    //The Authorization header typically looks like: Bearer <token>
    //as it starts with the bearer we just remove by using simple replace   
    //auth wale token vo ha jo user kudh dee

    // If no token is found, deny access
    if (!token) {
        throw new ApiError(401, "Unauthorized Request");
    }

    try {
        // Verify the token using the secret key
        const decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Find the user in the database using the token info
        const user = await User.findById(decodedInfo?._id).select("-password -refreshToken");

        // If no user is found, deny access
        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        // Attach user info to the request object
        req.user = user;//hame bana di ek field bc js khahi ki
        next(); // Continue to the next middleware or route
    } catch (error) {
        // If token is invalid or expired, deny access
        throw new ApiError(401, "Invalid or Expired Access Token");
    }
});