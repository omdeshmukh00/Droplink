import swaggerJsdoc from 'swagger-jsdoc';

const apiDescription = [
  '# DropLink Backend API & Socket.IO Specification',
  'Production-Ready Real-Time Temporary File Sharing API built with Node.js, Express, TypeScript, MongoDB, Google Drive, and Socket.IO.',
  '',
  '## Key Features',
  '- Cloud Storage: Powered by Google Drive API (GoogleDriveStorageProvider).',
  '- Real-Time Progress: Socket.IO events on namespace /socket for uploads, zip processing, drive transfers, downloads, and automatic expiration.',
  '- Security Hardened: Helmet CSP, strict CORS, rate limiting, filename sanitization, 32-byte cryptographic token entropy.',
  '',
  '## Socket.IO Events Reference',
  'Client connects to namespace /socket and emits join-transfer-room with payload { roomKey: "transfer:<token>" }.',
  '',
  '### Event Lifecycle:',
  '- joined-room: Confirmation payload with current transfer state snapshot.',
  '- upload-started / upload-progress: File upload updates.',
  '- zip-started / zip-progress / zip-completed: Multi-file ZIP archive creation updates.',
  '- drive-upload-started / drive-upload-progress / drive-upload-completed: Google Drive stream upload updates.',
  '- transfer-processing / transfer-ready: Finalizing metadata & link generation.',
  '- download-started / download-progress / download-completed: Receiver download stream updates.',
  '- transfer-expired / transfer-deleted: Real-time notification when transfer expires or is deleted.',
  '- cleanup-started / cleanup-completed: Background scheduler maintenance events.',
].join('\n');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'DropLink API',
      version: '1.0.0',
      description: apiDescription,
      contact: {
        name: 'DropLink Engineering Team',
        url: 'https://droplink.dev',
        email: 'support@droplink.dev',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
      {
        url: 'https://your-render-url.onrender.com',
        description: 'Production Server',
      },
    ],
    tags: [
      { name: 'Health', description: 'System health & readiness check endpoints' },
      { name: 'Transfers', description: 'Transfer creation, status, and deletion endpoints' },
      { name: 'Share', description: 'Receiver Share ID lookup and preview' },
      { name: 'Download', description: 'Secure attachment streaming download endpoints' },
      { name: 'Cleanup', description: 'Background cleanup scheduler metrics and manual trigger' },
    ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time', example: '2026-08-07T21:40:00.000Z' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'TRANSFER_EXPIRED' },
                message: { type: 'string', example: 'Transfer has expired.' },
                details: { type: 'object', nullable: true },
              },
            },
            timestamp: { type: 'string', format: 'date-time', example: '2026-08-07T21:40:00.000Z' },
          },
        },
        TransferResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'ac9036393d33148109c78df3fe1b30ac237a8ae760dbbb202450f6287d886a9c' },
            shareId: { type: 'string', example: 'CYQ-EZS-MFJ' },
            shareUrl: { type: 'string', example: 'http://localhost:3000/transfer/CYQ-EZS-MFJ' },
            originalName: { type: 'string', example: 'document.pdf' },
            mimeType: { type: 'string', example: 'application/pdf' },
            size: { type: 'number', example: 1048576 },
            status: { type: 'string', enum: ['UPLOADING', 'READY', 'DOWNLOADING', 'COMPLETED', 'EXPIRED', 'FAILED', 'DELETED'], example: 'READY' },
            downloadCount: { type: 'number', example: 0 },
            maxDownloads: { type: 'number', example: 1 },
            receiverLimitEnabled: { type: 'boolean', example: false },
            receiverLimit: { type: 'number', example: 1 },
            expiresAt: { type: 'string', format: 'date-time', example: '2026-08-07T21:50:00.000Z' },
            createdAt: { type: 'string', format: 'date-time', example: '2026-08-07T21:40:00.000Z' },
            qrPayload: {
              type: 'object',
              properties: {
                shareUrl: { type: 'string' },
                rawShareId: { type: 'string' },
                formattedShareId: { type: 'string' },
              },
            },
          },
        },
        TransferStatus: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            shareId: { type: 'string' },
            status: { type: 'string' },
            downloadCount: { type: 'number' },
            remainingDownloads: { type: 'number' },
            expiresAt: { type: 'string' },
            remainingTime: { type: 'number', description: 'Countdown in seconds' },
            fileName: { type: 'string' },
            fileSize: { type: 'number' },
            transferType: { type: 'string', enum: ['single', 'zip'] },
          },
        },
        DownloadMetadata: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            shareId: { type: 'string' },
            fileName: { type: 'string' },
            fileSize: { type: 'number' },
            mimeType: { type: 'string' },
            transferType: { type: 'string' },
            status: { type: 'string' },
            expiresAt: { type: 'string' },
            downloadCount: { type: 'number' },
            remainingDownloads: { type: 'number' },
          },
        },
        CleanupMetrics: {
          type: 'object',
          properties: {
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            executionTime: { type: 'number' },
            deletedCount: { type: 'number' },
            failedCount: { type: 'number' },
            skippedCount: { type: 'number' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health Check',
          description: 'Verifies backend server operational status.',
          responses: {
            200: {
              description: 'Server healthy',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
            },
          },
        },
      },
      '/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness Check',
          description: 'Verifies backend server and MongoDB database connectivity.',
          responses: {
            200: {
              description: 'Server ready',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
            },
            503: {
              description: 'Service unavailable',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
          },
        },
      },
      '/api/v1/transfers': {
        post: {
          tags: ['Transfers'],
          summary: 'Create Transfer Upload',
          description: 'Upload single or multiple files to Google Drive with automatic ZIP creation for multi-file transfers.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    files: { type: 'array', items: { type: 'string', format: 'binary' } },
                    maxDownloads: { type: 'number', default: 1 },
                    expiryMinutes: { type: 'number', default: 10 },
                    receiverLimitEnabled: { type: 'boolean', default: false },
                    receiverLimit: { type: 'number', default: 1 },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Transfer created successfully',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
            },
            400: { description: 'Validation error / forbidden file extension', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            429: { description: 'Upload rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            500: { description: 'Storage or server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/v1/transfers/{token}': {
        get: {
          tags: ['Transfers'],
          summary: 'Get Transfer Details',
          description: 'Retrieves metadata for a transfer using its unique token.',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Transfer details retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
            404: { description: 'Transfer not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            410: { description: 'Transfer expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Transfers'],
          summary: 'Delete Transfer',
          description: 'Manually deletes a transfer and its file from Google Drive.',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Transfer deleted successfully' },
            404: { description: 'Transfer not found' },
          },
        },
      },
      '/api/v1/transfers/{token}/status': {
        get: {
          tags: ['Transfers'],
          summary: 'Get Transfer Status',
          description: 'Retrieves countdown timer, download count, and status.',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Status retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
            404: { description: 'Transfer not found' },
          },
        },
      },
      '/api/v1/transfers/share/{shareId}': {
        get: {
          tags: ['Share'],
          summary: 'Receiver Share ID Lookup',
          description: 'Retrieves preview metadata for a receiver using Share ID (e.g., CYQ-EZS-MFJ).',
          parameters: [{ name: 'shareId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Metadata retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
            404: { description: 'Share ID not found' },
            410: { description: 'Transfer expired' },
            429: { description: 'Download limit exceeded' },
          },
        },
      },
      '/api/v1/transfers/{token}/download': {
        get: {
          tags: ['Download'],
          summary: 'Stream File Download',
          description: 'Streams file attachment directly from Google Drive to browser HTTP response.',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'File stream download', content: { 'application/octet-stream': {} } },
            404: { description: 'Transfer or file not found' },
            410: { description: 'Transfer expired' },
            429: { description: 'Download limit exceeded' },
          },
        },
      },
      '/api/v1/cleanup/metrics': {
        get: {
          tags: ['Cleanup'],
          summary: 'Get Cleanup Metrics',
          description: 'Returns metrics from the last background cleanup scheduler run.',
          responses: {
            200: { description: 'Metrics retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          },
        },
      },
      '/api/v1/cleanup/trigger': {
        post: {
          tags: ['Cleanup'],
          summary: 'Trigger Manual Cleanup',
          description: 'Triggers an immediate background cleanup cycle.',
          responses: {
            200: { description: 'Cleanup executed successfully' },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
