import { Request, Response } from 'express';
import { assignmentService } from './assignment.service';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';
import { z } from 'zod';

export const acceptAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.acceptAssignment(req.params['assignmentId']!, req.user!.userId);
  sendSuccess(res, result, 'Assignment accepted');
});

export const rejectAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const result = await assignmentService.rejectAssignment(req.params['assignmentId']!, req.user!.userId, reason);
  sendSuccess(res, result, 'Assignment rejected');
});

export const cancelAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const result = await assignmentService.cancelAssignment(req.params['assignmentId']!, req.user!.userId, reason);
  sendSuccess(res, result, 'Assignment cancelled');
});

export const arriveAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.arriveAssignment(req.params['assignmentId']!, req.user!.userId);
  sendSuccess(res, result, 'Barber arrived — OTP generated and dispatched via Twilio SMS');
});

export const startAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.startAssignment(req.params['assignmentId']!, req.user!.userId);
  sendSuccess(res, result, 'Service started');
});

export const getPendingAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.getPendingOrActiveAssignment(req.user!.userId);
  sendSuccess(res, result);
});

export const startJourney = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.startJourney(req.params['assignmentId']!, req.user!.userId);
  sendSuccess(res, result, 'Journey started');
});

export const completeAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.completeAssignment(req.params['assignmentId']!, req.user!.userId);
  sendSuccess(res, result, 'Service completed');
});
