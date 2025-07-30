import { Schema, model, Document } from 'mongoose';

export interface ISimpleSliderInfo extends Document {
      title: string;
      subtitle?: string;
      link?: string;
      img?: string;
      createdAt: Date;
      updatedAt: Date;
}

const SimpleSliderInfoSchema = new Schema<ISimpleSliderInfo>(
      {
            title: { type: String, required: true, unique: true },
            subtitle: { type: String, required: false },
            link: { type: String, required: false },
            img: { type: String, required: false },
      },
      { timestamps: true }
);

export const SimpleSliderInfo = model<ISimpleSliderInfo>('SimpleSliderInfo', SimpleSliderInfoSchema);
