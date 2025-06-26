import 'dotenv/config';

import '../asyncHandler.js';
import '../cwd.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import sequelize from './models/sequelize.js';
import profileRoutes from './routes/profileRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import recentViewRoutes from './routes/recentViewRoutes.js';
import userSettingRoutes from './routes/userSettingRoutes.js';
import userSocialLinkRoutes from './routes/userSocialLinkRoutes.js';
import userActivityLogRoutes from './routes/userActivityLogRoutes.js';
import userDeviceRoutes from './routes/userDeviceRoutes.js';
import userNotificationRoutes from './routes/userNotificationRoutes.js';
import userBlockRoutes from './routes/userBlockRoutes.js';
import userPreferenceRoutes from './routes/userPreferenceRoutes.js';
import { readFileSync } from 'fs';

const PORT = 7003;
const app = express();

// Load Swagger document
const swaggerDocument = YAML.parse(readFileSync(cwd('profile/swagger.yaml'), 'utf8'));

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// روت پروفایل
app.use('/profiles', profileRoutes);
// روت آدرس (زیرمجموعه پروفایل)
app.use('/profiles/:userId/addresses', addressRoutes);
// روت محبوب‌ها
app.use('/profiles/:userId/favorites', favoriteRoutes);
// روت مشاهدات اخیر
app.use('/profiles/:userId/recent-views', recentViewRoutes);
// روت تنظیمات کاربر
app.use('/profiles/:userId/settings', userSettingRoutes);
// روت شبکه‌های اجتماعی کاربر
app.use('/profiles/:userId/social-links', userSocialLinkRoutes);
// روت لاگ فعالیت کاربر
app.use('/profiles/:userId/activity-logs', userActivityLogRoutes);
// روت دستگاه‌های کاربر
app.use('/profiles/:userId/devices', userDeviceRoutes);
// روت اعلان‌های کاربر
app.use('/profiles/:userId/notifications', userNotificationRoutes);
// روت بلاک‌های کاربر
app.use('/profiles/:userId/blocks', userBlockRoutes);
// روت ترجیحات کاربر
app.use('/profiles/:userId/preferences', userPreferenceRoutes);

app.get('/health', function (_req, res) {
      res.json({ status: 'ok' });
});

(async () => {
      try {
            await sequelize.authenticate();
            await sequelize.sync();
            console.log('DB connected.');
            app.listen(PORT, () => {
                  console.log(`Profile service running on port ${PORT}`);
                  console.log(`Swagger UI running on http://localhost:${PORT}/api-docs`);
            });
      } catch (err) {
            console.error('Failed to start profile service:', err);
            process.exit(1);
      }
})();
