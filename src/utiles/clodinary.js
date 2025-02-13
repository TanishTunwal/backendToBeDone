import { v2 as cloudinary } from "cloudinary"
import fs from "fs"


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// cloudinary.v2.upload("link",{public_id : "name"},function(error,result) {console.log(result);}) //you can do this direct but not used in production

const uploadCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            console.log("Invalid file path provided.");
            return null
        }

        if (Array.isArray(localFilePath)) {
            let ImageCollections = []
            for (const file of localFilePath) {
                const filePath = file.path || file; // Handle if file is an object with a path or a string
                const response = await cloudinary.uploader.upload(filePath, {
                    resource_type: "auto",
                });
                ImageCollections.push(response.url);
                fs.unlinkSync(filePath); // Delete the file from local storage
            }
            console.log(ImageCollections);
            return ImageCollections
        } else {
            const filePath = localFilePath.path || localFilePath; // Handle if it's an object or string
            const response = await cloudinary.uploader.upload(filePath, {
                resource_type: "auto",
            });
            // if (filePath && fs.existsSync(filePath)) {
            //     fs.unlinkSync(filePath);
            // }
            fs.unlinkSync(filePath)// Delete the file from local storage
            return response; // Return the full response object
             // Return as an array of URLs
        }

    } catch (error) {
        const filePath = localFilePath.path || localFilePath; // Handle failure clean-up
        fs.unlinkSync(filePath); // Remove the locally saved temporary file
        return null
    }
}

const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) {
            console.log("Invalid image URL provided.");
            return false;
        }

        const deleteImage = async (url) => {
            const publicId = url.split("/").pop().replace(/\.[^/.]+$/, ""); // Extract public ID
            const res = await cloudinary.uploader.destroy(publicId);
            if (res.result === 'ok') {
                console.log('Image deleted successfully:', res);
                return true;
            } else {
                console.log('Failed to delete image:', res);
                return false;
            }
        };

        if (Array.isArray(imageUrl)) {
            const results = await Promise.all(imageUrl.map(deleteImage)); // Parallel deletion
            return results.every(result => result); // Return true only if all succeeded
        } else {
            return await deleteImage(imageUrl);
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        return false;
    }
};


export { uploadCloudinary, deleteFromCloudinary }   