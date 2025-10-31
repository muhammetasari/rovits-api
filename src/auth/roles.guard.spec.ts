import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ExecutionContext } from '@nestjs/common';
import { Role } from './roles.enum';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);
    });

    const createMockContext = (
        user: any,
        requiredRoles: Role[] | undefined,
    ): ExecutionContext => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

        return {
            switchToHttp: () => ({
                getRequest: () => ({ user }),
            }),
            getHandler: () => ({}),
            getClass: () => ({}),
        } as any;
    };

    it('should allow if no roles are required', () => {
        const context = createMockContext({ roles: [Role.User] }, undefined);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow if user has the required role (User)', () => {
        const context = createMockContext({ roles: [Role.User] }, [Role.User]);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow if user has the required role (Admin)', () => {
        const context = createMockContext({ roles: [Role.Admin] }, [Role.Admin]);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow if user has one of the required roles (Admin)', () => {
        const context = createMockContext({ roles: [Role.Admin] }, [Role.User, Role.Admin]);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny if user does not have the required role', () => {
        const context = createMockContext({ roles: [Role.User] }, [Role.Admin]);
        expect(guard.canActivate(context)).toBe(false);
    });

    it('should deny if user has no roles property', () => {
        const context = createMockContext({}, [Role.User]);
        expect(guard.canActivate(context)).toBe(false);
    });

    it('should deny if user roles array is empty', () => {
        const context = createMockContext({ roles: [] }, [Role.User]);
        expect(guard.canActivate(context)).toBe(false);
    });
});