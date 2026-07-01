import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyPosConnectionService } from '../loyalty-pos-connection.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LoyaltyPosConnectionService', () => {
  let service: LoyaltyPosConnectionService;

  beforeEach(async () => {
    process.env.POS_ENCRYPTION_KEY = '0'.repeat(64); // mock key
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyPosConnectionService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<LoyaltyPosConnectionService>(LoyaltyPosConnectionService);
  });

  afterEach(() => {
    delete process.env.POS_ENCRYPTION_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt correctly', () => {
    const token = 'my-secret-token';
    const encrypted = service.encrypt(token);
    expect(encrypted).not.toEqual(token);
    expect(service.decrypt(encrypted)).toEqual(token);
  });
});
