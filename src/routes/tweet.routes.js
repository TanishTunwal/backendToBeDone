import { Router } from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import {createTweet,getUserTweets,updateTweet,deleteTweet} from "../controllers/tweet.controllers.js"
import { upload } from "../middlewares/multer.js";

const router = Router();

router.use(verifyJWT, upload.none());

router.route("/").post(createTweet);
router.route("/user/:userId").get(getUserTweets);
router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);

export default router       
