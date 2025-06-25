import { Router } from 'express';
import { listProfiles, getProfile, createProfile, updateProfile, deleteProfile } from '../controllers/profileController.js';

const router = Router();

router.get('/', asyncHandler(listProfiles));
router.get('/:userId', asyncHandler(getProfile));
router.post('/', asyncHandler(createProfile));
router.put('/:userId', asyncHandler(updateProfile));
router.delete('/:userId', asyncHandler(deleteProfile));

export default router;
