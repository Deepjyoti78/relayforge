import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IngestionService } from './ingestion.service';

@Controller('v1/ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post(':endpointId')
  async ingestWebhook(
    @Param('endpointId') endpointId: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    const rawBody =
      req.rawBody ||
      Buffer.from(typeof body === 'string' ? body : JSON.stringify(body || {}));

    const result = await this.ingestionService.ingestWebhook(
      endpointId,
      rawBody,
      headers,
      body,
    );

    if (result.status === 'duplicate') {
      return res.status(HttpStatus.OK).json({
        ...result,
        message: 'Event previously received (idempotent)',
      });
    }

    return res.status(HttpStatus.ACCEPTED).json(result);
  }
}
