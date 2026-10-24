import { Router } from 'express';
import { ROLES } from '../constants.js';
import { createTable, deleteTable, listTables, updateTable } from '../controllers/tableController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validation/common.js';
import { createTableBody, updateTableBody } from '../validation/tableSchemas.js';

export const tableRoutes = Router();
const ownerOnly = [requireAuth, requireRole(ROLES.OWNER)];

tableRoutes.get('/restaurants/:id/tables', ...ownerOnly, validate({ params: idParam }), listTables);
tableRoutes.post(
  '/restaurants/:id/tables',
  ...ownerOnly,
  validate({ params: idParam, body: createTableBody }),
  createTable,
);
tableRoutes.patch('/tables/:id', ...ownerOnly, validate({ params: idParam, body: updateTableBody }), updateTable);
tableRoutes.delete('/tables/:id', ...ownerOnly, validate({ params: idParam }), deleteTable);
