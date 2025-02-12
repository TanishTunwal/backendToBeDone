import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import {ApiError} from "../utiles/ApiError.js"
import {ApiResponse} from "../utiles/ApiResponse.js"
import {asyncHandler} from "../utiles/asyncHandler.js"

// aggregatePaginate is like hot reload which you see in reals like 

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query    

    const commentsAggregate = await Comment.aggregate([
        {
            video : new mongoose.Types.ObjectId(videoId)
        },
        {
            $lookup : {
                from : "users",
                localField : "owner",
                foreignField : "_id",
                as : "owner"
            }
        },
        {
            $lookup : "likes",
            localField : "_id",
            foreignField : "comments",
            as : "likes"
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $sort : {
                createdAt : -1
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1
                },
                isLiked: 1
            }
        }
    ])

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    );

    return res
        .status(200)
        .json(new ApiResponse(200, comments, "Comments fetched successfully"));

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params
    const {content} = req.body

    if(!req.user || !isValidObjectId(req.user?._id)) {
        throw new ApiError(400,"user not authenticated")
    }

    if(!content) {
        throw new ApiError(400,"provide the credentials")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const comment = await Comment.create({
        content : content,
        video : videoId,
        owner : req.user?._id
    })

    if(!comment) {
        throw new ApiError(400,"comment not created")
    }

    return res.status(200).json(new ApiResponse(200,comment,"comment was created successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentID} = req.params
    const {content} = req.body

    if(!commentID) {
        throw new ApiError(400,"comment doesnt exist")
    }

    if(!content) {
        throw new ApiError(400,"comment is Empty")
    }

    const commentCheck = await Comment.findById(commentID);

    if (!commentCheck) {
        throw new ApiError(404, "Comment not found");
    }

    if (commentCheck?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only comment owner can edit their comment");
    }

    const comment = await Comment.findOneAndUpdate(
        {_id : commentID},
        {
            $set : {
                content
            }
        },
        {new : true}
    )

    if(!comment) {
        throw new ApiError(400,"error occured while updating the comment")
    }

    return res.status(200).json(new ApiResponse(200,comment,"comment was updated successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only comment owner can delete their comment");
    }

    await Comment.findByIdAndDelete(commentId);

    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { commentId }, "Comment deleted successfully")
        );
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }