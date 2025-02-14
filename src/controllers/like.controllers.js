import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utiles/ApiError.js"
import { ApiResponse } from "../utiles/ApiResponse.js"
import { asyncHandler } from "../utiles/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: toggle like on video

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "video id doesnt exist")
    }

    if (!req.user?.id) {
        throw new ApiError(400, "user not authenticated")
    }

    const video = await Like.findOne({ video: videoId, likedBy: req.user?._id });


    if (video) {
        await Like.findOneAndDelete({ video: videoId, likedBy: req.user?._id });

        return res.status(200).json(new ApiResponse(200, null, "Like was toggled"))
    }

    const createVideo = await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })


    return res.status(200).json(new ApiResponse(200, createVideo, "Like was toggled"))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID");
    }

    if (!req.user?._id) {
        throw new ApiError(400, "User not authenticated");
    }

    // Convert IDs to ObjectId
    const commentObjectId = new mongoose.Types.ObjectId(commentId);
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);

    // console.log("Checking commentId:", commentObjectId);
    // console.log("Checking userId:", userObjectId);

    const existingLike = await Like.findOne({ comment: commentObjectId, likedBy: userObjectId });

    // console.log("Existing like:", existingLike);

    if (existingLike) {
        await Like.findOneAndDelete({ comment: commentObjectId, likedBy: userObjectId });
        // console.log("Like deleted successfully");
        return res.status(200).json(new ApiResponse(200, null, "Like was toggled"));
    }

    const newLike = await Like.create({
        comment: commentObjectId,
        likedBy: userObjectId
    });

    // console.log("New like created:", newLike);

    return res.status(200).json(new ApiResponse(200, newLike, "Like was toggled"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    //TODO: toggle like on tweet

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "tweet id doesnt exist")
    }

    if (!req.user?.id) {
        throw new ApiError(400, "user not authenticated")
    }

    const tweet = await Like.findOne({ tweet: tweetId, likedBy: req.user?._id });


    if (tweet) {
        await Like.findOneAndDelete({ tweet: tweetId, likedBy: req.user?._id });

        return res.status(200).json(new ApiResponse(200, null, "Like was toggled"))
    }

    const createTweet = await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id
    })


    return res.status(200).json(new ApiResponse(200, createTweet, "Like was toggled"))
})

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    if (!req.user._id) {
        throw new ApiError(400, "User not authnticated")
    }

    const likedVideo = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
                pipeline : [
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "ownerDetails"
                        }
                    },
                    {
                        $unwind : "$ownerDetails"
                    },
                ]
            }
        },
        {
            $unwind : "$likedVideo"
        },
        {
            $sort : {
                createdAt : -1,
            }
        },
        {
            $project: {
                _id: 0,
                likedVideo: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                    },
                },
            },
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                likedVideo,
                "liked videos fetched successfully"
            )
        );
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}