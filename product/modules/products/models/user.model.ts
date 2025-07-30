import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
      user_id: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      mobile?: string;
      avatar_image_id?: string;
      birthdate?: Date;
      gender?: 'male' | 'female' | 'other';
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}

const UserSchema = new Schema<IUser>({
      user_id: { type: String, required: true, unique: true },
      first_name: { type: String },
      last_name: { type: String },
      email: { type: String },
      mobile: { type: String },
      avatar_image_id: { type: String },
      birthdate: { type: Date },
      gender: { type: String, enum: ['male', 'female', 'other'] },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

UserSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const User = mongoose.model<IUser>('User', UserSchema);
