import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {//cb->call back
      cb(null, "./public/temp")//address where the files will be stored
    },
    filename: function (req, file, cb) {
       
      cb(null, file.originalname)//uploaded but the user 
    }
  })
  
export const upload = multer({ 
    storage,// or storage : storage 
})