import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    if (internalKey) {
      const req = context.switchToHttp().getRequest();
      if (req.headers['x-internal-api-key'] === internalKey) {
        return true;
      }
    }
    return super.canActivate(context);
  }
}
