import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DlqFilterParams, DlqRecord, DlqService } from './dlq.service';

export interface BulkReplayDto {
  outboxIds: string[];
}

@Controller('v1/organizations/:orgId/dlq')
@UseGuards(AuthGuard)
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get()
  async listDlq(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Query('destinationId') destinationId?: string,
    @Query('errorCategory') errorCategory?: DlqFilterParams['errorCategory'],
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ total: number; records: DlqRecord[] }> {
    return this.dlqService.listDlqMessages(orgId, user.id, {
      destinationId,
      errorCategory,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('bulk-replay')
  @HttpCode(HttpStatus.OK)
  async bulkReplay(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: BulkReplayDto,
  ): Promise<{ replayedCount: number; replayedIds: string[]; skippedIds: string[] }> {
    return this.dlqService.bulkReplayDlq(orgId, user.id, body.outboxIds);
  }

  @Delete(':outboxId')
  @HttpCode(HttpStatus.OK)
  async purgeDlq(
    @Param('orgId') orgId: string,
    @Param('outboxId') outboxId: string,
    @CurrentUser() user: User,
  ): Promise<{ success: boolean; message: string }> {
    return this.dlqService.purgeDlqMessage(orgId, user.id, outboxId);
  }
}
