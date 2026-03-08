import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService, TaskFilters } from './tasks.service';
import { GeocodingService } from './geocoding.service';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  UpdateTaskDto,
  UpdateTaskStatusDto,
  AssignTaskDto,
} from './dto/update-task.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import {
  GeocodeAddressDto,
  ReverseGeocodeDto,
  SearchAddressDto,
} from './dto/geocoding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskStatus, TaskType, TaskPriority } from './entities/task.entity';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly geocodingService: GeocodingService,
  ) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    return this.tasksService.create(createTaskDto, req.user.id);
  }

  @Get()
  findAll(
    @Query('districtId') districtId?: string,
    @Query('status') status?: TaskStatus,
    @Query('type') type?: TaskType,
    @Query('priority') priority?: TaskPriority,
    @Query('assignedPhiId') assignedPhiId?: string,
  ) {
    const filters: TaskFilters = {
      districtId: districtId ? parseInt(districtId, 10) : undefined,
      status,
      type,
      priority,
      assignedPhiId,
    };
    return this.tasksService.findAll(filters);
  }

  @Get('stats')
  getStats(@Query('districtId') districtId?: string) {
    return this.tasksService.getStats(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('phis/:districtName')
  getPhisByDistrict(@Param('districtName') districtName: string) {
    return this.tasksService.getPhisByDistrict(districtName);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
    @Request() req,
  ) {
    return this.tasksService.updateStatus(id, dto, req.user.id);
  }

  @Patch(':id/assign')
  assignTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assignTask(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }

  // Evidence endpoints
  @Get(':id/evidence')
  getEvidence(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.getEvidence(id);
  }

  @Post(':id/evidence')
  addEvidence(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateEvidenceDto,
    @Request() req,
  ) {
    return this.tasksService.addEvidence(taskId, dto, req.user.id);
  }

  @Patch('evidence/:evidenceId/verify')
  verifyEvidence(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() body: { approved: boolean; rejectionReason?: string },
    @Request() req,
  ) {
    return this.tasksService.verifyEvidence(
      evidenceId,
      body.approved,
      req.user.id,
      body.rejectionReason,
    );
  }

  // Geocoding endpoints
  @Post('geocode')
  geocodeAddress(@Body() dto: GeocodeAddressDto) {
    return this.geocodingService.geocodeAddress(dto.address);
  }

  @Post('reverse-geocode')
  reverseGeocode(@Body() dto: ReverseGeocodeDto) {
    return this.geocodingService.reverseGeocode(dto.latitude, dto.longitude);
  }

  @Post('search-addresses')
  searchAddresses(@Body() dto: SearchAddressDto) {
    return this.geocodingService.searchAddresses(dto.query, dto.limit);
  }
}
