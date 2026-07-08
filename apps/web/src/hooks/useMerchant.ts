'use client'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../lib/store'
import { cryptoPaySdk } from '@cryptopay/sdk'

export function useMerchant() {
  const { currentUserId, setMerchantId } = useAppStore()

  const { data: merchant, isLoading, error } = useQuery({
    queryKey: ['my-merchant', currentUserId],
    queryFn: async () => {
      const result = await cryptoPaySdk.merchants.getMyMerchant()
      if (result?.id) setMerchantId(result.id)
      return result
    },
    enabled: !!currentUserId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    merchant,
    merchantId: merchant?.id ?? null,
    isLoading,
    error,
    isMerchant: !!merchant,
  }
}
