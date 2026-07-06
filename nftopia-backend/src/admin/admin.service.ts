import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Collection } from '../modules/collection/entities/collection.entity';
import { AuditService, AuditAction } from '../common/audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly auditService: AuditService,
  ) {}

  async banUser(
    adminId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    const beforeState = { isBanned: user.isBanned };
    user.isBanned = true;
    const afterState = { isBanned: user.isBanned };
    const saved = await this.userRepository.save(user);

    await this.auditService.logAdminAction(AuditAction.BAN_USER, {
      adminId,
      entityType: 'User',
      entityId: userId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async unbanUser(
    adminId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    const beforeState = { isBanned: user.isBanned };
    user.isBanned = false;
    const afterState = { isBanned: user.isBanned };
    const saved = await this.userRepository.save(user);

    await this.auditService.logAdminAction(AuditAction.UNBAN_USER, {
      adminId,
      entityType: 'User',
      entityId: userId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async hideCollection(
    adminId: string,
    collectionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    if (collection.isHidden) {
      throw new BadRequestException('Collection is already hidden');
    }

    const beforeState = { isHidden: collection.isHidden };
    collection.isHidden = true;
    const afterState = { isHidden: collection.isHidden };
    const saved = await this.collectionRepository.save(collection);

    await this.auditService.logAdminAction(AuditAction.HIDE_COLLECTION, {
      adminId,
      entityType: 'Collection',
      entityId: collectionId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async verifyCollection(
    adminId: string,
    collectionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    const beforeState = { isVerified: collection.isVerified };
    collection.isVerified = !collection.isVerified;
    const afterState = { isVerified: collection.isVerified };
    const saved = await this.collectionRepository.save(collection);

    await this.auditService.logAdminAction(AuditAction.VERIFY_COLLECTION, {
      adminId,
      entityType: 'Collection',
      entityId: collectionId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }
}
