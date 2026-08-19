import { AuditLogModel } from './auditLog.model';
import { UserRole } from '../common/constants/roles';
import { Types } from 'mongoose';
import { logger } from '../common/utils/logger';

interface AuditLogInput {
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(input: AuditLogInput): Promise<void> {
    try {
      await AuditLogModel.create(input);
    } catch (error) {
      // Audit logging must never break the main flow
      logger.error({ msg: 'Failed to write audit log', error, input });
    }
  }
}

export const auditService = new AuditService();
