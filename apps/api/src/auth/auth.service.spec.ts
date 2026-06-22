import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import { BadRequestException } from '@nestjs/common'

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    jest.clearAllMocks()
  })

  describe('mockLogin', () => {
    it('throws BadRequestException when neither email nor phone provided', async () => {
      await expect(service.mockLogin({ email: undefined, phoneE164: undefined } as any))
        .rejects.toThrow(BadRequestException)
    })

    it('creates new user when email does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'test@payra.io',
        role: 'CONSUMER',
        status: 'ACTIVE',
      })
      const result = await service.mockLogin({ email: 'test@payra.io' })
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1)
      expect(result).toHaveProperty('auth.accessToken')
    })
  })
})
