import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import sequelize from './models/index.js';
import profileRoutes from './routes/profileRoutes.js';
import addressRoutes from './routes/addressRoutes.js';

// بارگذاری env
dotenv.config({ path: process.env.PROFILE_ENV_PATH || '.env' });

const PORT = process.env.PROFILE_PORT || 5005;
const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// روت پروفایل
app.use('/profiles', profileRoutes);
// روت آدرس (زیرمجموعه پروفایل)
app.use('/profiles/:userId/addresses', addressRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('DB connected.');
    app.listen(PORT, () => {
      console.log(`Profile service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start profile service:', err);
    process.exit(1);
  }
})(); 