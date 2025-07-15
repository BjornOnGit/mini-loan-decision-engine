import { prisma } from "../config/database"

export interface CreateKYCData {
  userId: string
  income: number
  employer: string
}

export const createKYC = async (kycData: CreateKYCData) => {
  try {
    const kyc = await prisma.kYCInfo.create({
      data: {
        userId: kycData.userId,
        income: kycData.income,
        employer: kycData.employer,
      },
    })
    return kyc
  } catch (error) {
    throw error
  }
}

export const getKYCByUserId = async (userId: string) => {
  return await prisma.kYCInfo.findUnique({
    where: { userId },
  })
}
