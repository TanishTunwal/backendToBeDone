import  mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {ApiError} from "../utiles/ApiError.js"
import {ApiResponse} from "../utiles/ApiResponse.js"
import {asyncHandler} from "../utiles/asyncHandler.js"
// import { uploadCloudinary, deleteFromCloudinary } from "../utiles/clodinary.js"

const createTweet = asyncHandler(async (req, res) => {
    //good start remember .create .unSynclink always take path and Array.isArray

    const {content} = req.body
    // const{images} = req.files

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid User ID");
    }

    if(!content) {
        throw new ApiError(400, "Content not avaliable");
    }

    const tweet = await Tweet.create({
        content,
        owner : req.user?._id
    })

    return res
    .status(200)
    .json(new ApiResponse(200,tweet,"Content has been created"))
})

const getUserTweets = asyncHandler(async (req, res) => {//correct this shit 
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId");
    }
     
    const tweet = await Tweet.aggregate([
        {
            $match : {
                owner : new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup : {
                from : "likes",
                localField : "_id",
                foreignField : "tweet",
                as : "likeDetails",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1,
                        },
                    },
                ],           
            }
        },
        {
            $addFields : {
                likesCount : {
                    $size : "$likeDetails",
                },
                ownerDetails: {
                    $first: "$ownerDetails",
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likeDetails.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1,
                isLiked: 1
            },
        },
    ])

    // In Mongoose, the populate() method is used to replace the specified field 
    // (which holds an ObjectId) with the actual document from the referenced collection.
    return res
    .status(200)
    .json(new ApiResponse(200, tweet, "User tweets has been fetched"))
})

const updateTweet = asyncHandler(async (req, res) => {//sameee
    console.log(req.params.id)
    const { tweetId } = req.params;
    const {content} = req.body;
    // console.log( req.parmas);
    // console.log(req.query);

    console.log("Is Valid ObjectId?", isValidObjectId(tweetId));

    
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID");
    }
    
    if(!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid User ID")
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new ApiError(400, "Content cannot be empty");
    }


    const tweet = await Tweet.findOneAndUpdate(
        { _id: tweetId, owner: req.user?._id }, // Ensure the tweet belongs to the user
        { $set: { content } }, // Update only the content field
        { new: true } // Return the updated document
    );

    // Handle case where tweet is not found
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    return res.status(200).json(new ApiResponse(200,tweet,"content was updated successfully!!"))
})

const deleteTweet = asyncHandler(async (req, res) => {
    console.log(req.params.tweetId);
     
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID");
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid User ID");
    }

    const tweet = await Tweet.findOneAndDelete({ _id: tweetId, owner: req.user._id });

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    return res.status(200).json(new ApiResponse(200, tweet, "Content has been deleted"));
});             


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}                                                                                                                                                                                                                                                                                       