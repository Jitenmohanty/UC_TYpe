import { Request, Response } from 'express';
import { assignmentService } from './assignment.service';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';

export const getActiveAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.getActiveAssignment(req.user!.userId);
  sendSuccess(res, result);
});

export const acceptAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.acceptAssignment(
    req.params['assignmentId']!,
    req.user!.userId,
  );
  sendSuccess(res, result, 'Assignment accepted');
});

export const rejectAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const result = await assignmentService.rejectAssignment(
    req.params['assignmentId']!,
    req.user!.userId,
    reason,
  );
  sendSuccess(res, result, 'Assignment declined');
});

export const startJourney = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.startJourney(
    req.params['assignmentId']!,
    req.user!.userId,
  );
  sendSuccess(res, result, 'Journey started');
});

export const arriveAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.arriveAssignment(
    req.params['assignmentId']!,
    req.user!.userId,
  );
  sendSuccess(res, result, 'Arrival recorded — verification code sent to the customer');
});

export const completeAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.completeAssignment(
    req.params['assignmentId']!,
    req.user!.userId,
  );
  sendSuccess(res, result, 'Service completed');
});

export const cancelAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const result = await assignmentService.cancelAssignment(
    req.params['assignmentId']!,
    req.user!.userId,
    reason,
  );
  sendSuccess(res, result, 'Job cancelled — booking returned to the open pool');
});
