import { Document, model, models, Schema } from 'mongoose';
// NOTES: models -> gives access to an array containing all models associated with this Mongoose instance.

export interface IUser {
  name: string;
  username: string;
  email: string;
  bio?: string;
  image?: string;
  location?: string;
  portfolio?: string;
  reputation?: number;
}

export interface IUserDoc extends IUser, Document {}

// 1. To create a schema we call the Schema and then pass the schema definition
const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    bio: { type: String },
    image: { type: String },
    location: { type: String },
    portfolio: { type: String },
    reputation: { type: Number, default: 0 },
  },
  { timestamps: true } // To generate timestamps when the user was created
);

const User = models?.User || model<IUser>('User', UserSchema); // NOTE: <IUser> means that our document will be of the type IUser (In the frontend we will know exactly which properties of the user we will have access to)

export default User;
