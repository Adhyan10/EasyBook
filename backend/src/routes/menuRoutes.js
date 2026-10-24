import { Router } from 'express';
import { ROLES } from '../constants.js';
import { addItem, deleteItem, getMenu, updateItem } from '../controllers/menuController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validation/common.js';
import { createMenuItemBody, updateMenuItemBody } from '../validation/menuSchemas.js';

export const menuRoutes = Router();
const ownerOnly = [requireAuth, requireRole(ROLES.OWNER)];

menuRoutes.get('/restaurants/:id/menu', validate({ params: idParam }), getMenu);
menuRoutes.post('/restaurants/:id/menu', ...ownerOnly, validate({ params: idParam, body: createMenuItemBody }), addItem);
menuRoutes.patch('/menu-items/:id', ...ownerOnly, validate({ params: idParam, body: updateMenuItemBody }), updateItem);
menuRoutes.delete('/menu-items/:id', ...ownerOnly, validate({ params: idParam }), deleteItem);
