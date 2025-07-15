import { prisma } from "../config/database"

export interface CreateUserData {
  email: string
  fullName: string
}

export const createUser = async (userData: CreateUserData) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        fullName: userData.fullName,
      },
    })
    return user
  } catch (error) {
    throw error
  }
}

export const getUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      kycInfo: true,
      loans: true,
    },
  })
}

export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  })
}

export const userExists = async (id: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id },
  })
  return !!user
}
