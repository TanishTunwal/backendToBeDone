import mongoose,{Schema, Types} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
    {
        content : {
            type : String,
            require : true
        },
        video : {
            type : Schema.Types.ObjectId,
            ref : "Video"
        },
        owner :  {
            type : Schema.Types.ObjectId,
            ref : "User"
        }
    },{timestamps : true }
)

commentSchema.plugin(mongooseAggregatePaginate)//gives the ability to kha se kha tak video dena ha

export const Comment = mongoose.model("Comment",commentSchema) 