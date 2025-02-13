import { asyncHandler } from "../utiles/asyncHandler.js"
import { ApiError } from "../utiles/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadCloudinary, deleteFromCloudinary } from "../utiles/clodinary.js"
import { ApiResponse } from "../utiles/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken(); 
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken//dynamic field addion
        await user.save({ validateBeforeSave: false })//must before making any change in model

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "somthing went wrong while generating access and refresh token")
    }
}
 
const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, username, password } = req.body//will return the body from the frontend
    // console.log("email: ", email);
    // console.log("usrnam ",username);

    // if(fullname === "") {//aise ek ek check bhi laga sakte ha ya fir niche wala bhi 
    //     throw new ApiError(400,"fullname is required")   
    // }

    if (
        [fullname, password, email, username].some((field) => field?.trim() === "")//tocheck whether the field is empty or not
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({//to find the one field as per required   
        $or: [{ email }, { username }] //with this $ you can perform many things like this
    })

    if (existedUser) {
        // console.log(existedUser);
        throw new ApiError(400, "user with email or username already exist")
    }
    // console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path
    // console.log(avatarLocalPath);

    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {//isArray check if the array we get array or not
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if (!avatarLocalPath) { //local path bhi mil raha ha
        throw new ApiError(400, "avatar is required")
    }

    const avatar = await uploadCloudinary(avatarLocalPath)
    const coverImage = await uploadCloudinary(coverImageLocalPath)
    // console.log(avatar);

 
    if (!avatar) {
        throw new ApiError(400, "Avatar is required")
    }

    const user = await User.create({//can lead to potential error as told so we have to also await here
        fullname,
        avatar: avatar ? avatar.url : "",
        coverImage: coverImage ? coverImage.url : "", //coverImage?.url || "" another way
        email,
        password,
        username: username
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"//ajib sa synatx ha acchec se dekh - matlab remove kar do vo feild aur spacing bhi aise hi hogi
    )

    if (!createdUser) {
        // console.log(createdUser);
        throw new ApiError(500, "something went wrong while registring the user")
    }

    return res.status(201).json(//not nessary to write this res.status() code here you can directly return new Apres 
        new ApiResponse(200, createdUser, "user register successfully")//third feild optional ha
    )
});

const loginUser = asyncHandler(async (req, res) => {
    //get data from req body
    // username or email
    //find user
    //password check
    //access and refresh token 
    //send cookies
    //response send

    //we get the reuired feilds
    const { email, username, password } = req.body

    //check if  got the fields or not
    if (!username && !email) {
        throw new ApiError(400, "username or password  is required");
    }

    //find the email and password on field as per which you want the user must login
    const user = await User.findOne({
        $or: [{ email }, { username }]//mongo db operator $
    })

    //check if the user exist in the db
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    //bcrypt method to check the password is correct or not
    //check if it matches with the password
    const ispasswordValid = await user.isPasswordCorrect(password)

    //failed then throw error
    if (!ispasswordValid) {
        throw new ApiError(401, "Invalid credentails of user")//<---
    }

    //method created above to get the credentials
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    //send cookies
    //for same obj
    //phele check kar lena ki ye User.findById kahi expensive process to nahi varna performance. user.refreshToken = refreshToken bhi kar sakta ha
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //so that user cant access the cookies from fronted and update them 
    const options = {
        httpOnly: true,//(both)as cookies can be modified by anyone easily from fronted so we have to set these so that only server can moddify
        secure: true //user can see these cookies but cant modify
        //httpOnly: true, // Ensures the cookie is only accessible by the server, not client-side JavaScript.
        //secure: true,   // Ensures the cookie is transmitted only over HTTPS, protecting it from interception.
    }

    //we have access of ".cookies" as we have installed cookies-parser 
    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken //handling that case where user itself want to save those Tokens andd blah blah
                },
                "User loggedIn successfully                                 "
            )
        )

});

const logoutUser = asyncHandler(async (req, res) => {//(req,res,next) -> (req,_,next) aise bhi likh sakte ha
    //we could have added the middleware wala code here put like we want to know post liked,added by user we need to check if userIsAuthenicated or not
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user loggedout"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.body.refreshToken || req.cookies.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "refresh token is expired or used")
        }

        const { accessToken, newRefresehToken } = await generateAccessAndRefreshTokens(user._id)

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200, { accessToken, refreshToken: newRefresehToken }, "Access Token refreshed")
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // Ensure oldPassword and newPassword are not the same
    if (oldPassword === newPassword) {
        throw new ApiError(400, "User password already the same");
    }

    // Ensure the user is authenticated
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized");
    }

    // Find the user by their ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check if the old password matches
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password");
    }

    // Update the password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

//advice: agar khi pe update karna ha to usske alag banke endpoint hit karva de isse conjuction kam hota ha varna sara data bar bar lejna padega

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body
    

    if (!fullname || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname, email
                // email : email
            }
        },
        { new: true } //update hone ke bad jo info ha vo return hogi 
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "details have been updated"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is missing")
    }

    const imageToBeDeleted = req.user?.coverImage;

    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading the file to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        }
        ,
        { new: true }
    )

    if (!imageToBeDeleted) {
        throw new ApiError(400, "Image is not avalible")
    }

    const deleteImg = await deleteFromCloudinary(req.user?.coverImage);

    if (!deleteImg) {
        throw new ApiError(400, "error while deleting the file")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover image updated successfully")
        )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const imageToBeDeleted = req.user?.avatar

    const avatar = await uploadCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading the file to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        }
        ,
        { new: true }
    )

    if (!imageToBeDeleted) {
        throw new ApiError(400, "Image is not avalible")
    }

    const deleteImg = await deleteFromCloudinary(req.user?.avatar);

    if (!deleteImg) {
        throw new ApiError(400, "error while deleting the file")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Avatar image updated successfully")
        )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) //we have to search the id like this only
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {//for further pipelining we have to do this
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            //all the  below this goes into the onwer field if take outside then the structure changes
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1,

                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"//we could have user arrayElementAt
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history fetched successfully"
        ))
    // const getWatchHistory = asyncHandler(async (req, res) => {
    //     const user = await User.aggregate([
    //         {
    //             $match: {
    //                 _id: new mongoose.Types.ObjectId(req.user._id) //we have to search the id like this only
    //             }
    //         },
    //         {
    //             $lookup: {
    //                 from: "videos",
    //                 localField: "watchHistory",
    //                 foreignField: "_id",
    //                 as: "watchHistory",
    //                 pipeline: [
    //                     {//for further pipelining we have to do this
    //                         $lookup: {
    //                             from: "users",
    //                             localField: "owner",
    //                             foreignField: "_id",
    //                             as: "owner",
    //                         }
    //                     }
    //                 ]
    //             }
    //         },
    //         {
    //             $project : {
    //                 fullname : 1,
    //                 username : 1,
    //                 avatar : 1,

    //             }
    //         }
    //     ])
    // })
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser, updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
} 