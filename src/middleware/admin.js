const isAdmin = (req, res, next) =>{
    if (!req.user){
        return res.status(401).json({message:"Unauthorized: No user found"});
    }
    if (Number(req.user.role) !== 1){
        return res.status(403).json({message: "Forbidden: Admin Access Required"})
    }
    next()
}


module.exports = isAdmin;