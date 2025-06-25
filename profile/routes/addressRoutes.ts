import { Router } from 'express';
import { listAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/addressController.js';

const router = Router({ mergeParams: true });

router.get('/', asyncHandler(listAddresses));
router.post('/', asyncHandler(createAddress));
router.put('/:addressId', asyncHandler(updateAddress));
router.delete('/:addressId', asyncHandler(deleteAddress));

export default router; 