import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserProfileModule } from './user-profile/user-profile.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, UserProfileModule],
})
export class AppModule {}
