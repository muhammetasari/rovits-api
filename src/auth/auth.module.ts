import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
    imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    issuer: configService.get<string>('JWT_ISSUER'),
                    audience: configService.get<string>('JWT_AUDIENCE'),
                },
            }),
        }),
    ],
    providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
    exports: [JwtAuthGuard, RolesGuard, PassportModule],
})
export class AuthModule {}