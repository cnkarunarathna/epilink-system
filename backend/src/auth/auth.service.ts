import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { EmailService } from '../email/email.service';

const OTP_TTL_MINUTES = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private eventsGateway: EventsGateway,
    private cacheHelper: CacheHelperService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      district: user.district,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        district: user.district,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      district: user.district,
      createdAt: user.createdAt,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // Always respond the same way to prevent email enumeration
    if (!user || !user.isActive) return;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    user.passwordResetOtp = hashedOtp;
    user.passwordResetExpiry = expiry;
    await this.userRepository.save(user);

    await this.emailService.send({
      to: user.email,
      subject: 'EpiLink – Password Reset OTP',
      template: 'forgot-password',
      context: {
        name: user.name,
        otp,
        expiryMinutes: OTP_TTL_MINUTES,
      },
    });
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user || !user.passwordResetOtp || !user.passwordResetExpiry) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date() > user.passwordResetExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    const valid = await bcrypt.compare(dto.otp, user.passwordResetOtp);
    if (!valid) {
      throw new BadRequestException('Invalid OTP');
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user || !user.passwordResetOtp || !user.passwordResetExpiry) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date() > user.passwordResetExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    const valid = await bcrypt.compare(dto.otp, user.passwordResetOtp);
    if (!valid) {
      throw new BadRequestException('Invalid OTP');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.passwordResetOtp = null;
    user.passwordResetExpiry = null;
    await this.userRepository.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      user.password = await bcrypt.hash(dto.newPassword, 10);
    }

    if (dto.name) {
      user.name = dto.name;
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Email is already in use');
      }
      user.email = dto.email;
    }

    const updated = await this.userRepository.save(user);

    const { password: _pw, ...safe } = updated;

    this.eventsGateway.emitUserUpdated(safe);

    await Promise.all([
      this.cacheHelper.delByPattern('users:*'),
      this.cacheHelper.delByPattern('admin:*'),
    ]);

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      district: updated.district,
      createdAt: updated.createdAt,
    };
  }
}
