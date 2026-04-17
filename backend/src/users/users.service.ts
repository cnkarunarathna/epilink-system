import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.SUPERVISOR]: 'Supervisor',
  [UserRole.PHI]: 'Public Health Inspector',
  [UserRole.VIEWER]: 'Viewer',
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly eventsGateway: EventsGateway,
    private readonly cacheHelper: CacheHelperService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private async invalidateUserCaches(): Promise<void> {
    await this.cacheHelper.delByPattern('users:*');
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate that Supervisor and PHI roles must have a district assigned
    if (
      (createUserDto.role === UserRole.SUPERVISOR ||
        createUserDto.role === UserRole.PHI) &&
      !createUserDto.district
    ) {
      throw new BadRequestException(
        `${createUserDto.role === UserRole.SUPERVISOR ? 'Supervisor' : 'PHI'} accounts must be assigned to a district`,
      );
    }

    // Capture plain-text password before hashing (needed for welcome email)
    const plainPassword = createUserDto.password;

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = savedUser;

    // Emit WebSocket event
    this.eventsGateway.emitUserCreated(userWithoutPassword);

    await this.invalidateUserCaches();

    // Send welcome email with login credentials
    await this.emailService.send({
      to: savedUser.email,
      subject: 'Welcome to Epilink — Your Account Details',
      template: 'welcome',
      context: {
        name: savedUser.name,
        email: savedUser.email,
        tempPassword: plainPassword,
        role: savedUser.role,
        roleLabel: ROLE_LABELS[savedUser.role],
        district: savedUser.district ?? null,
        loginUrl: this.configService.get<string>(
          'NEXT_FRONTEND_URL',
          'http://localhost:3000',
        ),
      },
      relatedEntityType: 'user',
      relatedEntityId: savedUser.id,
    });

    return userWithoutPassword as User;
  }

  async findAll(): Promise<User[]> {
    const cacheKey = 'users:list';
    const cached = await this.cacheHelper.get<User[]>(cacheKey);
    if (cached) return cached;

    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Remove passwords from response
    const result = users.map(({ password, ...user }) => user as User);
    await this.cacheHelper.set(cacheKey, result, 300000); // 5 minutes
    return result;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Validate that Supervisor and PHI roles must have a district
    const finalRole = updateUserDto.role || user.role;
    const finalDistrict =
      updateUserDto.district !== undefined
        ? updateUserDto.district
        : user.district;

    if (
      (finalRole === UserRole.SUPERVISOR || finalRole === UserRole.PHI) &&
      !finalDistrict
    ) {
      throw new BadRequestException(
        `${finalRole === UserRole.SUPERVISOR ? 'Supervisor' : 'PHI'} accounts must be assigned to a district`,
      );
    }

    // Update user
    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = updatedUser;

    // Emit WebSocket event
    this.eventsGateway.emitUserUpdated(userWithoutPassword);

    await this.invalidateUserCaches();
    return userWithoutPassword as User;
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.remove(user);

    // Emit WebSocket event
    this.eventsGateway.emitUserDeleted(id);
    await this.invalidateUserCaches();
  }

  async toggleStatus(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.isActive = !user.isActive;
    const updatedUser = await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = updatedUser;

    // Emit WebSocket event
    this.eventsGateway.emitUserStatusChanged(id, updatedUser.isActive);

    await this.invalidateUserCaches();

    // Send activation / deactivation email
    const loginUrl = this.configService.get<string>(
      'NEXT_FRONTEND_URL',
      'http://localhost:3000',
    );
    if (updatedUser.isActive) {
      await this.emailService.send({
        to: updatedUser.email,
        subject: 'Your Epilink Account Has Been Activated',
        template: 'account-activated',
        context: {
          name: updatedUser.name,
          email: updatedUser.email,
          roleLabel: ROLE_LABELS[updatedUser.role],
          district: updatedUser.district ?? null,
          loginUrl,
        },
        relatedEntityType: 'user',
        relatedEntityId: updatedUser.id,
      });
    } else {
      await this.emailService.send({
        to: updatedUser.email,
        subject: 'Your Epilink Account Has Been Deactivated',
        template: 'account-deactivated',
        context: { name: updatedUser.name },
        relatedEntityType: 'user',
        relatedEntityId: updatedUser.id,
      });
    }

    return userWithoutPassword as User;
  }

  async getStats() {
    const cacheKey = 'users:stats';
    const cached = await this.cacheHelper.get(cacheKey);
    if (cached) return cached;

    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });

    const usersByRole = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    const result = {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: usersByRole.reduce((acc, curr) => {
        acc[curr.role] = parseInt(curr.count);
        return acc;
      }, {}),
    };

    await this.cacheHelper.set(cacheKey, result, 300000); // 5 minutes
    return result;
  }

  async findSupervisorByDistrict(district: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { district, role: UserRole.SUPERVISOR, isActive: true },
    });
  }

  async createPhiForSupervisor(
    supervisorDistrict: string,
    phiData: { name: string; email: string; password: string },
  ): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: phiData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Capture plain-text password before hashing (needed for welcome email)
    const plainPassword = phiData.password;

    // Hash password
    const hashedPassword = await bcrypt.hash(phiData.password, 10);

    // Create PHI user with supervisor's district
    const user = this.userRepository.create({
      name: phiData.name,
      email: phiData.email,
      password: hashedPassword,
      role: UserRole.PHI,
      district: supervisorDistrict,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = savedUser;

    // Emit WebSocket event
    this.eventsGateway.emitUserCreated(userWithoutPassword);

    await this.invalidateUserCaches();

    // Send welcome email with login credentials
    await this.emailService.send({
      to: savedUser.email,
      subject: 'Welcome to Epilink — Your Account Details',
      template: 'welcome',
      context: {
        name: savedUser.name,
        email: savedUser.email,
        tempPassword: plainPassword,
        role: savedUser.role,
        roleLabel: ROLE_LABELS[savedUser.role],
        district: savedUser.district ?? null,
        loginUrl: this.configService.get<string>(
          'NEXT_FRONTEND_URL',
          'http://localhost:3000',
        ),
      },
      relatedEntityType: 'user',
      relatedEntityId: savedUser.id,
    });

    return userWithoutPassword as User;
  }

  async updatePhiForSupervisor(
    supervisorDistrict: string,
    phiId: string,
    updateData: { name?: string; email?: string; password?: string },
  ): Promise<User> {
    // Find the PHI user
    const phi = await this.userRepository.findOne({ where: { id: phiId } });

    if (!phi) {
      throw new NotFoundException('PHI user not found');
    }

    // Validate that user is a PHI
    if (phi.role !== UserRole.PHI) {
      throw new BadRequestException('User is not a PHI');
    }

    // Validate that PHI belongs to supervisor's district
    if (phi.district !== supervisorDistrict) {
      throw new BadRequestException(
        'You can only manage PHIs in your district',
      );
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== phi.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateData.email },
      });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Hash password if provided
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Update PHI
    Object.assign(phi, updateData);
    const updatedUser = await this.userRepository.save(phi);

    const { password, ...userWithoutPassword } = updatedUser;

    // Emit WebSocket event
    this.eventsGateway.emitUserUpdated(userWithoutPassword);

    await this.invalidateUserCaches();
    return userWithoutPassword as User;
  }

  async deletePhiForSupervisor(
    supervisorDistrict: string,
    phiId: string,
  ): Promise<void> {
    // Find the PHI user
    const phi = await this.userRepository.findOne({ where: { id: phiId } });

    if (!phi) {
      throw new NotFoundException('PHI user not found');
    }

    // Validate that user is a PHI
    if (phi.role !== UserRole.PHI) {
      throw new BadRequestException('User is not a PHI');
    }

    // Validate that PHI belongs to supervisor's district
    if (phi.district !== supervisorDistrict) {
      throw new BadRequestException(
        'You can only manage PHIs in your district',
      );
    }

    await this.userRepository.remove(phi);

    // Emit WebSocket event
    this.eventsGateway.emitUserDeleted(phiId);
    await this.invalidateUserCaches();
  }

  async togglePhiStatusForSupervisor(
    supervisorDistrict: string,
    phiId: string,
  ): Promise<User> {
    // Find the PHI user
    const phi = await this.userRepository.findOne({ where: { id: phiId } });

    if (!phi) {
      throw new NotFoundException('PHI user not found');
    }

    // Validate that user is a PHI
    if (phi.role !== UserRole.PHI) {
      throw new BadRequestException('User is not a PHI');
    }

    // Validate that PHI belongs to supervisor's district
    if (phi.district !== supervisorDistrict) {
      throw new BadRequestException(
        'You can only manage PHIs in your district',
      );
    }

    phi.isActive = !phi.isActive;
    const updatedUser = await this.userRepository.save(phi);

    const { password, ...userWithoutPassword } = updatedUser;

    // Emit WebSocket event
    this.eventsGateway.emitUserStatusChanged(phiId, updatedUser.isActive);

    await this.invalidateUserCaches();

    // Send activation / deactivation email
    const loginUrl = this.configService.get<string>(
      'NEXT_FRONTEND_URL',
      'http://localhost:3000',
    );
    if (updatedUser.isActive) {
      await this.emailService.send({
        to: updatedUser.email,
        subject: 'Your Epilink Account Has Been Activated',
        template: 'account-activated',
        context: {
          name: updatedUser.name,
          email: updatedUser.email,
          roleLabel: ROLE_LABELS[updatedUser.role],
          district: updatedUser.district ?? null,
          loginUrl,
        },
        relatedEntityType: 'user',
        relatedEntityId: updatedUser.id,
      });
    } else {
      await this.emailService.send({
        to: updatedUser.email,
        subject: 'Your Epilink Account Has Been Deactivated',
        template: 'account-deactivated',
        context: { name: updatedUser.name },
        relatedEntityType: 'user',
        relatedEntityId: updatedUser.id,
      });
    }

    return userWithoutPassword as User;
  }
}
