const asyncHandler = (reqHandler) => {
    return (req, res, next) => {
        Promise.resolve(reqHandler(req, res, next))
            .catch(next);
    };
};

export { asyncHandler };

//you can use this also
// const asyncHandler = (fn) =>async (req,res,next) => { //thing like this const aysncHandler =  (func) => {() => {}}
//     try {
        
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success : false,
//             message  : error.message
//         })
//     }
// }