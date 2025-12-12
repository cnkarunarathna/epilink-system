import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async seedDefaultUsers(): Promise<void> {
    this.logger.log('Starting database seed...');

    const defaultUsers = [
      {
        email: 'admin@epilink.lk',
        password: 'Admin@123',
        name: 'System Administrator',
        role: UserRole.ADMIN,
        district: undefined,
      },
      {
        email: 'supervisor@epilink.lk',
        password: 'Supervisor@123',
        name: 'District Supervisor',
        role: UserRole.SUPERVISOR,
        district: 'Colombo',
      },
      {
        email: 'phi@epilink.lk',
        password: 'PHI@123',
        name: 'Public Health Inspector',
        role: UserRole.PHI,
        district: 'Colombo',
      },
      {
        email: 'viewer@epilink.lk',
        password: 'Viewer@123',
        name: 'Public Viewer',
        role: UserRole.VIEWER,
        district: undefined,
      },
    ];

    for (const userData of defaultUsers) {
      const existingUser = await this.userRepository.findOne({
        where: { email: userData.email },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const user = this.userRepository.create({
          ...userData,
          password: hashedPassword,
        });
        await this.userRepository.save(user);
        this.logger.log(
          `Created default user: ${userData.email} (${userData.role})`,
        );
      } else {
        this.logger.log(`User ${userData.email} already exists, skipping...`);
      }
    }

    this.logger.log('Database seed completed');
  }
}
