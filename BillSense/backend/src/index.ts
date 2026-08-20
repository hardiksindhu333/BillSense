import { stopEmailPoller } from './workers/emailPoller';
// import dotenv from "dotenv";
// const result = dotenv.config();
// console.log("DOTENV RESULT =", result);
// console.log("CWD =", process.cwd());
// console.log("ENV KEY =", process.env.GEMINI_API_KEY);
// import express, {Request,Response}from "express"
// // In TypeScript, Express provides Request and Response as interfaces/types.
// // req must follow the structure of Express's Request interface
// // res must follow the structure of Express's Response interface
// import { protect } from "./middleware/auth"
// import Authrouter from "./routes/auth"
// import cors from "cors"

// import { connectDB } from "./db"
// import invoiceRouter from "./routes/invoice"
// import path from "path"
// import chatRouter from "./routes/chat"

// const app = express()
// const PORT =  process.env.PORT || 5000
// app.use(cors())
// app.use(express.json())

// connectDB()

// console.log(process.env.GEMINI_API_KEY)
// console.log(process.env.PORT)

// app.use("/uploads",express.static(path.join(__dirname,"../uploads")));
// // express.static is a middleware 
// // suppose req come at /uploads/xyz.pdf (means serve me this xyz pdf)
// // express matches /upload here and pass xyz.pdf further as the req url
// // express.static makes the path of the uploads folder and internally
// // path+ req url incoming is searched in the uploads folder
// // path+ xyz.pdf is searched 
// // if found return it 
// app.get("/api/health",(req:Request,res: Response)=>{
//     res.status(200).json({
//         status:"ok",
//         message: "Invox API is running",
//          timestamp: new Date().toISOString(),
//     })
// })

// app.use("/api/auth",Authrouter)
// app.use("/api/invoices",invoiceRouter)
// app.use("/api/chat",chatRouter)
// app.listen(PORT, () => {
//   console.log(`🚀 Invox API running on http://localhost:${PORT}`);
// });


import dotenv from "dotenv";
const result = dotenv.config();
console.log("DOTENV RESULT =", result);
console.log("CWD =", process.cwd());
console.log("ENV KEY =", process.env.GEMINI_API_KEY);
import express, { Request, Response } from "express";
import { protect } from "./middleware/auth";
import Authrouter from "./routes/auth";
import cors from "cors";

import { connectDB } from "./db";
import invoiceRouter from "./routes/invoice";
import path from "path";
import chatRouter from "./routes/chat";
import emailConfigRouter from "./routes/email";
import { startEmailPoller } from "./workers/emailPoller";

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

connectDB().then(() => {
  startEmailPoller();
});

console.log(process.env.GEMINI_API_KEY);
console.log(process.env.PORT);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Invox API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", Authrouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/chat", chatRouter);
app.use("/api/email-config", emailConfigRouter);
app.use("/api/v1/email-config", emailConfigRouter);

app.listen(PORT, () => {
  console.log(`🚀 Invox API running on http://localhost:${PORT}`);
});