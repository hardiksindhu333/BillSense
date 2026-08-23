import mongoose, { Schema, Document } from "mongoose";
// Document → TypeScript type/interface used for type checking.
// document exist only while coding and it disappears after compilation
// Schema -> actual class used at runtime 
// both Schema and Document are named exports 
// at runtime , document is not used , only Schema and mongoose 
export interface IUser extends Document {
    // Iuser ke pas mongooose document ki properties to hai he 
    // and along that ye niche custom properties 
  email: string;
  name: string;
  image?: string;
  createdAt: Date;
}
// ye upr ka code -> node never sees this , its only for vscode and ts 

        const UserSchema: Schema = new Schema({
            // Userschema must be of type schema {UserSchema:Schema}
        email: 
        { type: String,
            required: true,
            unique: true },
        name: { 
            type: String,
            required: true },

        image:{ 
            type: String },
            
        createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>("User", UserSchema);
//this model returns IUser documents