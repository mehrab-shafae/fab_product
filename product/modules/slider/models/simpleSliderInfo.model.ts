import { Schema, model, Document } from 'mongoose';

export interface ISimpleSliderInfo extends Document {
  title: string;
  subtitle: string;
  link: string;
  img: string;
  createdAt: Date;
  updatedAt: Date;
}

const SimpleSliderInfoSchema = new Schema<ISimpleSliderInfo>({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  link: { type: String, required: true },
  img: { type: String, required: true },
}, { timestamps: true });

export const SimpleSliderInfo = model<ISimpleSliderInfo>('SimpleSliderInfo', SimpleSliderInfoSchema);
