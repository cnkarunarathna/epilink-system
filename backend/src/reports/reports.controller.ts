import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ValidatedServiceUser } from '../common/service-headers.util';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('year') year?: string,
  ) {
    return this.reportsService.listReports({
      status,
      type,
      year: year ? Number(year) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getOne(@Param('id') id: string) {
    return this.reportsService.getReport(id);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN)
  async generate(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.reportsService.generateReport(dto, user);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.reportsService.approveReport(id, user);
  }

  @Get(':id/download')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async download(@Param('id') id: string) {
    return this.reportsService.getDownloadUrl(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    await this.reportsService.deleteReport(id);
    return { success: true };
  }
}
