import { UserRole } from '../constants/roles';
import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      id: string; // injected by requestId middleware
      user?: {
        userId: Types.ObjectId;
        role: UserRole;
        email: string;
      };
    }
  }
}

export {};
