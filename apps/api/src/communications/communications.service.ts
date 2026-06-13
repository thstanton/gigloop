import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { MailService } from '../mail/mail.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';

export interface SendEmailOptions {
  userId: string;
  bookingId?: string;
  contactId: string;
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private repo: CommunicationsRepository,
    private mail: MailService,
    private evaluator: ChecklistEvaluatorService,
  ) {}

  findAll(userId: string, bookingId: string) {
    return this.repo.findAll(userId, bookingId);
  }

  async findOne(userId: string, bookingId: string, id: string) {
    const communication = await this.repo.findOne(userId, bookingId, id);
    if (!communication) throw new NotFoundException('Communication not found');
    return communication;
  }

  async create(userId: string, bookingId: string, dto: CreateCommunicationDto) {
    const booking = await this.repo.findBookingById(userId, bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    const result = await this.repo.create(userId, bookingId, dto);
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return result;
  }

  findTemplate(userId: string, templateId: string) {
    return this.repo.findTemplate(userId, templateId);
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { userId, bookingId, contactId, to, subject, body, templateId, attachments } = options;
    if (!bookingId) {
      this.logger.log('[DEBUG-b7c1] sendEmail (no bookingId) start');
      await this.mail.send({ to, subject, body, attachments });
      return;
    }
    this.logger.log('[DEBUG-b7c1] sendEmail createPending start');
    const communication = await this.repo.createPending(userId, bookingId, contactId, subject, body, templateId);
    this.logger.log('[DEBUG-b7c1] sendEmail mail.send start');
    try {
      await this.mail.send({ to, subject, body, attachments });
      this.logger.log('[DEBUG-b7c1] sendEmail mail.send done');
      await this.repo.markSent(communication.id);
      await this.evaluator.evaluate(bookingId).catch(() => {});
    } catch (err) {
      this.logger.warn(`[DEBUG-b7c1] sendEmail failed: ${err instanceof Error ? err.message : String(err)}`);
      await this.repo.markFailed(communication.id);
      await this.evaluator.evaluate(bookingId).catch(() => {});
      throw err;
    }
  }
}
