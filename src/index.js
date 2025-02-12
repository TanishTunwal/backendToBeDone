// require('dotenv').config    ({path: './env'})    
import dotenv from'dotenv'
import connectDB from './db/index.js';
import mongoose from "mongoose";
import { app } from './app.js';
dotenv.config({
    path:'./env'
})

//*******************first approach**********************//

// import express from "express";
// const app = express()


// ;(async ()=> {
//     try{
//         await mongoose.connect(`${process.env.MONGO_DB}/${DB_NAME}`)
//         app.on("errror",(error) => {
//             console.log("ERRR:"error);
//             throw error;
//         })

//         app.listen(process.env.PORT,() => {
//             console.log(`listening at port ${process.env.PORT}`);
//         })
//     }catch(error) {
//         console.log(error);
//         throw error
//     }
// })()

const startServer = () => {
    const PORT = process.env.PORT || 8000;

    app.on("error", (err) => {
        console.error("Application-level Error:", err);
        process.exit(1);
    });

    app.listen(PORT, () => {
        console.log(`Server is running at port: ${PORT}`);
    });
};

connectDB()
    .then(startServer)
    .catch((err) => {
        console.error("MongoDB connection failed! Exiting...", err);
        process.exit(1);
    }
);
