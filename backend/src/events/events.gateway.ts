import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    district?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret:
          this.configService.get<string>('JWT_SECRET') ||
          'epilink-super-secret-key-change-in-production',
      });

      // Attach user info to socket
      client.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        district: payload.district,
      };

      // Join role-based rooms
      client.join(`role:${payload.role}`);
      if (payload.district) {
        client.join(`district:${payload.district}`);
      }
      client.join(`user:${payload.sub}`);

      this.logger.log(
        `Client ${client.id} connected - User: ${payload.email} (${payload.role})`,
      );
    } catch (error) {
      this.logger.error(
        `Client ${client.id} authentication failed: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(
      `Client ${client.id} disconnected - User: ${client.user?.email || 'unknown'}`,
    );
  }

  // ==================== User Events ====================

  emitUserCreated(user: any) {
    this.server
      .to('role:admin')
      .to('role:supervisor')
      .emit('user:created', user);
    this.logger.debug(`Emitted user:created for ${user.email}`);
  }

  emitUserUpdated(user: any) {
    this.server
      .to('role:admin')
      .to('role:supervisor')
      .emit('user:updated', user);
    this.logger.debug(`Emitted user:updated for ${user.email}`);
  }

  emitUserDeleted(userId: string) {
    this.server
      .to('role:admin')
      .to('role:supervisor')
      .emit('user:deleted', { id: userId });
    this.logger.debug(`Emitted user:deleted for ${userId}`);
  }

  emitUserStatusChanged(userId: string, isActive: boolean) {
    this.server
      .to('role:admin')
      .to('role:supervisor')
      .emit('user:status-changed', { id: userId, isActive });
    this.logger.debug(`Emitted user:status-changed for ${userId}: ${isActive}`);
  }

  // ==================== Analytics Events ====================

  emitAnalyticsUpdated(data: { type: string; payload?: any }) {
    this.server.emit('analytics:updated', data);
    this.logger.debug(`Emitted analytics:updated: ${data.type}`);
  }

  // ==================== Notification Events ====================

  emitNotification(
    notification: any,
    targetRoles?: string[],
    targetDistrict?: string,
  ) {
    if (targetDistrict) {
      this.server
        .to(`district:${targetDistrict}`)
        .emit('notification', notification);
    } else if (targetRoles && targetRoles.length > 0) {
      targetRoles.forEach((role) => {
        this.server.to(`role:${role}`).emit('notification', notification);
      });
    } else {
      this.server.emit('notification', notification);
    }
    this.logger.debug(`Emitted notification: ${notification.title}`);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`Emitted ${event} to user ${userId}`);
  }

  // ==================== Task Events ====================

  emitTaskCreated(task: any, districtName?: string) {
    // Emit to supervisors in the district
    if (districtName) {
      this.server.to(`district:${districtName}`).emit('task:created', task);
    }
    // Also emit to admins
    this.server.to('role:admin').emit('task:created', task);
    this.logger.debug(`Emitted task:created for ${task.id}`);
  }

  emitTaskUpdated(task: any, districtName?: string) {
    if (districtName) {
      this.server.to(`district:${districtName}`).emit('task:updated', task);
    }
    this.server.to('role:admin').emit('task:updated', task);
    // Notify assigned PHI if exists
    if (task.assignedPhiId) {
      this.server.to(`user:${task.assignedPhiId}`).emit('task:updated', task);
    }
    this.logger.debug(`Emitted task:updated for ${task.id}`);
  }

  emitTaskStatusChanged(
    task: any,
    oldStatus: string,
    newStatus: string,
    districtName?: string,
  ) {
    const payload = { task, oldStatus, newStatus };
    if (districtName) {
      this.server
        .to(`district:${districtName}`)
        .emit('task:status-changed', payload);
    }
    this.server.to('role:admin').emit('task:status-changed', payload);
    if (task.assignedPhiId) {
      this.server
        .to(`user:${task.assignedPhiId}`)
        .emit('task:status-changed', payload);
    }
    this.logger.debug(
      `Emitted task:status-changed for ${task.id}: ${oldStatus} -> ${newStatus}`,
    );
  }

  emitTaskAssigned(task: any, phiId: string, districtName?: string) {
    const payload = { task, phiId };
    if (districtName) {
      this.server.to(`district:${districtName}`).emit('task:assigned', payload);
    }
    this.server.to('role:admin').emit('task:assigned', payload);
    // Notify the assigned PHI
    this.server.to(`user:${phiId}`).emit('task:assigned', payload);
    this.logger.debug(`Emitted task:assigned for ${task.id} to PHI ${phiId}`);
  }

  emitTaskDeleted(taskId: string, districtName?: string) {
    if (districtName) {
      this.server.to(`district:${districtName}`).emit('task:deleted', taskId);
    }
    this.server.to('role:admin').emit('task:deleted', taskId);
    this.logger.debug(`Emitted task:deleted for ${taskId}`);
  }

  // ==================== Stats ====================

  getConnectedClients(): number {
    return this.server?.sockets?.sockets?.size || 0;
  }
}
