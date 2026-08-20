import multer from "multer"
import path from "path"

const storage = multer.diskStorage({  // diskStorage engine 
//Store uploaded files on disk
// Inside uploads/
// Using timestamp-based filenames
    destination :(req,file,cb)=>{
        cb(null,"uploads/")
    },  // where should i save the file which is destination 


filename: (req,file,cb) =>{

    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null,uniqueName)  // name of the file while saving 
},

})


const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // this fileFilter runs befor saving the file 
  const allowed = [".pdf", ".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only PDF, PNG, JPG files allowed"));
};
export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// req arrive -> intercepted by multer -> fileFilter runs -> check extension -> check size limit -> generate filename -> save to uploads -> attach info to req.file-> next


// cb(null,true) -> no error ,accept the file
// cn(null,false)-> no error, reject
// cb(new Error("  ")) -> error

// this cb is a node js callback
// when a req comes
// multer interrcept it 
// it split into some part 
// check the fields 
// the fields look like this -> name ="file", and filename = "invoice.pdf"
// upload.single("file") -> means single file is coming and matches the name field value to this arguement of single 
// if yes then do processing like run file filter then check size then save it 

//"I expect one file upload whose field name is file." -> upload.single("file")



// Request arrives (multipart/form-data)
//           ↓
// Multer intercepts request
//           ↓
// Parses multipart body into parts
//           ↓
// Finds a file part:
// name="file"
// filename="invoice.pdf"
//           ↓
// upload.single("file")
// checks:
// Is field name == "file" ?
//           ↓
// Yes
//           ↓
// Run fileFilter()
//           ↓
// Check file size limits
//           ↓
// Call destination()
//           ↓
// Call filename()
//           ↓
// Save file to disk
//           ↓
// Create req.file
//           ↓
// next()
//           ↓
// Route handler runs