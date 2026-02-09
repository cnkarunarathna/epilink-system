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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly eventsGateway: EventsGateway,
  ) {}

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

    return userWithoutPassword as User;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Remove passwords from response
    return users.map(({ password, ...user }) => user as User);
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

    return userWithoutPassword as User;
  }

  async getStats() {
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

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: usersByRole.reduce((acc, curr) => {
        acc[curr.role] = parseInt(curr.count);
        return acc;
      }, {}),
    };
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

    return userWithoutPassword as User;
  }
}
