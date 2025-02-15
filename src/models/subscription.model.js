import mongoose,{Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber : {
        type : Schema.Types.ObjectId,//for the one who is subsribing
        ref : "User"
    },
    channel : {
        type : Schema.Types.ObjectId,//for the one whos channel has been subsribed
        ref : "User"
    }
},{timestamps : true})

export const Subscription = mongoose.model("Subscription",subscriptionSchema)