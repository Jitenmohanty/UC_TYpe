import { Types } from 'mongoose';
import { AuditLogModel, IAuditLog } from './auditLog.model';

export class AuditLogRepository {
  async create(data: Partial<IAuditLog>): Promise<IAuditLog> {
    return AuditLogModel.create(data);
  }

  async findAll(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      AuditLogModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }
}

export const auditLogRepository = new AuditLogRepository();
