import { Router } from 'express';
import { barberServiceRoutes } from './barberService.routes';

// Re-export barberService routes mounted under /barbers/me/services
export { barberServiceRoutes };
