import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { MembershipRole } from '../../generated/prisma/enums';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizationService } from './organization.service';

@Controller('v1/organizations')
@UseGuards(AuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async createOrganization(
    @CurrentUser() user: User,
    @Body() body: { name: string; slug?: string },
  ) {
    return this.organizationService.createOrganization(user, body);
  }

  @Get()
  async listOrganizations(@CurrentUser() user: User) {
    return this.organizationService.listUserOrganizations(user);
  }

  @Get(':orgId')
  async getOrganization(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    return this.organizationService.getOrganization(orgId, user);
  }

  @Patch(':orgId')
  async updateOrganization(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: { name: string },
  ) {
    return this.organizationService.updateOrganization(orgId, user, body);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    await this.organizationService.deleteOrganization(orgId, user);
  }

  @Get(':orgId/members')
  async listMembers(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    return this.organizationService.listMembers(orgId, user);
  }

  @Post(':orgId/members')
  async addMember(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: { email?: string; username?: string; role: MembershipRole },
  ) {
    return this.organizationService.addMember(orgId, user, body);
  }

  @Patch(':orgId/members/:memberId')
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
    @Body() body: { role: MembershipRole },
  ) {
    return this.organizationService.updateMemberRole(orgId, memberId, user, body);
  }

  @Delete(':orgId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ) {
    return this.organizationService.removeMember(orgId, memberId, user);
  }
}
