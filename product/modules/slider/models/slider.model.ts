import { Schema, model, Document, Types } from 'mongoose';

export interface ISlider extends Document {
  type: 'product' | 'category';
  refId: Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const SliderSchema = new Schema<ISlider>({
  type: { type: String, enum: ['product', 'category'], required: true },
  refId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'type', // به مدل درست وصل می‌شود (Product یا Category)
  },
  order: { type: Number, default: 0 },
}, { timestamps: true });

export const Slider = model<ISlider>('Slider', SliderSchema);
