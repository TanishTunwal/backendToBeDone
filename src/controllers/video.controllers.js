import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utiles/ApiError.js"
import { ApiResponse } from "../utiles/ApiResponse.js"
import { asyncHandler } from "../utiles/asyncHandler.js"
import { uploadCloudinary, deleteFromCloudinary } from "../utiles/clodinary.js"


//TODO: get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    const pipeline = []

    


})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const videoLocalPath = req.files?.videoFile[0].path
    const thumbnailLocalPath = req.files?.thumbnail[0].path

    if (!videoLocalPath) {
        throw new ApiError(400, "videoFileLocalPath is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadCloudinary(videoLocalPath);
    const thumbnail = await uploadCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(400, "Video file not found");
    }

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail not found");
    }

    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
    });

    const videoUploaded = await Video.findById(video._id);

    if (!videoUploaded) {
        throw new ApiError(500, "videoUpload failed please try again !!!");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {//halka sa complete kar lena
    const { videoId } = req.params;

    if (!req.user || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "User is not authenticated");
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const videoRequirement = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "videoLikes",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "likedBy",
                            foreignField: "_id",
                            as: "usersLikesList"
                        }
                    },
                    {
                        $addFields : {
                            isLiked : {
                                $cond: {
                                    if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$usersLikesList._id"]},
                                    then: true,
                                    else: false
                                }
                            }
                        }   
                    }
                ]
            }
        },
        {
            $addFields: {
                videoLikesCount: { $size: "$videoLikes" }
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
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscriberCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$subscribers.subscriber"] },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {//complete this
                "ownerDetails.avatar": 1,
                "ownerDetails.username": 1
            }            
        }
    ]);

    if (!videoRequirement.length) {
        throw new ApiError(404, "Video not found");
    }

    res.status(200).json({
        ...videoRequirement[0],
        owner: videoRequirement[0].owner[0] || null // Extract the first owner object
    });
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    const { videoFile, thumbnail } = req.file || {}; // Ensure file fields exist

    if (!videoId) {
        throw new ApiError(400, "Video ID is required.");
    }

    const existingVideo = await Video.findById(videoId);
    if (!existingVideo) {
        throw new ApiError(404, "Video not found.");
    }

    if (videoFile) {
        await deleteFromCloudinary(existingVideo.videoFile);
        const uploadedVideo = await uploadCloudinary(videoFile.path);
        if (!uploadedVideo) {
            throw new ApiError(400, "Error uploading new video file.");
        }
        existingVideo.videoFile = uploadedVideo.secure_url;
    }

    // Prepare fields for update
    if (title !== undefined) existingVideo.title = title;
    if (description !== undefined) existingVideo.description = description;
    if (thumbnail !== undefined) existingVideo.thumbnail = thumbnail;

    // Save the updated document
    await existingVideo.save();

    res.status(200).json(new ApiResponse(200, existingVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400,"video id is not valid")
    }

    const video =  await Video.findById(videoId)

    if(!video) {
        throw new ApiError(400,"video was not found")
    }

    if(video?.owner.toString() !==  req.user?._id) {
        throw new ApiError(
            400,
            "You can't delete this video as you are not the owner"
        );
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if (!videoDeleted) {
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    const videoDeletedFromCloudinary = await deleteOnCloudinary(video.videoFile);
    const thumbnailDeletedFromCloudinary = await deleteOnCloudinary(video.thumbnail);

    if (!videoDeletedFromCloudinary || !thumbnailDeletedFromCloudinary) {
        throw new ApiError(400, "Error while deleting video or thumbnail from Cloudinary.");
    }

    await Like.deleteMany({
        video: videoId
    })

     // delete video comments
    await Comment.deleteMany({
        video: videoId,
    })

    return res.status(200).json(new ApiResponse(200,true,"video was deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400,"video id is not avaliable")
    }

    const checkValidation = await Video.findById(videoId)
    
    if (!checkValidation) {
        throw new ApiError(400, "Video not found.");
    }

    if(checkValidation.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400,"user not authenticated")
    }

    const video = await Video.findOneAndUpdate(
        videoId,
        {isPublished : !video?.isPublished},
        {new : true}
    )

    if(!video) {
        throw new ApiError(400,"video not found")
    }
 
    return res
    .status(200).json(new ApiResponse(200,video,"publishstatus was toggled"))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}






// {
//     "videoFile": { "url": "https://example.com/video.mp4" },
//     "title": "My First Video",
//     "description": "This is a sample video.",
//     "views": 1000,
//     "createdAt": "2025-01-30T10:00:00Z",
//     "duration": "10:15",
//     "comments": 15,
//     "likesCount": 2,
//     "isLiked": true,
//     "owner": {
//         "_id": "65b2e3f4a5c6d7e8f9012345",
//         "username": "JohnDoe",
//         "avatar": { "url": "https://example.com/avatar.jpg" },
//         "subscribersCount": 2,
//         "isSubscribed": true
//     }
// }