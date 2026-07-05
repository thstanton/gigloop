import { ApiProperty } from '@nestjs/swagger';

export class DocumentDownloadResponseDto {
  @ApiProperty({
    description:
      "Fetchable storage URL for the caller's own document, resolved after the " +
      'ownership check. The client navigates to it to view/download the file. ' +
      '(ADR-0059 — a later slice makes this a short-lived presigned GET.)',
    example: 'https://pub-xxxx.r2.dev/uploads/u1/b1/d1.pdf',
  })
  url!: string;
}
