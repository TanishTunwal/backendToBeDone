import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utiles/ApiError.js"
import { ApiResponse } from "../utiles/ApiResponse.js"
import { asyncHandler } from "../utiles/asyncHandler.js"
import { uploadCloudinary, deleteFromCloudinary } from "../utiles/clodinary.js"


// get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    console.log(userId);
    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
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
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
});



const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    console.log("Video Path:", req.files?.videoFile?.[0]?.path);
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    // Upload video and thumbnail concurrently
    const [videoFile, thumbnail] = await Promise.all([
        uploadCloudinary(videoLocalPath),
        uploadCloudinary(thumbnailLocalPath)
    ]);

    if (!videoFile?.url || !thumbnail?.url) {
        throw new ApiError(400, "File upload to Cloudinary failed");
    }

    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        owner: req.user?._id,
    });

return res
    .status(200)
    .json(new ApiResponse(200, video, "Video uploaded successfully"));
});// key : content-tye value : multipart/form-data (Header) to upload video and get the url


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
                        $addFields: {
                            isLiked: {
                                $cond: {
                                    if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$usersLikesList._id"] },
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
    const { videoFile, thumbnail } = req.files || {}; // Expecting multiple files

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

    if (thumbnail) {
        await deleteFromCloudinary(existingVideo.thumbnail);
        const uploadedThumbnail = await uploadCloudinary(thumbnail.path);
        if (!uploadedThumbnail) {
            throw new ApiError(400, "Error uploading new thumbnail.");
        }
        existingVideo.thumbnail = uploadedThumbnail.secure_url;
    }

    console.log(title);

    

    if (title !== undefined) existingVideo.title = title;
    if (description !== undefined) existingVideo.description = description;

    await existingVideo.save();

    res.status(200).json(new ApiResponse(200, existingVideo, "Video updated successfully"));
});


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Video ID is not valid");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video was not found");
    }

    if (!req.user || video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You can't delete this video as you are not the owner");
    }

    // Delete from Cloudinary
    try {
        await deleteFromCloudinary(video.videoFile);
        await deleteFromCloudinary(video.thumbnail);
    } catch (error) {
        console.error("Cloudinary deletion failed:", error);
        throw new ApiError(400, "Error while deleting video or thumbnail from Cloudinary.");
    }

    // Delete video from database
    await Video.deleteOne({ _id: videoId });
    await Like.deleteMany({ video: videoId });
    await Comment.deleteMany({ video: videoId });

    return res.status(200).json(new ApiResponse(200, true, "Video was deleted successfully"));

    //content type : application/json
    //Authentication : Bearer {accessToken}
    //if for media as well then content-type : multipart/form-data(not the above one only this )
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "video id is not avaliable")
    }

    const checkValidation = await Video.findById(videoId)

    if (!checkValidation) {
        throw new ApiError(400, "Video not found.");
    }

    if (checkValidation.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "user not authenticated")
    }

    const video = await Video.findOneAndUpdate(
        {_id : videoId},
        { isPublished: !checkValidation?.isPublished },
        { new: true }
    )

    if (!video) {
        throw new ApiError(400, "video not found")
    }

    return res
        .status(200).json(new ApiResponse(200, video, "publishstatus was toggled"))
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