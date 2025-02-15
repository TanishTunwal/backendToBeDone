import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utiles/ApiError.js"
import { ApiResponse } from "../utiles/ApiResponse.js"
import { asyncHandler } from "../utiles/asyncHandler.js"



const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!req.user._id) {
        throw new ApiError(400, "User not authenticated");
    }

    if (!isValidObjectId(new mongoose.Types.ObjectId(channelId))) {
        throw new ApiError(400, "This channel doesn't exist");
    }

    console.log(channelId);


    console.log(req.user?._id);
    

    const isSubscribed = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: new mongoose.Types.ObjectId(channelId)
    });

    console.log("isSubscribed:", isSubscribed);

    console.log(isSubscribed);
    

    if (isSubscribed) {
        // Unsubscribe
        const deleteResult = await Subscription.deleteOne({ _id: isSubscribed._id });
        console.log("deleteResult:", deleteResult);

        return res.status(200).json(
            new ApiResponse(
                200,
                null,
                "Unsubscribed successfully"
            )
        );
    } else {
        // Subscribe
        const subscription = await Subscription.create({
            subscriber: req.user?._id,
            channel: new mongoose.Types.ObjectId(channelId)
        });
        console.log("subscription:", subscription);

        return res.status(200).json(
            new ApiResponse(
                200,
                subscription,
                "Subscribed successfully"
            )
        );
    }
});

// This code is a MongoDB aggregation pipeline used to retrieve subscribers of a specific channelId and
//  get additional information about them, including whether they are subscribed back to the given channel
//   and how many subscribers they have.
// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    let { channelId } = req.params; // Use "channelId" instead of "subscriberId"

    console.log(channelId);

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId");
    }

    channelId = new mongoose.Types.ObjectId(channelId); // Convert to ObjectId

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: channelId,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribedToSubscriber",
                        },
                    },
                    {
                        $addFields: {
                            subscribedToSubscriber: {
                                $in: [channelId, "$subscribedToSubscriber.channel"], // Fix: Check "channel" field
                            },
                            subscribersCount: {
                                $size: "$subscribedToSubscriber",
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriber",
        },
        {
            $project: {
                _id: 0,
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    subscribedToSubscriber: 1,
                    subscribersCount: 1,
                },
            },
        },
    ]);

    return res.status(200).json(
        new ApiResponse(200, subscribers, "Subscribers fetched successfully")
    );
});


// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannel",
                pipeline: [
                    {
                        $lookup: {
                            from: "videos",
                            localField: "_id",
                            foreignField: "owner",
                            as: "videos",
                        },
                    },
                    {
                        $addFields: {
                            latestVideo: {
                                $last: "$videos",
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscribedChannel",
        },
        {
            $project: {
                _id: 0,
                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    latestVideo: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        owner: 1,
                        title: 1,
                        description: 1,
                        duration: 1,
                        createdAt: 1,
                        views: 1
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribedChannels,
                "subscribed channels fetched successfully"
            )
        );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}


// [
//     {
//         "_id": 1,
//         "subscriber": [{ "_id": "userA", "username": "JohnDoe", "fullName": "John Doe", "avatar": { "url": "https://example.com/a.jpg" } }],
//         "channel": "channelX",
//         "subscribedToSubscriber": [{ "subscriber": "channelX", "channel": "userA" }]
//     },
//     {
//         "_id": 2,
//         "subscriber": [{ "_id": "userB", "username": "JaneDoe", "fullName": "Jane Doe", "avatar": { "url": "https://example.com/b.jpg" } }],
//         "channel": "channelX",
//         "subscribedToSubscriber": []  // No one subscribed to userB
//     },
//     {
//         "_id": 3,
//         "subscriber": [{ "_id": "userC", "username": "MarkLee", "fullName": "Mark Lee", "avatar": { "url": "https://example.com/c.jpg" } }],
//         "channel": "channelX",
//         "subscribedToSubscriber": [{ "subscriber": "channelX", "channel": "userC" }]
//     }
// ]



// [
//     {
//         "subscriber": [{ "_id": "userA", "username": "JohnDoe", "fullName": "John Doe", "avatar": { "url": "https://example.com/a.jpg" } }],
//         "subscribedToSubscriber": true,
//         "subscribersCount": 1
//     },
//     {
//         "subscriber": [{ "_id": "userB", "username": "JaneDoe", "fullName": "Jane Doe", "avatar": { "url": "https://example.com/b.jpg" } }],
//         "subscribedToSubscriber": false,
//         "subscribersCount": 0
//     },
//     {
//         "subscriber": [{ "_id": "userC", "username": "MarkLee", "fullName": "Mark Lee", "avatar": { "url": "https://example.com/c.jpg" } }],
//         "subscribedToSubscriber": true,
//         "subscribersCount": 1
//     }
// ]
