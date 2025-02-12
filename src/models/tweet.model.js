import mongoose, {Schema} from "mongoose";

const tweetSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    images: [{
        type: String,
        default: "" // This will hold URLs/paths of the images
    }]
}, {timestamps: true})


export const Tweet = mongoose.model("Tweet", tweetSchema)   