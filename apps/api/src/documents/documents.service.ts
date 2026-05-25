import { Injectable } from '@nestjs/common';
import type { Document } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { DocumentsRepository } from './documents.repository';

export type DocumentWithUrl = Document & { url: string };

@Injectable()
export class DocumentsService {
  constructor(
    private repo: DocumentsRepository,
    private storage: StorageService,
  ) {}

  async storeInvoicePdf(
    userId: string,
    bookingId: string,
    invoiceId: string,
    buffer: Buffer,
  ): Promise<DocumentWithUrl> {
    const key = `invoices/${userId}/${bookingId}/${invoiceId}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    const doc = await this.repo.create(userId, bookingId, 'INVOICE', key, invoiceId);
    return { ...doc, url: this.storage.getPublicUrl(key) };
  }

  async storeContractPdf(
    userId: string,
    bookingId: string,
    buffer: Buffer,
  ): Promise<DocumentWithUrl> {
    const key = `contracts/${userId}/${bookingId}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    const doc = await this.repo.create(userId, bookingId, 'CONTRACT', key);
    return { ...doc, url: this.storage.getPublicUrl(key) };
  }

  async storeSignedContractPdf(
    userId: string,
    bookingId: string,
    buffer: Buffer,
  ): Promise<DocumentWithUrl> {
    const signedKey = `contracts/${userId}/${bookingId}-signed.pdf`;
    const unsignedKey = `contracts/${userId}/${bookingId}.pdf`;

    await this.storage.putObject(signedKey, buffer, 'application/pdf');

    // Replace unsigned with signed: remove old R2 object and Document record
    await this.storage.deleteObject(unsignedKey);
    const existing = await this.repo.findContractForBooking(userId, bookingId);
    if (existing) await this.repo.delete(existing.id);

    const doc = await this.repo.create(userId, bookingId, 'CONTRACT', signedKey);
    return { ...doc, url: this.storage.getPublicUrl(signedKey) };
  }

  async findByBooking(userId: string, bookingId: string): Promise<DocumentWithUrl[]> {
    const docs = await this.repo.findByBooking(userId, bookingId);
    return docs.map((d) => ({ ...d, url: this.storage.getPublicUrl(d.storageKey) }));
  }

  async findByInvoice(userId: string, invoiceId: string): Promise<DocumentWithUrl | null> {
    const doc = await this.repo.findByInvoice(userId, invoiceId);
    if (!doc) return null;
    return { ...doc, url: this.storage.getPublicUrl(doc.storageKey) };
  }

  async findContractForBooking(userId: string, bookingId: string): Promise<DocumentWithUrl | null> {
    const doc = await this.repo.findContractForBooking(userId, bookingId);
    if (!doc) return null;
    return { ...doc, url: this.storage.getPublicUrl(doc.storageKey) };
  }
}
