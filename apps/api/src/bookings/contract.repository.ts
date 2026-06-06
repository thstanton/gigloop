import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractRepository {
  constructor(private prisma: PrismaService) {}

  findContractTemplate(userId: string) {
    return this.prisma.template.findFirst({
      where: { userId, builtInType: 'contract' },
      select: { content: true },
    });
  }

  findActiveContract(bookingId: string) {
    return this.prisma.contract.findFirst({
      where: { bookingId, status: { not: 'VOID' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  createContractRecord(userId: string, bookingId: string, content: unknown) {
    return this.prisma.contract.create({
      data: {
        userId,
        bookingId,
        status: 'DRAFT',
        content: content as Prisma.InputJsonValue,
      },
    });
  }

  markContractSent(contractId: string) {
    return this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'SENT' },
    });
  }

  voidContract(contractId: string) {
    return this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'VOID', voidedAt: new Date() },
    });
  }

  updateContract(contractId: string, dto: UpdateContractDto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (dto.content !== undefined) data.content = dto.content as Prisma.InputJsonValue;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.signedAt !== undefined) data.signedAt = new Date(dto.signedAt);
    if (dto.status === 'VOID') data.voidedAt = new Date();
    return this.prisma.contract.update({ where: { id: contractId }, data });
  }

  findContractById(userId: string, bookingId: string, contractId: string) {
    return this.prisma.contract.findFirst({
      where: { id: contractId, bookingId, userId },
    });
  }

  deleteContract(contractId: string) {
    return this.prisma.contract.delete({ where: { id: contractId } });
  }

  markContractSigned(contractId: string, signedFromIp: string, signatureDataUrl: string) {
    return this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'SIGNED', signedAt: new Date(), signedFromIp, signatureDataUrl },
    });
  }
}
