import { Request, Response } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../common/utils/response';
import { asyncHandler } from '../../common/utils/asyncHandler';
import type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
} from './auth.schema';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body as RegisterInput);
  sendCreated(res, result, 'Registration successful');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);
  sendSuccess(res, result, 'Login successful');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body as RefreshTokenInput;
  const tokens = await authService.refreshTokens(token);
  sendSuccess(res, tokens, 'Tokens refreshed');
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body as ForgotPasswordInput);
  sendSuccess(res, result, result.message);
});

export const verifyResetOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyResetOtp(req.body as VerifyResetOtpInput);
  sendSuccess(res, result, result.message);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetPassword(req.body as ResetPasswordInput);
  sendSuccess(res, result, result.message);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.user!.userId);
  sendSuccess(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.userId);
  sendSuccess(res, user);
});
