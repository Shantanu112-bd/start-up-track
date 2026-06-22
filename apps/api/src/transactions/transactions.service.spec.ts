import { Test, TestingModule } from '@nestjs/testing'
import { TransactionsService } from './transactions.service'
import { PrismaService } from '../prisma/prisma.service'

const mockPrisma = {
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  merchant: {
    findUnique: jest.fn(),
  },
  wallet: {
    findUnique: jest.fn(),
  },
}

describe('TransactionsService', () => {
  let service: TransactionsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<TransactionsService>(TransactionsService)
    jest.clearAllMocks()
  })

  describe('quote', () => {
    it('returns a valid quote for USDC', async () => {
      const result = await service.quote({ assetIn: 'USDC' as any, amountInPaise: '50000' })
      expect(result).toHaveProperty('amountInCrypto')
      expect(result).toHaveProperty('starReward')
      expect(result).toHaveProperty('quoteRateInrPerAsset')
      expect(Number(result.amountInPaise)).toBe(50000)
    })

    it('returns a valid quote for XLM', async () => {
      const result = await service.quote({ assetIn: 'XLM' as any, amountInPaise: '10000' })
      expect(result).toHaveProperty('amountInCrypto')
      expect(Number(result.amountInPaise)).toBe(10000)
    })
  })

  describe('create', () => {
    it('throws BadRequestException when merchant is not found', async () => {
      mockPrisma.merchant.findUnique.mockResolvedValue(null)
      const principal = { id: 'user-1', role: 'CONSUMER' } as any
      const dto = {
        merchantId: 'merchant-1',
        assetIn: 'USDC' as any,
        amountInPaise: '50000',
        merchantUpiVpa: 'test@upi',
      }
      await expect(service.create(principal, dto)).rejects.toThrow()
    })
  })
})
