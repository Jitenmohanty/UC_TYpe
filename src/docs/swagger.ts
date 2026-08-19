import { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Salon Booking API',
      version: '1.0.0',
      description:
        'Production-ready REST API for salon/barber service booking with automatic barber allocation.',
      contact: {
        name: 'API Support',
        email: 'support@salonbooking.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}${env.API_PREFIX}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        RegisterInput: {
          type: 'object',
          required: ['name', 'email', 'phone', 'password'],
          properties: {
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '+919876543210' },
            password: { type: 'string', minLength: 8, example: 'SecurePass1' },
            role: { type: 'string', enum: ['CUSTOMER', 'BARBER'], default: 'CUSTOMER' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            bookingNumber: { type: 'string', example: 'BK-LZ2X9Y-ABC' },
            status: {
              type: 'string',
              enum: [
                'PENDING', 'SEARCHING', 'OFFERED', 'CONFIRMED',
                'IN_PROGRESS', 'COMPLETED', 'CUSTOMER_CANCELLED',
                'BARBER_CANCELLED', 'EXPIRED', 'NO_BARBER_AVAILABLE', 'ADMIN_CANCELLED',
              ],
            },
            scheduledDate: { type: 'string', example: '2026-08-25' },
            startTime: { type: 'string', example: '17:00' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Bookings', description: 'Booking management' },
      { name: 'Assignments', description: 'Assignment lifecycle management' },
      { name: 'Barbers', description: 'Barber profile and availability' },
      { name: 'Services', description: 'Service catalog' },
      { name: 'Admin', description: 'Administrative operations' },
    ],
  },
  apis: ['./src/**/*.routes.ts'],
};

const spec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  app.use(
    `${env.API_PREFIX}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Salon Booking API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );

  // Also expose raw JSON spec
  app.get(`${env.API_PREFIX}/docs.json`, (_req, res) => {
    res.json(spec);
  });
}
