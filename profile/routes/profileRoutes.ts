import { Router } from 'express';
import { listProfiles, getProfile, createProfile, updateProfile, deleteProfile } from '../controllers/profileController.js';

const router = Router();

router.get('/', listProfiles);
router.get('/:userId', getProfile);
router.post('/', createProfile);
router.put('/:userId', updateProfile);
router.delete('/:userId', deleteProfile);

export default router; 