import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  chat_id: mongoose.Types.ObjectId;
  sender_id: mongoose.Types.ObjectId;
  message: string;
  is_read?: boolean;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  chat_id: { type: Schema.Types.ObjectId, ref: 'ProductChat', required: true },
  sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ChatMessageSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema); 