import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
    try{
        const connectInstance = await mongoose.connect(`${process.env.MONGO_URL}/${DB_NAME}`)
        console.log(`mongodb connect db Host: ${process.env.PORT} \n ${connectInstance.connection.host}`);
        
    }catch(error) {
        console.log('ERRRRRRRRRRRRRRRRRRRRRRRROR',error);
        process.exit(1)
    }
}

export default connectDB