import { Request, Response } from 'express';
import { upsertProductInventory, getProductInventory, deleteProductInventory } from '../services/productInventory.service.js';

export const upsertProductInventoryController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId, variant_id: req.body.variant_id };
            const inventory = await upsertProductInventory(data);
            res.status(201).json({ status: 'success', data: inventory, message: 'Inventory updated successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductInventoryController = async (req: Request, res: Response) => {
      try {
            const { variant_id } = req.query;
            const inventory = await getProductInventory(req.params.productId, variant_id as string);
            res.json({ status: 'success', data: inventory });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const deleteProductInventoryController = async (req: Request, res: Response) => {
      try {
            const inventory = await deleteProductInventory(req.params.inventoryId);
            if (!inventory) return res.status(404).json({ status: 'error', error: 'Inventory not found' });
            res.json({ status: 'success', data: inventory, message: 'Inventory deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
