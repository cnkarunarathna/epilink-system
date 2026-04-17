import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('phis')
  @Roles(UserRole.SUPERVISOR)
  async createPhi(
    @Request() req,
    @Body() phiData: { name: string; email: string; password: string },
  ) {
    const supervisor = req.user;

    if (!supervisor.district) {
      throw new BadRequestException(
        'Supervisor must have a district assigned to create PHI users',
      );
    }

    return this.usersService.createPhiForSupervisor(
      supervisor.district,
      phiData,
    );
  }

  @Patch('phis/:id')
  @Roles(UserRole.SUPERVISOR)
  async updatePhi(
    @Request() req,
    @Param('id') id: string,
    @Body() updateData: { name?: string; email?: string; password?: string },
  ) {
    const supervisor = req.user;

    if (!supervisor.district) {
      throw new BadRequestException('Supervisor must have a district assigned');
    }

    return this.usersService.updatePhiForSupervisor(
      supervisor.district,
      id,
      updateData,
    );
  }

  @Delete('phis/:id')
  @Roles(UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhi(@Request() req, @Param('id') id: string) {
    const supervisor = req.user;

    if (!supervisor.district) {
      throw new BadRequestException('Supervisor must have a district assigned');
    }

    return this.usersService.deletePhiForSupervisor(supervisor.district, id);
  }

  @Patch('phis/:id/toggle-status')
  @Roles(UserRole.SUPERVISOR)
  async togglePhiStatus(@Request() req, @Param('id') id: string) {
    const supervisor = req.user;

    if (!supervisor.district) {
      throw new BadRequestException('Supervisor must have a district assigned');
    }

    return this.usersService.togglePhiStatusForSupervisor(
      supervisor.district,
      id,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  async toggleStatus(@Param('id') id: string) {
    return this.usersService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Get(':id/notification-preferences')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.PHI)
  async getNotificationPreferences(
    @Param('id') id: string,
    @Request() req,
  ) {
    if (req.user.role !== UserRole.ADMIN && req.user.id !== id) {
      throw new ForbiddenException(
        'You can only view your own notification preferences',
      );
    }
    return this.usersService.getNotificationPreferences(id);
  }

  @Put(':id/notification-preferences')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.PHI)
  async updateNotificationPreferences(
    @Param('id') id: string,
    @Request() req,
    @Body()
    dto: {
      taskAssigned?: boolean;
      taskStatusChanged?: boolean;
      taskReminder?: boolean;
      taskOverdue?: boolean;
      evidenceReview?: boolean;
      reportReady?: boolean;
      weeklyDigest?: boolean;
      riskAlerts?: boolean;
    },
  ) {
    if (req.user.role !== UserRole.ADMIN && req.user.id !== id) {
      throw new ForbiddenException(
        'You can only update your own notification preferences',
      );
    }
    return this.usersService.updateNotificationPreferences(id, dto);
  }
}
