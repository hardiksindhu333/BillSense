import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
} //here Request was an interface and i am making AuthRequest another interface which have all features of Request but it has one extra thing which is userId , if there is a user id it must be a string else ts error while compiling 

export const protect = (req: AuthRequest, res: Response, next: NextFunction): any => {
 
  const token = req.headers.authorization?.split(" ")[1];
 console.log(token)
  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as { id: string };
    console.log(decoded)

    req.userId = decoded.id; // if AuthRequest na bnaya hota too -> req.userId woulnt work bcz Request Interface deesnot have this property 
  //  without as thing , ts would have checked in jsonwebtoken library that what jwt.decode returns and it shows a string or payload , so it does not have property .id so it throws error while compile time but i said guarantte id exist so no error coz payload was user so user.id exist 
    next();
  } catch(error) {
    console.log(error)
    return res.status(401).json({ message: "Invalid token" });
  }
};