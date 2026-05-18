import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getPublicFlags() {
    const settings = await this.adminService.getSettings();
    return {
      publicDashboard: settings.publicDashboard,
      maintenanceMode: settings.maintenanceMode,
    };
  }
}
