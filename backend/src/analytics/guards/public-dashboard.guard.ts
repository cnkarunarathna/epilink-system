import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from '../../entities/system-settings.entity';

@Injectable()
export class PublicDashboardGuard implements CanActivate {
  constructor(
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
  ) {}

  async canActivate(_ctx: ExecutionContext): Promise<boolean> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (settings && !settings.publicDashboard) {
      throw new ForbiddenException('The public dashboard is currently disabled by the administrator.');
    }
    return true;
  }
}
